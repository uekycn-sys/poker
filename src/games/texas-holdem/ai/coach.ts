import { getLegalActions } from '../engine/rules';
import {
  ActionType,
  BettingStreet,
  HandState,
  PlayerAction,
} from '../engine/types';
import {
  analyzeBoardTexture,
  BoardTexture,
  getPostflopPositionInfo,
} from './boardTexture';
import { analyzeOuts, calculateRangeEquity, OutsAnalysis } from './equity';
import { GtoMatrixCell, lookupPreflopGto, scorePreflopStrength } from './gtoRanges';
import { AiPersona } from './personas';
import { inferActiveOpponentRanges, WeightedHandRange } from './rangeModel';

export interface CoachAnalysis {
  street: BettingStreet;
  heroEquityPct: number;
  potOddsPct: number;
  requiredEquityPct: number;
  toCall: number;
  potSize: number;
  spr: number;
  outs: OutsAnalysis;
  preflopCell: GtoMatrixCell | null;
  boardTexture?: BoardTexture | null;
  isIp?: boolean;
  opponentRangeSummaryZh?: string;
  impliedOddsZh: string;
  exploitativeTipZh: string;
  recommendedAction: ActionType;
  recommendedAmount?: number;
  recommendedLabelZh: string;
  explanationZh: string;
  computeMs: number;
}

export interface DecisionReviewItem {
  id: string;
  seq: number;
  street: BettingStreet;
  potBefore: number;
  toCall: number;
  heroEquityPct: number;
  potOddsPct: number;
  heroAction: PlayerAction;
  heroActionLabel: string;
  recommendedLabel: string;
  isBlunder: boolean;
  blunderType?:
    | 'bad_odds_call'
    | 'missed_value'
    | 'bad_fold'
    | 'bluff_calling_station'
    | 'preflop_leak';
  evDeltaChips: number;
  critiqueZh: string;
}

export interface StreetCurvePoint {
  street: BettingStreet;
  labelZh: string;
  pot: number;
  heroEquityPct: number;
  hasSnapshot: boolean;
}

export interface HandReviewReport {
  handId: number;
  heroNetChips: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  blunderCount: number;
  decisions: DecisionReviewItem[];
  streetCurve: StreetCurvePoint[];
  summaryZh: string;
}

const STREET_LABELS: Record<BettingStreet, string> = {
  preflop: '翻前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
};

function buildRangeAwareExploitativeTip(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
  oppRanges: readonly WeightedHandRange[],
  heroEquityPct: number,
): string {
  const activeOpps = state.players
    .filter((p) => p.seat !== heroSeat && !p.folded)
    .map((p) => personasBySeat[p.seat])
    .filter(Boolean);

  if (activeOpps.length === 0) {
    return '对手已全部弃牌，准备收池。';
  }

  const tightestRange = [...oppRanges].sort((a, b) => a.rangePct - b.rangePct)[0];
  const nitRange = oppRanges.find((r) => r.styleId === 'NIT' && r.tightness === 'ultra_narrow');
  if (nitRange) {
    const pct = Math.max(1, Math.round(nitRange.rangePct * 100));
    return `面对岩石型对手 ${nitRange.personaName} 的 ${nitRange.actionSummaryZh}（极窄范围约 ${pct}%，QQ+/AK为主），你当前手牌实际范围胜率仅为 ${heroEquityPct}%，切勿按普通随机牌力强行加注！`;
  }

  const station = activeOpps.find((p) => p.styleId === 'CALLING_STATION');
  if (station) {
    return `注意 ${station.name} 是【跟注站】（跟注范围极宽）：对他不要纯诈唬，拿到顶对以上成牌直接打薄价值！`;
  }

  const nit = activeOpps.find((p) => p.styleId === 'NIT');
  if (nit && state.actions.some((a) => a.seat === nit.seat && a.action.type === 'raise')) {
    return `警惕 ${nit.name}（岩石型）主动加注！其范围收窄至约 ${Math.max(1, Math.round((tightestRange?.rangePct ?? 0.06) * 100))}%，边缘顶对建议谨慎防守或弃牌。`;
  }

  const lag = activeOpps.find((p) => p.styleId === 'LAG');
  if (lag) {
    return `面对 ${lag.name}（松凶型）的高频宽范围施压，可以用中等成牌适当跟注抓诈唬，或用超强牌慢打诱敌。`;
  }

  return tightestRange
    ? `${tightestRange.summaryZh}。${activeOpps[0].exploitTipZh}`
    : activeOpps[0].exploitTipZh;
}

function buildRangeContextPrefixZh(
  oppRanges: readonly WeightedHandRange[],
  heroEquityPct: number,
): string {
  if (oppRanges.length === 0) return '';
  const focus = [...oppRanges].sort((a, b) => a.rangePct - b.rangePct)[0];
  const pct = Math.max(1, Math.round(focus.rangePct * 100));

  if (focus.styleId === 'NIT' && focus.tightness === 'ultra_narrow') {
    return `面对岩石型对手（${focus.personaName}）${focus.actionSummaryZh}的极窄范围（~${pct}%），你当前实际胜率仅为 ${heroEquityPct}%，切勿按普通随机牌力强行加注。`;
  }
  if (focus.tightness === 'ultra_narrow' || focus.tightness === 'narrow') {
    return `面对 ${focus.personaName}（${focus.actionSummaryZh}，偏紧范围 ~${pct}%），你的范围胜率为 ${heroEquityPct}%。`;
  }
  if (focus.tightness === 'wide') {
    return `面对 ${focus.personaName} 的宽松范围（~${pct}% 组合），你的范围胜率达 ${heroEquityPct}%。`;
  }
  return `对抗 ${focus.personaName} 的推断范围（~${pct}% 组合），你当前范围胜率为 ${heroEquityPct}%。`;
}

/**
 * Generates real-time GTO + Range-vs-Range Exploitative coaching insights for Hero's decision turn.
 */
export function analyzeCoachSpot(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
  iterations = 1200,
): CoachAnalysis {
  const hero = state.players.find((p) => p.seat === heroSeat)!;
  const legal = getLegalActions(state, heroSeat);
  const street = state.street === 'showdown' ? 'river' : state.street;

  const activeOpponents = Math.max(
    1,
    state.players.filter((p) => p.seat !== heroSeat && !p.folded).length,
  );
  const toCall = legal.callAmount;
  const potSize = state.pot;
  const potOdds = toCall > 0 ? toCall / Math.max(1, potSize + toCall) : 0;
  const potOddsPct = Math.round(potOdds * 100);

  const effectiveStack = Math.min(
    hero.stack,
    Math.max(
      0,
      ...state.players
        .filter((p) => p.seat !== heroSeat && !p.folded)
        .map((p) => p.stack),
    ),
  );
  const spr = Number((effectiveStack / Math.max(1, potSize)).toFixed(1));

  const outs = analyzeOuts(hero.holeCards, state.communityCards);
  const oppRanges = inferActiveOpponentRanges(state, heroSeat, personasBySeat);
  const focusRange = [...oppRanges].sort((a, b) => a.rangePct - b.rangePct)[0];
  const opponentRangeSummaryZh = focusRange?.summaryZh;

  // Preflop analysis
  if (street === 'preflop') {
    const facingRaise = state.currentBet > state.bigBlind;
    const preflopCell = lookupPreflopGto(hero.holeCards, hero.position, facingRaise);
    const mc = calculateRangeEquity(hero.holeCards, [], oppRanges, iterations);
    const strength = scorePreflopStrength(hero.holeCards);
    const heroEquityPct = Math.round(mc.equity * 100);
    const exploitativeTipZh = buildRangeAwareExploitativeTip(
      state,
      heroSeat,
      personasBySeat,
      oppRanges,
      heroEquityPct,
    );

    let recommendedAction: ActionType = preflopCell.action;
    let recommendedAmount: number | undefined;

    if (recommendedAction === 'raise' && !legal.canRaise) {
      recommendedAction = legal.canCall ? 'call' : legal.canCheck ? 'check' : 'all_in';
    } else if (recommendedAction === 'raise') {
      const target = facingRaise
        ? Math.round(state.currentBet * 3)
        : Math.round(state.bigBlind * 2.5);
      recommendedAmount = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, target));
    } else if (recommendedAction === 'call' && toCall === 0) {
      recommendedAction = 'check';
    } else if (recommendedAction === 'fold' && toCall === 0) {
      recommendedAction = 'check';
    }

    const recommendedLabelZh =
      recommendedAction === 'raise'
        ? `加注至 ${recommendedAmount}`
        : recommendedAction === 'call'
          ? `跟注 ${toCall}`
          : recommendedAction === 'check'
            ? '过牌看翻牌'
            : '弃牌';

    const impliedOddsZh =
      spr >= 6
        ? `当前有效 SPR=${spr}（深筹码），同花连张与小对子具备较高翻后隐含赔率。`
        : `当前 SPR=${spr}，筹码较浅，优先选择高牌力直接价值对决。`;

    const rangePrefix = buildRangeContextPrefixZh(oppRanges, heroEquityPct);
    const explanationZh =
      toCall > 0
        ? `跟注需要 ${potOddsPct}% 胜率。${rangePrefix} 手牌 ${preflopCell.handKey}（牌力评分 ${Math.round(strength * 100)}），${preflopCell.reasonZh}`
        : `在 ${hero.position} 位起手 ${preflopCell.handKey}（对抗 ${activeOpponents} 人范围胜率约 ${heroEquityPct}%），${preflopCell.reasonZh}`;

    return {
      street,
      heroEquityPct,
      potOddsPct,
      requiredEquityPct: potOddsPct,
      toCall,
      potSize,
      spr,
      outs,
      preflopCell,
      boardTexture: null,
      isIp: hero.position === 'BTN' || hero.position === 'CO',
      opponentRangeSummaryZh,
      impliedOddsZh,
      exploitativeTipZh,
      recommendedAction,
      recommendedAmount,
      recommendedLabelZh,
      explanationZh,
      computeMs: mc.elapsedMs,
    };
  }

  // Postflop Range-vs-Range Monte Carlo + Board Texture + IP/OOP Analysis
  const mc = calculateRangeEquity(hero.holeCards, state.communityCards, oppRanges, iterations);
  const heroEquityPct = Math.round(mc.equity * 100);
  const boardTexture = analyzeBoardTexture(state.communityCards);
  const posInfo = getPostflopPositionInfo(state, heroSeat);
  const isDry = boardTexture.wetness === 'dry';
  const isWet = boardTexture.wetness === 'wet';
  const hasCallingStation = state.players.some(
    (p) => p.seat !== heroSeat && !p.folded && personasBySeat[p.seat]?.styleId === 'CALLING_STATION',
  );
  const facingUltraNarrow = focusRange?.tightness === 'ultra_narrow';

  const exploitativeTipZh = buildRangeAwareExploitativeTip(
    state,
    heroSeat,
    personasBySeat,
    oppRanges,
    heroEquityPct,
  );

  let recommendedAction: ActionType = 'check';
  let recommendedAmount: number | undefined;
  let recommendedLabelZh = '过牌控池';
  let actionAdviceZh = '';

  const textureTagStr = boardTexture.tagsZh.slice(0, 3).join('·');
  const posStr = posInfo.isIp ? '有利位置（IP）' : '不利位置（OOP）';
  const rangePrefix = buildRangeContextPrefixZh(oppRanges, heroEquityPct);

  const impliedOddsZh =
    street !== 'river' && outs.totalOuts >= 4
      ? spr >= 2.5
        ? `当前牌面【${textureTagStr}】、你处于${posStr}，SPR=${spr}，击中听牌后仍有充足后手可榨取隐含价值。`
        : `SPR=${spr} 较浅且处于${posStr}，隐含赔率有限，若直接赔率不足不建议盲目追牌。`
      : `牌面结构【${textureTagStr}】，你处于${posStr}，${isDry ? '干燥面适合小额高频施压或控池' : isWet ? '湿润面需警惕听牌反超，价值下注宜用较大尺度' : '半湿润面需结合转牌变化灵活控制底池'}。`;

  if (toCall > 0) {
    // Facing a bet
    const raiseThreshold = facingUltraNarrow ? 0.78 : isWet ? 0.7 : 0.74;
    if (mc.equity >= raiseThreshold && legal.canRaise) {
      recommendedAction = 'raise';
      const potFactor = isWet ? 0.75 : 0.65;
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, state.currentBet + Math.round((potSize + toCall) * potFactor)),
      );
      recommendedLabelZh = `加注至 ${recommendedAmount}（强价值）`;
      actionAdviceZh = `跟注需 ${potOddsPct}% 胜率，你对对手范围绝对领先，建议在${posStr}${isWet ? '用大尺度加注保护并榨取价值' : '加注做大底池'}！`;
    } else if (
      street !== 'river' &&
      outs.totalOuts >= 12 &&
      mc.equity >= 0.45 &&
      legal.canRaise &&
      !hasCallingStation &&
      !facingUltraNarrow
    ) {
      recommendedAction = 'raise';
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, state.currentBet + Math.round((potSize + toCall) * 0.67)),
      );
      recommendedLabelZh = `加注至 ${recommendedAmount}（半诈唬）`;
      actionAdviceZh = `你手握${outs.drawTagsZh.join('+')}共 ${outs.totalOuts} 张 Outs，在${posStr}兼具成牌率与弃牌率，适合主动加注施压！`;
    } else if (mc.equity >= potOdds - (street !== 'river' && outs.totalOuts >= 8 && spr >= 2.5 ? 0.05 : 0)) {
      recommendedAction = 'call';
      recommendedLabelZh = `跟注 ${toCall}`;
      actionAdviceZh =
        facingUltraNarrow && mc.equity < 0.6
          ? `跟注需 ${potOddsPct}% 胜率，虽满足赔率可跟注抓牌/防守，但对手范围极强，切忌盲目加注。`
          : outs.totalOuts >= 4
            ? `跟注需 ${potOddsPct}% 胜率，你有 ${outs.totalOuts} 张 Outs，范围胜率达标，建议在${posStr}跟注看牌。`
            : `跟注需 ${potOddsPct}% 胜率，底池赔率划算，建议${posInfo.isIp ? '利用 IP 位置优势' : '稳健'}跟注。`;
    } else {
      recommendedAction = 'fold';
      recommendedLabelZh = '弃牌止损';
      actionAdviceZh = `跟注需要 ${potOddsPct}% 胜率，当前范围胜率不足${outs.totalOuts > 0 ? `（仅 ${outs.totalOuts} Outs）` : ''}，强行跟注为 -EV 失误，建议果断弃牌。`;
    }
  } else {
    // Checked to Hero
    const valueThreshold = hasCallingStation ? 0.56 : posInfo.isIp ? 0.62 : 0.67;
    if (mc.equity >= valueThreshold && legal.canRaise) {
      recommendedAction = 'raise';
      const betRatio = isDry
        ? mc.equity >= 0.85 && street !== 'flop'
          ? 0.66
          : 0.33
        : isWet
          ? 0.72
          : mc.equity >= 0.78
            ? 0.67
            : 0.5;
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, Math.round(potSize * betRatio)),
      );
      const sizeTag = betRatio <= 0.36 ? '1/3池小额' : betRatio >= 0.68 ? '2/3~3/4池' : '半池';
      recommendedLabelZh = `价值下注 ${recommendedAmount}`;
      actionAdviceZh = hasCallingStation
        ? `当前存在跟注站，建议在${posStr}直接打出 ${recommendedAmount}（${sizeTag}）薄价值！`
        : `在【${textureTagStr}】牌面、${posStr}下领先对手范围，建议下注 ${recommendedAmount}（${sizeTag}）${isDry ? '高频获取价值' : '保护成牌并拒绝对手便宜看牌'}。`;
    } else if (street !== 'river' && outs.totalOuts >= 10 && legal.canRaise && !hasCallingStation) {
      recommendedAction = 'raise';
      const semiRatio = isDry ? 0.33 : 0.67;
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, Math.round(potSize * semiRatio)),
      );
      recommendedLabelZh = `半诈唬下注 ${recommendedAmount}`;
      actionAdviceZh = `你手握 ${outs.totalOuts} 张 Outs（${outs.drawTagsZh.join('+')}），在【${textureTagStr}】${posStr}建议以 ${recommendedAmount} 半诈唬施压！`;
    } else {
      recommendedAction = 'check';
      recommendedLabelZh = '过牌控池';
      actionAdviceZh = posInfo.isOop
        ? `处于不利位置（OOP）且面对【${textureTagStr}】牌面，边缘牌力宜多过牌保护过牌范围并控制底池。`
        : `在有利位置（IP）免费看牌，当前胜率适合过牌控池，避免面对强牌范围被反加套牢。`;
    }
  }

  const explanationZh = `${rangePrefix} 当前牌面【${textureTagStr}】，处于${posStr}。${actionAdviceZh}`;

  return {
    street,
    heroEquityPct,
    potOddsPct,
    requiredEquityPct: potOddsPct,
    toCall,
    potSize,
    spr,
    outs,
    preflopCell: null,
    boardTexture,
    isIp: posInfo.isIp,
    opponentRangeSummaryZh,
    impliedOddsZh,
    exploitativeTipZh,
    recommendedAction,
    recommendedAmount,
    recommendedLabelZh,
    explanationZh,
    computeMs: mc.elapsedMs,
  };
}

function formatActionLabelZh(action: PlayerAction, toCall: number): string {
  switch (action.type) {
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return `跟注 ${toCall}`;
    case 'raise':
      return toCall === 0 ? `下注 ${action.amount ?? 0}` : `加注至 ${action.amount ?? 0}`;
    case 'all_in':
      return 'All-in';
  }
}

/**
 * Audits a single Hero decision against GTO / Pot-Odds / EV math for post-hand review.
 */
export function evaluateHeroDecision(
  stateBefore: HandState,
  heroAction: PlayerAction,
  coach: CoachAnalysis,
  personasBySeat: Record<number, AiPersona>,
): DecisionReviewItem {
  const street = stateBefore.street === 'showdown' ? 'river' : stateBefore.street;
  const heroSeat = stateBefore.players.find((p) => p.isHuman)?.seat ?? 0;
  const activeStation = stateBefore.players.some(
    (p) => p.seat !== heroSeat && !p.folded && personasBySeat[p.seat]?.styleId === 'CALLING_STATION',
  );

  const eq = coach.heroEquityPct / 100;
  const odds = coach.potOddsPct / 100;
  const heroActionLabel = formatActionLabelZh(heroAction, coach.toCall);

  let isBlunder = false;
  let blunderType: DecisionReviewItem['blunderType'];
  let evDeltaChips = 0;
  let critiqueZh = `决策合理，符合 ${STREET_LABELS[street]} 阶段期望收益。`;

  if (street === 'preflop' && coach.preflopCell?.action === 'fold' && heroAction.type !== 'fold' && heroAction.type !== 'check') {
    isBlunder = true;
    blunderType = 'preflop_leak';
    evDeltaChips = -Math.max(stateBefore.bigBlind, Math.round((coach.toCall || stateBefore.bigBlind) * 0.65));
    critiqueZh = `-EV 翻前漏洞：${coach.preflopCell.handKey} 在该位置属于标准弃牌范围，入池长期亏损筹码。`;
  } else if (
    (heroAction.type === 'call' || (heroAction.type === 'all_in' && coach.toCall > 0)) &&
    coach.toCall > 0 &&
    eq + 0.04 < odds &&
    !(street !== 'river' && coach.outs.totalOuts >= 8 && coach.spr >= 3)
  ) {
    isBlunder = true;
    blunderType = 'bad_odds_call';
    evDeltaChips = Math.round(eq * (coach.potSize + coach.toCall) - coach.toCall);
    critiqueZh = `-EV 底池赔率不足强行跟注：跟注需 ${coach.potOddsPct}% 胜率，但你仅约 ${coach.heroEquityPct}% 胜率，建议弃牌。`;
  } else if (
    heroAction.type === 'check' &&
    coach.toCall === 0 &&
    (street === 'river' || street === 'turn') &&
    eq >= 0.68
  ) {
    isBlunder = true;
    blunderType = 'missed_value';
    evDeltaChips = -Math.round(coach.potSize * 0.45);
    critiqueZh = `-EV ${STREET_LABELS[street]}漏打价值：你胜率高达 ${coach.heroEquityPct}% 却选择过牌，错失了至少半池的价值收益！`;
  } else if (
    heroAction.type === 'fold' &&
    coach.toCall > 0 &&
    eq > odds + 0.08
  ) {
    isBlunder = true;
    blunderType = 'bad_fold';
    evDeltaChips = -Math.round(eq * (coach.potSize + coach.toCall) - coach.toCall);
    critiqueZh = `-EV 过度弃牌：你手牌胜率约 ${coach.heroEquityPct}% 明显高于赔率所需的 ${coach.potOddsPct}%，直接放弃了正收益底池。`;
  } else if (
    (heroAction.type === 'raise' || heroAction.type === 'all_in') &&
    activeStation &&
    eq < 0.24 &&
    coach.outs.totalOuts < 8
  ) {
    isBlunder = true;
    blunderType = 'bluff_calling_station';
    evDeltaChips = -Math.round((heroAction.amount ?? coach.potSize) * 0.55);
    critiqueZh = `-EV 对跟注站纯诈唬：桌上有几乎不弃牌的跟注站，胜率仅 ${coach.heroEquityPct}% 强行开火极易送钱。`;
  } else if (!isBlunder) {
    if (coach.recommendedAction === heroAction.type) {
      critiqueZh = `精准匹配 GTO 教练建议（${coach.recommendedLabelZh}），执行力出色！`;
    } else {
      critiqueZh = `偏离建议动作（教练推荐：${coach.recommendedLabelZh}），但未构成明显 -EV 严重失误。`;
    }
  }

  return {
    id: `rev-${stateBefore.handId}-${stateBefore.actions.length + 1}`,
    seq: stateBefore.actions.length + 1,
    street,
    potBefore: coach.potSize,
    toCall: coach.toCall,
    heroEquityPct: coach.heroEquityPct,
    potOddsPct: coach.potOddsPct,
    heroAction,
    heroActionLabel,
    recommendedLabel: coach.recommendedLabelZh,
    isBlunder,
    blunderType,
    evDeltaChips,
    critiqueZh,
  };
}

export function buildHandReviewReport(
  finalState: HandState,
  decisions: readonly DecisionReviewItem[],
  streetEquities: Partial<Record<BettingStreet, number>>,
): HandReviewReport {
  const hero = finalState.players.find((p) => p.isHuman);
  const heroSeat = hero?.seat ?? 0;
  const heroNetChips = finalState.showdown?.netDeltaBySeat[heroSeat] ?? 0;

  const streets: BettingStreet[] = ['preflop', 'flop', 'turn', 'river'];
  const streetCurve: StreetCurvePoint[] = [];

  for (const st of streets) {
    const snap = finalState.streetSnapshots[st];
    if (!snap) continue;
    const eqFromDecision = [...decisions].reverse().find((d) => d.street === st)?.heroEquityPct;
    const eqVal = streetEquities[st] ?? eqFromDecision ?? 50;
    streetCurve.push({
      street: st,
      labelZh: STREET_LABELS[st],
      pot: snap.pot,
      heroEquityPct: eqVal,
      hasSnapshot: true,
    });
  }

  // Append final pot on river/last played street if showdown reached
  if (streetCurve.length > 0) {
    const last = streetCurve[streetCurve.length - 1];
    last.pot = Math.max(last.pot, finalState.pot);
  }

  const blunderCount = decisions.filter((d) => d.isBlunder).length;
  const grade: HandReviewReport['grade'] =
    blunderCount === 0 && decisions.length >= 2
      ? 'S'
      : blunderCount === 0
        ? 'A'
        : blunderCount === 1
          ? 'B'
          : blunderCount === 2
            ? 'C'
            : 'D';

  const summaryZh =
    blunderCount === 0
      ? `本手牌零失误（评级 ${grade}），净收益 ${heroNetChips >= 0 ? `+${heroNetChips}` : heroNetChips} 筹码，数学赔率与范围掌控稳健。`
      : `本手牌共检测到 ${blunderCount} 处 -EV 失误决策，可点击下方任意一条街【从此处重新开打】重演改进！`;

  return {
    handId: finalState.handId,
    heroNetChips,
    grade,
    blunderCount,
    decisions: [...decisions],
    streetCurve,
    summaryZh,
  };
}

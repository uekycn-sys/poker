import { getLegalActions } from '../engine/rules';
import {
  ActionType,
  BettingStreet,
  HandState,
  PlayerAction,
} from '../engine/types';
import { analyzeOuts, calculateEquity, OutsAnalysis } from './equity';
import { GtoMatrixCell, lookupPreflopGto, scorePreflopStrength } from './gtoRanges';
import { AiPersona } from './personas';

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

function buildExploitativeTip(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
): string {
  const activeOpps = state.players
    .filter((p) => p.seat !== heroSeat && !p.folded)
    .map((p) => personasBySeat[p.seat])
    .filter(Boolean);

  if (activeOpps.length === 0) {
    return '对手已全部弃牌，准备收池。';
  }
  const station = activeOpps.find((p) => p.styleId === 'CALLING_STATION');
  if (station) {
    return `注意 ${station.name} 是【跟注站】：对他不要纯诈唬，拿到成牌（顶对以上）直接打薄价值！`;
  }
  const nit = activeOpps.find((p) => p.styleId === 'NIT');
  if (nit && state.actions.some((a) => a.seat === nit.seat && a.action.type === 'raise')) {
    return `警惕 ${nit.name}（岩石型）刚刚加注！其范围极窄，边缘顶对建议谨慎防守或弃牌。`;
  }
  const lag = activeOpps.find((p) => p.styleId === 'LAG');
  if (lag) {
    return `面对 ${lag.name}（松凶型）的高频施压，可以用中等成牌适当跟注抓诈唬，或用超强牌慢打诱敌。`;
  }
  return activeOpps[0].exploitTipZh;
}

/**
 * Generates real-time GTO + Exploitative coaching insights for Hero's decision turn.
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
  const exploitativeTipZh = buildExploitativeTip(state, heroSeat, personasBySeat);

  // Preflop analysis
  if (street === 'preflop') {
    const facingRaise = state.currentBet > state.bigBlind;
    const preflopCell = lookupPreflopGto(hero.holeCards, hero.position, facingRaise);
    const mc = calculateEquity(hero.holeCards, [], activeOpponents, iterations);
    const strength = scorePreflopStrength(hero.holeCards);
    const heroEquityPct = Math.round(mc.equity * 100);

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

    const explanationZh =
      toCall > 0
        ? `跟注需要 ${potOddsPct}% 胜率，你当前手牌 ${preflopCell.handKey} 对抗 ${activeOpponents} 名对手胜率约 ${heroEquityPct}%（翻前强度 ${Math.round(strength * 100)}），${preflopCell.reasonZh}`
        : `在 ${hero.position} 位起手 ${preflopCell.handKey}（对抗 ${activeOpponents} 人胜率约 ${heroEquityPct}%），${preflopCell.reasonZh}`;

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
      impliedOddsZh,
      exploitativeTipZh,
      recommendedAction,
      recommendedAmount,
      recommendedLabelZh,
      explanationZh,
      computeMs: mc.elapsedMs,
    };
  }

  // Postflop Monte Carlo analysis
  const mc = calculateEquity(hero.holeCards, state.communityCards, activeOpponents, iterations);
  const heroEquityPct = Math.round(mc.equity * 100);
  const hasCallingStation = state.players.some(
    (p) => p.seat !== heroSeat && !p.folded && personasBySeat[p.seat]?.styleId === 'CALLING_STATION',
  );

  let recommendedAction: ActionType = 'check';
  let recommendedAmount: number | undefined;
  let recommendedLabelZh = '过牌控池';
  let explanationZh = '';

  const impliedOddsZh =
    street !== 'river' && outs.totalOuts >= 4
      ? spr >= 2.5
        ? `SPR=${spr}，击中听牌后仍有充足后手筹码可榨取额外价值（隐含赔率充足）。`
        : `SPR=${spr} 较浅，隐含赔率有限，若底池赔率不足不建议盲目追牌。`
      : `已进入${STREET_LABELS[street]}阶段，决策主要取决于直接底池赔率与范围强弱。`;

  if (toCall > 0) {
    // Facing a bet
    if (mc.equity >= 0.72 && legal.canRaise) {
      recommendedAction = 'raise';
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, state.currentBet + Math.round((potSize + toCall) * 0.7)),
      );
      recommendedLabelZh = `加注至 ${recommendedAmount}（强价值）`;
      explanationZh = `跟注需要 ${potOddsPct}% 胜率，你的当前胜率高达 ${heroEquityPct}%，绝对领先对手范围，建议加注做大底池榨取价值！`;
    } else if (street !== 'river' && outs.totalOuts >= 12 && mc.equity >= 0.45 && legal.canRaise && !hasCallingStation) {
      recommendedAction = 'raise';
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, state.currentBet + Math.round((potSize + toCall) * 0.66)),
      );
      recommendedLabelZh = `加注至 ${recommendedAmount}（半诈唬）`;
      explanationZh = `跟注需要 ${potOddsPct}% 胜率，你手握${outs.drawTagsZh.join('+')}共 ${outs.totalOuts} 张 Outs，胜率约 ${heroEquityPct}%，兼具成牌率与弃牌率，建议加注做半诈唬！`;
    } else if (mc.equity >= potOdds - (street !== 'river' && outs.totalOuts >= 8 && spr >= 2.5 ? 0.05 : 0)) {
      recommendedAction = 'call';
      recommendedLabelZh = `跟注 ${toCall}`;
      explanationZh =
        outs.totalOuts >= 4
          ? `跟注需要 ${potOddsPct}% 胜率，你拥有 ${outs.totalOuts} 张 Outs，当前胜率约 ${heroEquityPct}%（大于赔率门槛），建议跟注看牌。`
          : `跟注需要 ${potOddsPct}% 胜率，你的当前胜率约 ${heroEquityPct}%，底池赔率划算，建议跟注。`;
    } else {
      recommendedAction = 'fold';
      recommendedLabelZh = '弃牌止损';
      explanationZh = `跟注需要 ${potOddsPct}% 胜率，而你当前胜率仅约 ${heroEquityPct}%${outs.totalOuts > 0 ? `（仅有 ${outs.totalOuts} 张 Outs）` : ''}，强行跟注属于 -EV 失误，建议果断弃牌。`;
    }
  } else {
    // Checked to Hero
    if (mc.equity >= (hasCallingStation ? 0.56 : 0.65) && legal.canRaise) {
      recommendedAction = 'raise';
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, Math.round(potSize * (mc.equity >= 0.78 ? 0.75 : 0.5))),
      );
      recommendedLabelZh = `价值下注 ${recommendedAmount}`;
      explanationZh = hasCallingStation
        ? `当前胜率约 ${heroEquityPct}%，且牌桌存在跟注站，建议直接打出 ${recommendedAmount} 的薄价值下注！`
        : `当前胜率约 ${heroEquityPct}%，领先对手范围，建议下注 ${recommendedAmount} 获取价值并保护成牌。`;
    } else if (street !== 'river' && outs.totalOuts >= 10 && legal.canRaise && !hasCallingStation) {
      recommendedAction = 'raise';
      recommendedAmount = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, Math.round(potSize * 0.66)),
      );
      recommendedLabelZh = `半诈唬下注 ${recommendedAmount}`;
      explanationZh = `你手握 ${outs.totalOuts} 张 Outs（${outs.drawTagsZh.join('+')}），胜率约 ${heroEquityPct}%，主动下注 ${recommendedAmount} 可直接收池或做大彩池！`;
    } else {
      recommendedAction = 'check';
      recommendedLabelZh = '过牌控池';
      explanationZh = `当前胜率约 ${heroEquityPct}%，在免费看牌的情况下建议过牌控制底池规模，避免被强牌反加套牢。`;
    }
  }

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

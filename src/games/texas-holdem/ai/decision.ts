import { createRng } from '../engine/deck';
import { getLegalActions } from '../engine/rules';
import { HandState, LegalActions, PlayerAction } from '../engine/types';
import { analyzeBoardTexture, getPostflopPositionInfo } from './boardTexture';
import { analyzeOuts, calculateRangeEquity } from './equity';
import { lookupPreflopGto, scorePreflopStrength } from './gtoRanges';
import { AI_PERSONAS_BY_SEAT, AiPersona } from './personas';
import { inferActiveOpponentRanges } from './rangeModel';

export interface AiDecision {
  action: PlayerAction;
  equity: number;
  potOdds: number;
  reasoningZh: string;
}

function clampRaiseTarget(
  desired: number,
  legal: LegalActions,
  step: number,
): number {
  const rounded = Math.round(desired / Math.max(1, step)) * Math.max(1, step);
  return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, rounded));
}

function chooseRaiseOrCall(
  legal: LegalActions,
  targetAmount: number,
  smallBlind: number,
): PlayerAction {
  if (legal.canRaise) {
    const clamped = clampRaiseTarget(targetAmount, legal, smallBlind);
    if (clamped >= legal.maxRaiseTo) {
      return { type: 'all_in' };
    }
    return { type: 'raise', amount: clamped };
  }
  if (legal.canAllIn && legal.isReopened && targetAmount >= legal.maxRaiseTo) {
    return { type: 'all_in' };
  }
  if (legal.canCall) return { type: 'call' };
  if (legal.canCheck) return { type: 'check' };
  return { type: 'fold' };
}

/**
 * Persona-driven EV decision engine for 6-Max NLH AI opponents.
 */
export function decideAiAction(
  state: HandState,
  seat: number,
  persona: AiPersona,
  options?: { iterations?: number; seed?: number },
): AiDecision {
  const legal = getLegalActions(state, seat);
  const player = state.players.find((p) => p.seat === seat)!;
  const rng = createRng(options?.seed);
  const roll = rng();

  const activeOpponents = state.players.filter((p) => p.seat !== seat && !p.folded).length;
  const toCall = legal.callAmount;
  const potAfterCall = Math.max(1, state.pot + toCall);
  const potOdds = toCall > 0 ? toCall / potAfterCall : 0;

  // --- PREFLOP DECISION ---
  if (state.street === 'preflop') {
    const facingRaise = state.currentBet > state.bigBlind;
    const gtoCell = lookupPreflopGto(player.holeCards, player.position, facingRaise);
    const strength = scorePreflopStrength(player.holeCards);
    const adjustedStrength = strength + persona.vpipBias * 0.45;
    const openSize = Math.round(state.bigBlind * (persona.styleId === 'LAG' ? 3 : 2.5));
    const threeBetSize = Math.round(state.currentBet * 3);

    // Calling Station preflop: calls very wide, rarely 3-bets except AA/KK
    if (persona.styleId === 'CALLING_STATION') {
      if (toCall === 0) {
        if (strength >= 0.78 && legal.canRaise) {
          return {
            action: chooseRaiseOrCall(legal, openSize, state.smallBlind),
            equity: strength,
            potOdds,
            reasoningZh: `${persona.name} 拿到超强牌，破例加注。`,
          };
        }
        return {
          action: { type: 'check' },
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 选择过牌看翻牌。`,
        };
      }
      // Facing bet: calls almost anything above trash unless huge all-in
      const maxCallRatio = potOdds + 0.22;
      if ((adjustedStrength >= 0.24 || gtoCell.action !== 'fold') && toCall <= player.stack * 0.45) {
        if (strength >= 0.88 && roll < persona.threeBetFreq && legal.canRaise) {
          return {
            action: chooseRaiseOrCall(legal, threeBetSize, state.smallBlind),
            equity: strength,
            potOdds,
            reasoningZh: `${persona.name} 用顶级大牌反加。`,
          };
        }
        if (legal.canCall) {
          return {
            action: { type: 'call' },
            equity: strength,
            potOdds,
            reasoningZh: `${persona.name}（跟注站）以宽松范围跟注看翻牌。`,
          };
        }
      }
      if (strength >= 0.65 && legal.canCall && potOdds <= maxCallRatio) {
        return {
          action: { type: 'call' },
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 跟注到底。`,
        };
      }
      return {
        action: legal.canCheck ? { type: 'check' } : { type: 'fold' },
        equity: strength,
        potOdds,
        reasoningZh: `${persona.name} 面对超大额施压放弃垃圾牌。`,
      };
    }

    // Nit preflop: ultra-tight
    if (persona.styleId === 'NIT') {
      const nitOpen = gtoCell.tier === 'premium' || gtoCell.tier === 'strong';
      if (!facingRaise) {
        if (nitOpen && legal.canRaise) {
          return {
            action: chooseRaiseOrCall(legal, openSize, state.smallBlind),
            equity: strength,
            potOdds,
            reasoningZh: `${persona.name}（岩石）只用顶级强牌开池加注。`,
          };
        }
        return {
          action: legal.canCheck ? { type: 'check' } : { type: 'fold' },
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 严守超紧范围，弃牌等待超强牌。`,
        };
      }
      if (gtoCell.tier === 'premium' && legal.canRaise && strength >= 0.72) {
        return {
          action: chooseRaiseOrCall(legal, threeBetSize, state.smallBlind),
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 岩石 3-Bet！通常代表 QQ+/AK。`,
        };
      }
      if ((gtoCell.tier === 'premium' || (gtoCell.tier === 'strong' && toCall <= state.bigBlind * 4)) && legal.canCall) {
        return {
          action: { type: 'call' },
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 用强起手牌跟注。`,
        };
      }
      return {
        action: legal.canCheck ? { type: 'check' } : { type: 'fold' },
        equity: strength,
        potOdds,
        reasoningZh: `${persona.name} 面对加注直接弃掉边缘牌。`,
      };
    }

    // TAG / LAG / GTO_PRO preflop
    if (!facingRaise) {
      const shouldOpen =
        gtoCell.action === 'raise' ||
        (persona.styleId === 'LAG' && adjustedStrength >= 0.34 && roll < 0.72);
      if (shouldOpen && legal.canRaise) {
        return {
          action: chooseRaiseOrCall(legal, openSize, state.smallBlind),
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 在 ${player.position} 位按范围率先加注。`,
        };
      }
      if (gtoCell.action === 'call' && legal.canCall) {
        return {
          action: { type: 'call' },
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 补齐跟注看翻牌。`,
        };
      }
      return {
        action: legal.canCheck ? { type: 'check' } : { type: 'fold' },
        equity: strength,
        potOdds,
        reasoningZh: `${persona.name} 弃牌。`,
      };
    }

    // Facing raise
    if (gtoCell.action === 'raise' || (persona.styleId === 'LAG' && adjustedStrength >= 0.56 && roll < persona.threeBetFreq)) {
      if (legal.canRaise && (gtoCell.tier === 'premium' || roll < persona.threeBetFreq)) {
        return {
          action: chooseRaiseOrCall(legal, threeBetSize, state.smallBlind),
          equity: strength,
          potOdds,
          reasoningZh: `${persona.name} 主动 3-Bet 施压。`,
        };
      }
    }

    const effectiveCallOk =
      gtoCell.action !== 'fold' ||
      (persona.styleId === 'LAG' && adjustedStrength >= 0.44 && potOdds <= 0.32);
    if (effectiveCallOk && legal.canCall && (potOdds <= strength + 0.14 || toCall <= state.bigBlind * 3.5)) {
      return {
        action: { type: 'call' },
        equity: strength,
        potOdds,
        reasoningZh: `${persona.name} 跟注看翻牌。`,
      };
    }

    return {
      action: legal.canCheck ? { type: 'check' } : { type: 'fold' },
      equity: strength,
      potOdds,
      reasoningZh: `${persona.name} 面对加注弃牌。`,
    };
  }

  // --- POSTFLOP DECISION (Range-vs-Range Monte Carlo Equity + Board Texture + IP/OOP) ---
  const oppRanges = inferActiveOpponentRanges(state, seat, AI_PERSONAS_BY_SEAT);
  const mc = calculateRangeEquity(
    player.holeCards,
    state.communityCards,
    oppRanges,
    options?.iterations ?? 1000,
    options?.seed,
  );
  const outs = analyzeOuts(player.holeCards, state.communityCards);
  const texture = analyzeBoardTexture(state.communityCards);
  const posInfo = getPostflopPositionInfo(state, seat);
  const eq = mc.equity;
  const isDry = texture.wetness === 'dry';
  const isWet = texture.wetness === 'wet';
  const isIp = posInfo.isIp;

  // Estimate whether this AI was preflop aggressor for C-Bet awareness
  const wasPreflopAggressor = state.actions.some(
    (a) =>
      a.street === 'preflop' &&
      a.seat === seat &&
      (a.action.type === 'raise' || a.action.type === 'all_in'),
  );

  // Facing a bet (toCall > 0)
  if (toCall > 0) {
    // Implied odds bonus for strong draws on flop/turn (slightly higher IP)
    const drawBonus =
      state.street !== 'river' && outs.totalOuts >= 8
        ? isIp
          ? 0.09
          : 0.06
        : state.street !== 'river' && outs.totalOuts >= 4
          ? 0.04
          : 0;
    const oopCaution = !isIp && isWet && persona.styleId !== 'CALLING_STATION' ? 0.03 : 0;
    const callThreshold = Math.max(0.08, potOdds + persona.callThresholdDelta - drawBonus + oopCaution);

    // OOP tends to check-raise more aggressively with monsters & big draws; IP smooth-calls more often
    const valueRaiseProb =
      persona.styleId === 'CALLING_STATION'
        ? 0.25
        : (isIp ? 0.62 : 0.78) + (isWet ? 0.1 : -0.05);
    const strongValueRaise = eq >= (isWet ? 0.71 : 0.76) && roll < valueRaiseProb;
    const semiBluffRaiseProb = persona.semiBluffFreq * (isIp ? 0.42 : 0.65);
    const semiBluffRaise =
      state.street !== 'river' &&
      outs.totalOuts >= 9 &&
      roll < semiBluffRaiseProb &&
      player.stack > toCall * 2.5;

    if ((strongValueRaise || semiBluffRaise) && legal.canRaise) {
      const raisePotFraction = isWet ? 0.75 : isDry ? 0.55 : 0.65;
      const raiseTarget = state.currentBet + Math.round((state.pot + toCall) * raisePotFraction);
      const posTag = isIp ? '有利位置加注' : '不利位置过牌-加注';
      return {
        action: chooseRaiseOrCall(legal, raiseTarget, state.smallBlind),
        equity: eq,
        potOdds,
        reasoningZh: strongValueRaise
          ? `${persona.name} 面对对手范围胜率约 ${Math.round(eq * 100)}%，在${isWet ? '湿润面' : '当前牌面'}${posTag}打价值！`
          : `${persona.name} 借 ${outs.totalOuts} 张 Outs 在${posTag}半诈唬施压！`,
      };
    }

    if (eq >= callThreshold && legal.canCall) {
      return {
        action: { type: 'call' },
        equity: eq,
        potOdds,
        reasoningZh: `${persona.name} 对抗范围胜率 ${Math.round(eq * 100)}% 达到跟注门槛，${isIp ? '利用位置优势' : ''}选择跟注。`,
      };
    }

    // Calling station stubborness with any piece / draw
    if (
      persona.styleId === 'CALLING_STATION' &&
      (eq >= 0.16 || outs.totalOuts >= 4) &&
      toCall <= player.stack * 0.6 &&
      legal.canCall
    ) {
      return {
        action: { type: 'call' },
        equity: eq,
        potOdds,
        reasoningZh: `${persona.name}（跟注站）不愿放弃手牌，跟注看后续。`,
      };
    }

    return {
      action: legal.canFold ? { type: 'fold' } : legal.canCheck ? { type: 'check' } : { type: 'call' },
      equity: eq,
      potOdds,
      reasoningZh: `${persona.name} 对抗推断范围胜率仅 ${Math.round(eq * 100)}%，低于底池赔率 ${Math.round(potOdds * 100)}%，选择弃牌。`,
    };
  }

  // Checked to AI (toCall === 0)
  const effectiveThinThreshold = persona.thinValueThreshold + (isIp ? -0.02 : 0.04);
  const shouldValueBet = eq >= effectiveThinThreshold;

  const effectiveCbetFreq = isDry
    ? Math.min(0.95, persona.cbetFreq + (isIp ? 0.16 : 0.05))
    : isWet
      ? Math.max(0.15, persona.cbetFreq * (isIp ? 0.78 : 0.52))
      : Math.min(0.9, persona.cbetFreq + (isIp ? 0.06 : -0.06));

  const shouldCbet =
    state.street === 'flop' &&
    wasPreflopAggressor &&
    roll < effectiveCbetFreq &&
    (!isWet || isIp || eq >= 0.42 || outs.totalOuts >= 6);

  const shouldSemiBluff =
    state.street !== 'river' &&
    outs.totalOuts >= 8 &&
    roll < persona.semiBluffFreq * (isIp ? 1.05 : 0.85);

  const pureBluffProb = persona.pureBluffFreq * (isIp ? 1.15 : 0.55) * (isDry ? 1.1 : 0.75);
  const shouldPureBluff = roll < pureBluffProb && activeOpponents <= 2;

  if ((shouldValueBet || shouldCbet || shouldSemiBluff || shouldPureBluff) && legal.canRaise) {
    // Dry board: small high-frequency sizing (1/3 pot); Wet board: large polarized sizing (2/3 ~ 3/4 pot)
    let potRatio = 0.5;
    if (isDry) {
      potRatio = eq >= 0.86 && state.street !== 'flop' ? 0.67 : 0.33;
    } else if (isWet) {
      potRatio = eq >= 0.78 || shouldSemiBluff ? 0.75 : 0.67;
    } else {
      potRatio = eq >= 0.8 ? 0.7 : shouldCbet && eq < 0.48 ? 0.45 : 0.55;
    }

    const betAmount = Math.max(legal.minRaiseTo, Math.round(state.pot * potRatio));
    const sizeDesc = potRatio <= 0.36 ? '1/3池小额' : potRatio >= 0.72 ? '3/4池重注' : '2/3池两极化';
    return {
      action: chooseRaiseOrCall(legal, betAmount, state.smallBlind),
      equity: eq,
      potOdds,
      reasoningZh: shouldValueBet
        ? `${persona.name} 范围胜率约 ${Math.round(eq * 100)}%，在${isDry ? '干燥面' : isWet ? '湿润面' : '当前牌面'}打${sizeDesc}价值下注。`
        : shouldSemiBluff
          ? `${persona.name} 拥有 ${outs.totalOuts} 张 Outs，在${posInfo.positionLabelZh}以${sizeDesc}半诈唬施压。`
          : `${persona.name} 在${isDry ? '干燥面' : '湿润面'}发起${sizeDesc}持续下注/诈唬。`,
    };
  }

  return {
    action: { type: 'check' },
    equity: eq,
    potOdds,
    reasoningZh: `${persona.name} 在${posInfo.positionLabelZh}选择过牌控池。`,
  };
}

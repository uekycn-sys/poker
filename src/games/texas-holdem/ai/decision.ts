import { createRng } from '../engine/deck';
import { getLegalActions } from '../engine/rules';
import { HandState, LegalActions, PlayerAction } from '../engine/types';
import { analyzeOuts, calculateEquity } from './equity';
import { lookupPreflopGto, scorePreflopStrength } from './gtoRanges';
import { AiPersona } from './personas';

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

  // --- POSTFLOP DECISION (Monte Carlo Equity >= 1000 iterations) ---
  const mc = calculateEquity(
    player.holeCards,
    state.communityCards,
    Math.max(1, activeOpponents),
    options?.iterations ?? 1000,
    options?.seed,
  );
  const outs = analyzeOuts(player.holeCards, state.communityCards);
  const eq = mc.equity;

  // Estimate whether this AI was preflop aggressor for C-Bet awareness
  const wasPreflopAggressor = state.actions.some(
    (a) => a.street === 'preflop' && a.seat === seat && (a.action.type === 'raise' || a.action.type === 'all_in'),
  );

  // Facing a bet (toCall > 0)
  if (toCall > 0) {
    // Implied odds bonus for strong draws on flop/turn
    const drawBonus =
      state.street !== 'river' && outs.totalOuts >= 8 ? 0.08 : state.street !== 'river' && outs.totalOuts >= 4 ? 0.04 : 0;
    const callThreshold = Math.max(0.08, potOdds + persona.callThresholdDelta - drawBonus);

    // Semi-bluff raise or value raise
    const strongValueRaise = eq >= 0.74 && roll < (persona.styleId === 'CALLING_STATION' ? 0.25 : 0.72);
    const semiBluffRaise =
      state.street !== 'river' &&
      outs.totalOuts >= 9 &&
      roll < persona.semiBluffFreq * 0.55 &&
      player.stack > toCall * 2.5;

    if ((strongValueRaise || semiBluffRaise) && legal.canRaise) {
      const raiseTarget = state.currentBet + Math.round((state.pot + toCall) * 0.65);
      return {
        action: chooseRaiseOrCall(legal, raiseTarget, state.smallBlind),
        equity: eq,
        potOdds,
        reasoningZh: strongValueRaise
          ? `${persona.name} 胜率约 ${Math.round(eq * 100)}%，加注打价值！`
          : `${persona.name} 借听牌（${outs.totalOuts} Outs）加注半诈唬！`,
      };
    }

    if (eq >= callThreshold && legal.canCall) {
      return {
        action: { type: 'call' },
        equity: eq,
        potOdds,
        reasoningZh: `${persona.name} 胜率 ${Math.round(eq * 100)}% 达到跟注门槛，选择跟注。`,
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
      reasoningZh: `${persona.name} 胜率仅 ${Math.round(eq * 100)}%，低于底池赔率 ${Math.round(potOdds * 100)}%，选择弃牌。`,
    };
  }

  // Checked to AI (toCall === 0)
  const shouldValueBet = eq >= persona.thinValueThreshold;
  const shouldCbet =
    state.street === 'flop' && wasPreflopAggressor && roll < persona.cbetFreq;
  const shouldSemiBluff =
    state.street !== 'river' && outs.totalOuts >= 8 && roll < persona.semiBluffFreq;
  const shouldPureBluff = roll < persona.pureBluffFreq && activeOpponents <= 2;

  if ((shouldValueBet || shouldCbet || shouldSemiBluff || shouldPureBluff) && legal.canRaise) {
    let potRatio = 0.5;
    if (eq >= 0.8) potRatio = 0.75;
    else if (shouldCbet && eq < 0.45) potRatio = 0.35;
    else if (shouldSemiBluff) potRatio = 0.66;

    const betAmount = Math.max(legal.minRaiseTo, Math.round(state.pot * potRatio));
    return {
      action: chooseRaiseOrCall(legal, betAmount, state.smallBlind),
      equity: eq,
      potOdds,
      reasoningZh: shouldValueBet
        ? `${persona.name} 胜率约 ${Math.round(eq * 100)}%，主动价值下注。`
        : shouldSemiBluff
          ? `${persona.name} 拥有 ${outs.totalOuts} 张 Outs，主动半诈唬下注。`
          : `${persona.name} 发起持续下注/诈唬施压。`,
    };
  }

  return {
    action: { type: 'check' },
    equity: eq,
    potOdds,
    reasoningZh: `${persona.name} 选择过牌控池。`,
  };
}

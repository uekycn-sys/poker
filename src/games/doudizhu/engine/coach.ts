import { Card, GameState, HandPattern, RANK_LABELS, Rank, Seat } from './types';
import { applyPassTurn, applyPlayCards, nextSeat } from './gameLoop';
import { decomposeHand } from './decomposer';
import { chooseBestMove, getPlayerPosition, solveEndgameAlphaBeta } from './ai';
import { computeExternalRemainingCounts, isBossPattern } from './cardCounter';

export interface WinRateEvaluation {
  landlordWinRate: number;
  farmerWinRate: number;
  perspectiveWinRate: number;
  advantage: number;
}

export interface CoachAdvice {
  isPass: boolean;
  cards: Card[];
  pattern: HandPattern | null;
  reason: string;
  tags: string[];
  currentWinRate: number;
  projectedWinRate: number;
}

export interface BlunderReport {
  moveIndex: number;
  seat: Seat;
  actualIsPass: boolean;
  actualCards: Card[];
  actualPattern: HandPattern | null;
  bestIsPass: boolean;
  bestCards: Card[];
  bestPattern: HandPattern | null;
  winRateBefore: number;
  winRateAfterActual: number;
  winRateAfterBest: number;
  winRateDrop: number;
  reason: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function formatPatternLabel(pattern: HandPattern | null): string {
  if (!pattern) return '不要';
  const r = RANK_LABELS[pattern.mainRank];
  switch (pattern.type) {
    case 'SINGLE':
      return `单张 ${r}`;
    case 'PAIR':
      return `对子 ${r}${r}`;
    case 'TRIPLE':
      return `三张 ${r}`;
    case 'TRIPLE_WITH_SINGLE':
      return `三带一 (${r})`;
    case 'TRIPLE_WITH_PAIR':
      return `三带二 (${r})`;
    case 'STRAIGHT':
      return `${pattern.chainLength}连顺子 (${r}起)`;
    case 'PAIR_STRAIGHT':
      return `${pattern.chainLength}连对 (${r}起)`;
    case 'AIRPLANE':
    case 'AIRPLANE_WITH_SINGLES':
    case 'AIRPLANE_WITH_PAIRS':
      return `飞机 (${r}起)`;
    case 'FOUR_WITH_TWO_SINGLES':
    case 'FOUR_WITH_TWO_PAIRS':
      return `四带二 (${r})`;
    case 'BOMB':
      return `炸弹 ${r}`;
    case 'ROCKET':
      return '王炸';
    default:
      return '出牌';
  }
}

/**
 * Evaluate live win probabilities for Landlord vs Farmers from the current game state.
 */
export function evaluateWinRate(state: GameState, perspectiveSeat: Seat = 0): WinRateEvaluation {
  const landlord = state.landlordSeat ?? 0;
  const isLandlordPerspective = perspectiveSeat === landlord;

  if (state.phase === 'FINISHED' && state.settlement) {
    const landlordWinRate = state.settlement.winnerRole === 'landlord' ? 100 : 0;
    const farmerWinRate = 100 - landlordWinRate;
    return {
      landlordWinRate,
      farmerWinRate,
      perspectiveWinRate: isLandlordPerspective ? landlordWinRate : farmerWinRate,
      advantage: landlordWinRate - 50,
    };
  }

  // In endgame, leverage fast Alpha-Beta exact win/loss resolution for Chess.com-level accuracy
  const maxHand = Math.max(state.hands[0].length, state.hands[1].length, state.hands[2].length);
  const totalCards = state.hands[0].length + state.hands[1].length + state.hands[2].length;
  if (state.phase === 'PLAYING' && maxHand <= 7 && totalCards <= 18) {
    const solved = solveEndgameAlphaBeta(state, state.currentTurn, 4000, 35);
    if (solved && (solved.solvedOutcome === 'WIN' || solved.solvedOutcome === 'LOSS')) {
      const currentIsLandlord = state.currentTurn === landlord;
      const landlordWins =
        (currentIsLandlord && solved.solvedOutcome === 'WIN') ||
        (!currentIsLandlord && solved.solvedOutcome === 'LOSS');
      const landlordWinRate = landlordWins ? 97 : 3;
      const farmerWinRate = 100 - landlordWinRate;
      return {
        landlordWinRate,
        farmerWinRate,
        perspectiveWinRate: isLandlordPerspective ? landlordWinRate : farmerWinRate,
        advantage: landlordWinRate - 50,
      };
    }
  }

  const f1 = nextSeat(landlord);
  const f2 = nextSeat(f1);

  const dL = decomposeHand(state.hands[landlord]);
  const d1 = decomposeHand(state.hands[f1]);
  const d2 = decomposeHand(state.hands[f2]);

  const lControlBonus = state.currentTurn === landlord && state.lastPlay === null ? 4.5 : 0;
  const fControlBonus = state.currentTurn !== landlord && state.lastPlay === null ? 4.5 : 0;

  // Immediate near-finish boost
  const lUrgency = state.hands[landlord].length <= 2 ? (3 - state.hands[landlord].length) * 6 : 0;
  const minFarmerLen = Math.min(state.hands[f1].length, state.hands[f2].length);
  const fUrgency = minFarmerLen <= 2 ? (3 - minFarmerLen) * 6 : 0;

  const landlordScore = dL.handValue + lControlBonus + lUrgency - state.hands[landlord].length * 0.5;
  const bestFarmer = Math.max(d1.handValue, d2.handValue);
  const supportFarmer = Math.min(d1.handValue, d2.handValue);
  const farmerScore =
    bestFarmer + (supportFarmer - 12) * 0.25 + fControlBonus + fUrgency - minFarmerLen * 0.5;

  const diff = landlordScore - farmerScore;
  const rawProb = sigmoid(diff / 12);
  const landlordWinRate = Math.round(clamp(rawProb * 100, 2, 98) * 10) / 10;
  const farmerWinRate = Math.round((100 - landlordWinRate) * 10) / 10;

  return {
    landlordWinRate,
    farmerWinRate,
    perspectiveWinRate: isLandlordPerspective ? landlordWinRate : farmerWinRate,
    advantage: Math.round((landlordWinRate - 50) * 10) / 10,
  };
}

function buildCoachExplanation(
  state: GameState,
  seat: Seat,
  decision: ReturnType<typeof chooseBestMove>,
): { reason: string; tags: string[] } {
  const landlordSeat = state.landlordSeat ?? 0;
  const pos = getPlayerPosition(seat, landlordSeat);
  const hand = state.hands[seat];
  const prevPlay = state.lastPlay;
  const label = formatPatternLabel(decision.pattern);
  const tags: string[] = [];

  if (!decision.isPass && decision.cards.length === hand.length) {
    tags.push('必胜收尾');
    return {
      reason: `推荐出${label}：一手出完直接锁定本局胜利。`,
      tags,
    };
  }

  if (decision.usedEndgameSolver && decision.solvedOutcome === 'WIN') {
    tags.push('残局算杀');
    const actionText = decision.isPass ? '不要' : `出${label}`;
    return {
      reason: `推荐${actionText}：残局推演确认此手为必胜算杀路线，可确保掌控最终牌权。`,
      tags,
    };
  }

  if (decision.isPass) {
    if (pos !== 'landlord' && prevPlay && prevPlay.seat !== landlordSeat) {
      tags.push('队友配合');
      const mateCards = state.hands[prevPlay.seat].length;
      return {
        reason: `推荐不要：队友牌权在手且仅剩 ${mateCards} 张，让出牌权避免内耗并保留大牌拦截地主。`,
        tags,
      };
    }
    tags.push('保留牌力');
    return {
      reason: '推荐不要：当前强行压牌会拆散核心牌型或消耗控制牌，暂避锋芒等待反击时机。',
      tags,
    };
  }

  const pattern = decision.pattern!;
  const ext = computeExternalRemainingCounts(hand, state.moveHistory);
  const boss = isBossPattern(pattern, ext, true);

  if (pos === 'landlord_up' && prevPlay === null) {
    const downSeat = nextSeat(landlordSeat);
    const downCards = state.hands[downSeat].length;
    if (downCards === 1 && pattern.type === 'SINGLE') {
      tags.push('送牌放行', '队友配合');
      return {
        reason: `推荐出${label}：地主下家队友仅剩 1 张单牌，主动放小单送队友走牌获胜。`,
        tags,
      };
    }
    if (downCards === 2 && pattern.type === 'PAIR') {
      tags.push('送牌放行', '队友配合');
      return {
        reason: `推荐出${label}：队友仅剩 2 张，优先送小对子助队友跑牌冲刺。`,
        tags,
      };
    }
    if (pattern.type === 'SINGLE' && pattern.mainRank >= Rank.JACK && pattern.mainRank <= Rank.ACE) {
      tags.push('守门顶牌');
      return {
        reason: `推荐出${label}：你是地主上家，需顶出大牌阻止地主顺过小单张。`,
        tags,
      };
    }
  }

  const oppSeats: Seat[] =
    pos === 'landlord' ? [nextSeat(landlordSeat), nextSeat(nextSeat(landlordSeat))] : [landlordSeat];
  const minOppCards = Math.min(...oppSeats.map((s) => state.hands[s].length));
  if (minOppCards <= 2) {
    tags.push(minOppCards === 1 ? '防报单' : '防报双');
    if (prevPlay === null && pattern.type !== 'SINGLE') {
      return {
        reason: `推荐出${label}：对手已报${minOppCards === 1 ? '单' : '双'}，改走复合牌型封堵对手出牌机会。`,
        tags,
      };
    }
    return {
      reason: `推荐出${label}：对手仅剩 ${minOppCards} 张牌，必须强势压制防止其逃脱。`,
      tags,
    };
  }

  if (pattern.type === 'BOMB' || pattern.type === 'ROCKET') {
    tags.push('抢占牌权');
    return {
      reason: `推荐出${label}：果断炸断对手节奏抢回先手牌权，同时提升本局倍数。`,
      tags,
    };
  }

  if (boss) {
    tags.push('绝对牌权');
    return {
      reason: `推荐出${label}：当前外面已无更大同牌型，打出后可稳稳收回先手权。`,
      tags,
    };
  }

  if (pattern.cards.length >= 4) {
    tags.push('减少手数');
    return {
      reason: `推荐出${label}：高效消耗多张弱牌并大幅减少出牌手数，保持手牌结构完整。`,
      tags,
    };
  }

  tags.push('稳健推进');
  return {
    reason: `推荐出${label}：顺势推进手牌轮次，同时保留 2 与王牌用于后续控场。`,
    tags,
  };
}

/**
 * Provide live Master AI coach recommendation, tactical Chinese explanation, and projected win rate.
 */
export function analyzeCoachRecommendation(state: GameState, seat: Seat): CoachAdvice {
  const decision = chooseBestMove(state, seat, 'master');
  const currentWinRate = evaluateWinRate(state, seat).perspectiveWinRate;

  let projectedWinRate = currentWinRate;
  try {
    const nextState = decision.isPass
      ? applyPassTurn(state, seat)
      : applyPlayCards(state, seat, decision.cards);
    projectedWinRate = evaluateWinRate(nextState, seat).perspectiveWinRate;
  } catch {
    projectedWinRate = currentWinRate;
  }

  const { reason, tags } = buildCoachExplanation(state, seat, decision);

  return {
    isPass: decision.isPass,
    cards: decision.cards,
    pattern: decision.pattern,
    reason,
    tags,
    currentWinRate,
    projectedWinRate,
  };
}

function sameMove(
  aPass: boolean,
  aPattern: HandPattern | null,
  bPass: boolean,
  bPattern: HandPattern | null,
): boolean {
  if (aPass !== bPass) return false;
  if (aPass && bPass) return true;
  if (!aPattern || !bPattern) return false;
  return (
    aPattern.type === bPattern.type &&
    aPattern.mainRank === bPattern.mainRank &&
    aPattern.chainLength === bPattern.chainLength &&
    aPattern.length === bPattern.length
  );
}

/**
 * Inspect `state.moveHistory` from the perspective of `targetSeat` and surface the top 1..3 blunders.
 */
export function analyzeMatchBlunders(
  state: GameState,
  targetSeat: Seat = 0,
  maxBlunders = 3,
): BlunderReport[] {
  if (state.landlordSeat === null) return [];

  const reports: BlunderReport[] = [];

  for (let i = 0; i < state.moveHistory.length; i++) {
    const move = state.moveHistory[i];
    if (move.seat !== targetSeat) continue;

    const prevMove = i > 0 ? state.moveHistory[i - 1] : null;
    const inferredPassCount = move.lastPlayBefore === null ? 0 : prevMove?.isPass ? 1 : 0;

    const preState: GameState = {
      ...state,
      phase: 'PLAYING',
      hands: [
        [...move.handsSnapshot[0]],
        [...move.handsSnapshot[1]],
        [...move.handsSnapshot[2]],
      ],
      currentTurn: targetSeat,
      lastPlay: move.lastPlayBefore,
      passCount: inferredPassCount,
      moveHistory: state.moveHistory.slice(0, i),
      settlement: null,
    };

    const best = chooseBestMove(preState, targetSeat, 'master');
    if (sameMove(move.isPass, move.pattern, best.isPass, best.pattern)) {
      continue;
    }

    const winRateBefore = evaluateWinRate(preState, targetSeat).perspectiveWinRate;

    const afterActual = move.isPass
      ? applyPassTurn(preState, targetSeat)
      : applyPlayCards(preState, targetSeat, move.cards);
    const afterBest = best.isPass
      ? applyPassTurn(preState, targetSeat)
      : applyPlayCards(preState, targetSeat, best.cards);

    const winRateAfterActual = evaluateWinRate(afterActual, targetSeat).perspectiveWinRate;
    const winRateAfterBest = evaluateWinRate(afterBest, targetSeat).perspectiveWinRate;
    const winRateDrop = Math.round((winRateAfterBest - winRateAfterActual) * 10) / 10;

    if (winRateDrop >= 4) {
      const { reason } = buildCoachExplanation(preState, targetSeat, best);
      reports.push({
        moveIndex: move.index,
        seat: targetSeat,
        actualIsPass: move.isPass,
        actualCards: move.cards,
        actualPattern: move.pattern,
        bestIsPass: best.isPass,
        bestCards: best.cards,
        bestPattern: best.pattern,
        winRateBefore,
        winRateAfterActual,
        winRateAfterBest,
        winRateDrop,
        reason,
      });
    }
  }

  return reports.sort((a, b) => b.winRateDrop - a.winRateDrop).slice(0, maxBlunders);
}

import {
  BidAction,
  Card,
  DoubleChoice,
  GameState,
  HandPattern,
  Rank,
  Seat,
} from './types';
import { findBeatingPlays, matchPatternToBeat } from './rules';
import { decomposeHand, HandDecomposition } from './decomposer';
import {
  computeExternalRemainingCounts,
  getExternalBombRanks,
  hasExternalRocket,
  isBossPattern,
} from './cardCounter';
import { nextSeat } from './gameLoop';
import { sampleDeterminizedHands } from './determinizer';

export type AIDifficulty = 'casual' | 'intermediate' | 'master';
export type PlayerPosition = 'landlord' | 'landlord_down' | 'landlord_up';
export type FarmerDynamicRole = 'attacker' | 'support' | 'balanced';

export interface ChooseMoveOptions {
  matchMode?: 'standard' | 'puzzle' | 'replay-resume';
  openHand?: boolean;
}

export interface AIMoveDecision {
  isPass: boolean;
  cards: Card[];
  pattern: HandPattern | null;
  score: number;
  usedEndgameSolver: boolean;
  solvedOutcome?: 'WIN' | 'LOSS' | 'UNKNOWN';
}

export function getPlayerPosition(seat: Seat, landlordSeat: Seat): PlayerPosition {
  if (seat === landlordSeat) return 'landlord';
  if (seat === nextSeat(landlordSeat)) return 'landlord_down';
  return 'landlord_up';
}

function getTeammateSeat(seat: Seat, landlordSeat: Seat): Seat | null {
  if (seat === landlordSeat) return null;
  const down = nextSeat(landlordSeat);
  const up = nextSeat(down);
  return seat === down ? up : down;
}

/**
 * Return true only when all three hands are legitimately public (puzzle mode,
 * explicit open-hand solver invocation, or all opponents activated Mingpai).
 */
export function isPerfectInformationGame(
  state: GameState,
  seat: Seat,
  options?: ChooseMoveOptions,
): boolean {
  if (options?.openHand) return true;
  if (options?.matchMode === 'puzzle' || state.matchMode === 'puzzle') return true;
  return ([0, 1, 2] as Seat[]).every((s) => s === seat || state.mingpaiSeats.includes(s));
}

function canSeeSeatHand(
  state: GameState,
  observerSeat: Seat,
  targetSeat: Seat,
  options?: ChooseMoveOptions,
): boolean {
  if (targetSeat === observerSeat) return true;
  if (isPerfectInformationGame(state, observerSeat, options)) return true;
  return state.mingpaiSeats.includes(targetSeat);
}

export interface FarmerRoleAssessment {
  role: FarmerDynamicRole;
  teammateCards: number;
  myEffectiveTurns: number;
  teammateEffectiveTurns: number;
  teammateNearWin: boolean;
}

/**
 * Dynamically classify a farmer as `attacker` (主攻) or `support` (辅助).
 * Only reads `state.hands[teammateSeat]` when teammate's hand is visible (mingpai/puzzle/sampled world);
 * otherwise estimates teammate's effective turns strictly from public counts & move/bid history.
 */
export function assessFarmerDynamicRole(
  state: GameState,
  seat: Seat,
  myDecomp: HandDecomposition,
  canSeeTeammate: boolean,
): FarmerRoleAssessment {
  const landlordSeat = state.landlordSeat ?? 0;
  const teammateSeat = getTeammateSeat(seat, landlordSeat);
  if (teammateSeat === null) {
    return {
      role: 'balanced',
      teammateCards: 99,
      myEffectiveTurns: myDecomp.effectiveTurns,
      teammateEffectiveTurns: 99,
      teammateNearWin: false,
    };
  }

  const teammateCards = state.hands[teammateSeat].length;
  const teammateNearWin = teammateCards <= 2;

  let teammateEffectiveTurns: number;
  let mateHandValue = 30;

  if (teammateCards === 0) {
    teammateEffectiveTurns = 0;
    mateHandValue = 100;
  } else if (canSeeTeammate) {
    const mateDecomp = decomposeHand(state.hands[teammateSeat]);
    teammateEffectiveTurns = mateDecomp.effectiveTurns;
    mateHandValue = mateDecomp.handValue;
  } else {
    // Public-only estimation from card count + bidding/doubling/play history
    teammateEffectiveTurns = teammateCards <= 2 ? 1 : Math.max(1, teammateCards / 2.35);

    const mateCalledOrGrabbed = state.bidHistory.some(
      (b) => b.seat === teammateSeat && (b.action === 'CALL' || b.action === 'GRAB'),
    );
    if (mateCalledOrGrabbed) {
      teammateEffectiveTurns -= 0.7;
      mateHandValue += 6;
    }

    const mateDouble = state.doubleChoices[teammateSeat];
    if (mateDouble === 4) {
      teammateEffectiveTurns -= 1.1;
      mateHandValue += 10;
    } else if (mateDouble === 2) {
      teammateEffectiveTurns -= 0.6;
      mateHandValue += 5;
    }

    for (const move of state.moveHistory) {
      if (move.seat !== teammateSeat) continue;
      if (!move.isPass && move.pattern) {
        if (move.pattern.type === 'BOMB' || move.pattern.type === 'ROCKET' || move.pattern.length >= 5) {
          teammateEffectiveTurns -= 0.35;
          mateHandValue += 3;
        }
      } else if (move.isPass && move.lastPlayBefore?.seat === landlordSeat) {
        if (move.lastPlayBefore.pattern.mainRank <= Rank.QUEEN) {
          teammateEffectiveTurns += 0.45;
          mateHandValue -= 3;
        }
      }
    }
    teammateEffectiveTurns = Math.max(1, Math.min(teammateCards, teammateEffectiveTurns));
  }

  let role: FarmerDynamicRole = 'balanced';
  if (teammateNearWin) {
    role = 'support';
  } else if (
    teammateEffectiveTurns + 1.1 <= myDecomp.effectiveTurns ||
    (teammateCards + 3 <= state.hands[seat].length && myDecomp.effectiveTurns >= 4) ||
    (canSeeTeammate && mateHandValue >= myDecomp.handValue + 10)
  ) {
    role = 'support';
  } else if (
    myDecomp.effectiveTurns + 1.1 <= teammateEffectiveTurns ||
    (state.hands[seat].length + 3 <= teammateCards && myDecomp.controlValue >= 3.5) ||
    (canSeeTeammate && myDecomp.handValue >= mateHandValue + 10)
  ) {
    role = 'attacker';
  }

  return {
    role,
    teammateCards,
    myEffectiveTurns: myDecomp.effectiveTurns,
    teammateEffectiveTurns,
    teammateNearWin,
  };
}

/** Decide whether AI wants to CALL / GRAB / PASS during BIDDING. */
export function decideBidAction(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'intermediate',
): BidAction {
  const decomp = decomposeHand(state.hands[seat]);
  const counts = new Map<Rank, number>();
  for (const c of state.hands[seat]) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  const twos = counts.get(Rank.TWO) ?? 0;
  const aces = counts.get(Rank.ACE) ?? 0;
  const hasSJ = counts.has(Rank.SMALL_JOKER);
  const hasBJ = counts.has(Rank.BIG_JOKER);

  // Hand strength metric for bidding
  let bidScore =
    decomp.controlValue * 1.4 -
    decomp.effectiveTurns * 1.1 +
    twos * 0.6 +
    aces * 0.25;
  if (hasBJ) bidScore += 1.25;
  if (hasSJ) bidScore += 0.85;

  if (difficulty === 'casual') {
    bidScore += 0.55;
    if (state.firstCallerSeat === null) {
      return bidScore >= -1.5 ? 'CALL' : 'PASS';
    }
    const casualThreshold = 1.2 + state.grabCount * 1.8;
    return bidScore >= casualThreshold ? 'GRAB' : 'PASS';
  }

  // Seat position & bidding sequence context
  const passedCount = state.passedBeforeCall.length;
  if (state.firstCallerSeat === null) {
    if (passedCount === 2) {
      // Last bidder after two passes: calling secures landlord with 0 competition
      bidScore += 0.9;
    } else if (state.bidHistory.length === 0) {
      // First bidder faces two potential grabbers
      bidScore -= 0.35;
    }
  } else {
    if (seat === state.firstCallerSeat) {
      // Counter-grabbing with knowledge of initial call
      bidScore += 0.25;
    } else if (passedCount === 1) {
      // One opponent already passed initial call
      bidScore += 0.4;
    }
  }

  // Mingpai awareness (only inspect visible mingpai hands!)
  if (state.mingpaiSeats.includes(seat)) {
    bidScore += 2.4;
  }
  for (const other of state.mingpaiSeats) {
    if (other === seat) continue;
    const oppDecomp = decomposeHand(state.hands[other]);
    if (oppDecomp.handValue >= 46 || oppDecomp.effectiveTurns <= 5 || oppDecomp.bombCount >= 1) {
      bidScore -= 2.8;
    } else if (oppDecomp.handValue <= 30) {
      bidScore += 1.1;
    }
  }

  if (state.firstCallerSeat === null) {
    return bidScore >= -1.5 ? 'CALL' : 'PASS';
  }

  // Grab threshold escalates with grabCount (multiplier = 2^grabCount)
  const grabMultiplierPenalty = difficulty === 'master' ? 2.75 : 2.5;
  const grabThreshold = 1.5 + state.grabCount * grabMultiplierPenalty;
  return bidScore >= grabThreshold ? 'GRAB' : 'PASS';
}

/** Decide whether AI chooses 1x / 2x / 4x during DOUBLING. */
export function decideDoubleChoice(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'intermediate',
): DoubleChoice {
  const decomp = decomposeHand(state.hands[seat]);
  const landlordSeat = state.landlordSeat ?? 0;
  const isLandlord = seat === landlordSeat;
  let strength = decomp.handValue + (isLandlord ? 3 : 0);

  if (difficulty === 'casual') {
    return strength >= 40 ? 2 : 1;
  }

  const pos = getPlayerPosition(seat, landlordSeat);
  const teammateSeat = getTeammateSeat(seat, landlordSeat);

  // 1. Grab count risk discipline (already high public multiplier)
  if (state.grabCount >= 2) {
    strength -= (state.grabCount - 1) * 3.0;
  }

  // 2. Seat order & observed double choices (doubling runs landlord -> down -> up)
  if (!isLandlord) {
    const landlordDbl = state.doubleChoices[landlordSeat];
    if (landlordDbl === 4 && !decomp.hasRocket && decomp.bombCount < 2) {
      strength -= 5.5;
    } else if (landlordDbl === 2) {
      strength -= 2.0;
    }

    if (pos === 'landlord_up' && teammateSeat !== null) {
      const mateDbl = state.doubleChoices[teammateSeat];
      if (mateDbl === 4) strength += 3.5;
      else if (mateDbl === 2) strength += 2.0;
    }
  }

  // 3. Mingpai awareness (only inspect visible mingpai hands!)
  for (const mSeat of state.mingpaiSeats) {
    if (mSeat === seat) {
      strength += 3.0;
      continue;
    }
    const mDecomp = decomposeHand(state.hands[mSeat]);
    const isOpponent = isLandlord || mSeat === landlordSeat;
    if (isOpponent) {
      if (mDecomp.handValue >= 48 || mDecomp.effectiveTurns <= 4 || (mDecomp.hasRocket && mDecomp.bombCount >= 1)) {
        strength -= 7.0;
      } else if (mDecomp.handValue <= 30) {
        strength += 4.0;
      }
    } else {
      // Visible farmer teammate is strong
      if (mDecomp.handValue >= 44 || mDecomp.effectiveTurns <= 5) {
        strength += 4.5;
      }
    }
  }

  if (difficulty === 'master') {
    if (
      strength >= 50 ||
      (decomp.hasRocket && decomp.bombCount >= 1) ||
      (decomp.effectiveTurns <= 4 && decomp.controlValue >= 5)
    ) {
      return 4;
    }
    if (strength >= 33 || decomp.bombCount >= 1 || decomp.hasRocket) {
      return 2;
    }
    return 1;
  }

  if (strength >= 48 || (decomp.hasRocket && decomp.bombCount >= 1) || decomp.effectiveTurns <= 4) {
    return 4;
  }
  if (strength >= 32 || decomp.bombCount >= 1 || decomp.hasRocket) {
    return 2;
  }
  return 1;
}

/** Generate deduplicated, strictly legal candidate plays for `hand` against `prevPattern`. */
export function generateCandidateMoves(hand: Card[], prevPattern: HandPattern | null): HandPattern[] {
  const plays = findBeatingPlays(hand, prevPattern);
  return plays.filter((p) => matchPatternToBeat(p.cards, prevPattern) !== null);
}

interface ScoredCandidate {
  isPass: boolean;
  cards: Card[];
  pattern: HandPattern | null;
  score: number;
}

function handHasPair(hand: Card[]): boolean {
  const counts = new Map<Rank, number>();
  for (const c of hand) {
    if (c.rank >= Rank.SMALL_JOKER) continue;
    const next = (counts.get(c.rank) ?? 0) + 1;
    if (next >= 2) return true;
    counts.set(c.rank, next);
  }
  return false;
}

function evaluateCandidateScore(
  state: GameState,
  seat: Seat,
  candidate: { isPass: boolean; pattern: HandPattern | null; cards: Card[] },
  difficulty: AIDifficulty,
  options?: ChooseMoveOptions,
): number {
  const hand = state.hands[seat];
  const landlordSeat = state.landlordSeat ?? 0;
  const pos = getPlayerPosition(seat, landlordSeat);
  const teammateSeat = getTeammateSeat(seat, landlordSeat);
  const prevPattern = state.lastPlay?.pattern ?? null;
  const prevSeat = state.lastPlay?.seat ?? null;
  const beforeDecomp = decomposeHand(hand);

  const opponents: Seat[] =
    pos === 'landlord' ? [nextSeat(landlordSeat), nextSeat(nextSeat(landlordSeat))] : [landlordSeat];
  const minOpponentCards = Math.min(...opponents.map((s) => state.hands[s].length));

  const canSeeMate =
    teammateSeat !== null && canSeeSeatHand(state, seat, teammateSeat, options);
  const farmerAssessment =
    pos === 'landlord'
      ? null
      : assessFarmerDynamicRole(state, seat, beforeDecomp, canSeeMate);
  const teammateCards = farmerAssessment?.teammateCards ?? 99;
  const farmerRole = farmerAssessment?.role ?? 'balanced';

  if (candidate.isPass) {
    let passScore = -6;

    // Teammate cooperation: yield to teammate who is near win, strong, or holds control
    if (teammateSeat !== null && prevSeat === teammateSeat && prevPattern) {
      const strongLead =
        prevPattern.type === 'BOMB' ||
        prevPattern.type === 'ROCKET' ||
        prevPattern.length >= 4 ||
        (prevPattern.type === 'SINGLE' && prevPattern.mainRank >= Rank.JACK) ||
        (prevPattern.type === 'PAIR' && prevPattern.mainRank >= Rank.TEN) ||
        (prevPattern.type === 'TRIPLE' && prevPattern.mainRank >= Rank.NINE);

      if (teammateCards <= 5 || strongLead || farmerRole === 'support') {
        passScore += farmerRole === 'support' ? 66 : 58;
      } else {
        passScore += 20;
      }
    } else if (prevSeat === landlordSeat && minOpponentCards <= 2) {
      passScore -= 48;
    } else if (pos === 'landlord' && minOpponentCards <= 2) {
      passScore -= 42;
    } else if (
      farmerRole === 'support' &&
      prevSeat === landlordSeat &&
      prevPattern &&
      (prevPattern.type === 'SINGLE' || prevPattern.type === 'PAIR') &&
      prevPattern.mainRank <= Rank.TEN
    ) {
      // Support farmer prefers bleeding landlord instead of passively letting landlord slip small cards
      passScore -= 10;
    }

    return passScore;
  }

  const pattern = candidate.pattern!;
  // Instant 1-turn win always takes absolute priority
  if (pattern.cards.length === hand.length) {
    return 100000;
  }

  const playedIds = new Set(pattern.cards.map((c) => c.id));
  const remaining = hand.filter((c) => !playedIds.has(c.id));
  const afterDecomp = decomposeHand(remaining);

  let score = 0;

  // 1. Hand structure improvement & turn reduction
  const turnDiff = beforeDecomp.effectiveTurns - afterDecomp.effectiveTurns;
  const structWeight = difficulty === 'casual' ? 10 : 14;
  const valueWeight = difficulty === 'casual' ? 0.6 : 0.9;
  score += turnDiff * structWeight + (afterDecomp.handValue - beforeDecomp.handValue) * valueWeight;

  if (prevPattern === null) {
    score += Math.min(pattern.cards.length, 6) * 2.2;
    score -= (pattern.mainRank - Rank.THREE) * 0.65;
  } else {
    // When following, prefer using the smallest sufficient card rather than overpaying
    score -= (pattern.mainRank - prevPattern.mainRank) * 0.95;
  }

  // 2. Preserve Bombs & Rocket unless tactical necessity
  if (pattern.type === 'BOMB') {
    if (prevPattern === null) {
      score -= 42;
    } else if (minOpponentCards > 4 && afterDecomp.effectiveTurns > 2) {
      score -= 26;
    } else if (minOpponentCards <= 2 && prevSeat !== teammateSeat) {
      score += 24;
    }
  } else if (pattern.type === 'ROCKET') {
    if (prevPattern === null) {
      score -= 48;
    } else if (minOpponentCards > 3 && afterDecomp.effectiveTurns > 2) {
      score -= 30;
    } else if (minOpponentCards <= 2 && prevSeat !== teammateSeat) {
      score += 26;
    }
  } else {
    if (beforeDecomp.bombCount > afterDecomp.bombCount) {
      score -= 44;
    }
    if (beforeDecomp.hasRocket && !afterDecomp.hasRocket) {
      score -= minOpponentCards === 1 ? 12 : 48;
    }
  }

  // 3. Dynamic Farmer Cooperation & Role-Specific Tactics
  const hasPair = teammateCards === 2 ? handHasPair(hand) : false;

  if (pos !== 'landlord') {
    if (prevPattern === null) {
      if (teammateCards === 1) {
        // ANY farmer (landlord_up OR landlord_down) feeds smallest single when teammate has 1 card left
        if (pattern.type === 'SINGLE') {
          score += 138 - pattern.mainRank * 4.5;
        } else {
          score -= 36;
        }
      } else if (teammateCards === 2) {
        // ANY farmer feeds smallest pair when teammate has 2 cards left
        if (pattern.type === 'PAIR') {
          score += 128 - pattern.mainRank * 4.5;
        } else if (hasPair) {
          score -= 22;
        }
      } else if (pos === 'landlord_up' || farmerRole === 'support') {
        // Guard / Support farmer: top with J..A to block/bleed landlord instead of leaking low singles
        const guardScale = farmerRole === 'support' ? 1.15 : 1.0;
        if (pattern.type === 'SINGLE') {
          if (pattern.mainRank >= Rank.JACK && pattern.mainRank <= Rank.ACE) {
            score += (28 + (pattern.mainRank - Rank.JACK) * 4) * guardScale;
          } else if (pattern.mainRank <= Rank.NINE) {
            score -= (26 + (Rank.TEN - pattern.mainRank) * 2) * guardScale;
          }
        } else if (pattern.type === 'PAIR') {
          if (pattern.mainRank >= Rank.JACK && pattern.mainRank <= Rank.ACE) {
            score += (18 + (pattern.mainRank - Rank.JACK) * 3) * guardScale;
          } else if (pattern.mainRank <= Rank.SEVEN) {
            score -= 14 * guardScale;
          }
        }
      } else if (farmerRole === 'attacker') {
        // Attacker farmer prioritizes shedding chains/triples efficiently to race to 0
        if (pattern.cards.length >= 4) {
          score += 8;
        }
      }
    } else if (prevSeat === landlordSeat && (farmerRole === 'support' || pos === 'landlord_up')) {
      // Support farmer actively tops landlord's low/medium leads with J..A to bleed landlord's 2/Jokers
      if (
        pattern.type === 'SINGLE' &&
        prevPattern.mainRank <= Rank.TEN &&
        pattern.mainRank >= Rank.JACK &&
        pattern.mainRank <= Rank.ACE
      ) {
        score += 16;
      } else if (
        pattern.type === 'PAIR' &&
        prevPattern.mainRank <= Rank.NINE &&
        pattern.mainRank >= Rank.TEN &&
        pattern.mainRank <= Rank.ACE
      ) {
        score += 14;
      }
    }

    // Do NOT overtake teammate unless finishing immediately or strictly better
    if (teammateSeat !== null && prevSeat === teammateSeat && prevPattern) {
      const strongLead =
        prevPattern.type === 'BOMB' ||
        prevPattern.type === 'ROCKET' ||
        prevPattern.length >= 4 ||
        (prevPattern.type === 'SINGLE' && prevPattern.mainRank >= Rank.JACK) ||
        (prevPattern.type === 'PAIR' && prevPattern.mainRank >= Rank.TEN);

      if (teammateCards <= 5 || strongLead || farmerRole === 'support') {
        score -= farmerRole === 'support' ? 70 : 62;
      } else if (pattern.mainRank >= Rank.TWO && afterDecomp.effectiveTurns > 1) {
        score -= 32;
      }
    }
  }

  // 4. Opponent alarm defense (防报单 / 防报双)
  if (minOpponentCards === 1 && prevPattern === null) {
    const feedingTeammate = teammateSeat !== null && teammateCards === 1;
    if (!feedingTeammate) {
      if (pattern.type === 'SINGLE') {
        score += pattern.mainRank >= Rank.KING ? 24 : -75 + pattern.mainRank * 3.5;
      } else {
        score += 28;
      }
    }
  } else if (minOpponentCards === 2 && prevPattern === null) {
    const feedingTeammate = teammateSeat !== null && teammateCards === 2 && hasPair;
    if (!feedingTeammate && pattern.type === 'PAIR') {
      score += pattern.mainRank >= Rank.KING ? 18 : -50 + pattern.mainRank * 2.5;
    }
  }

  // 5. Card counting bonus (Intermediate & Master only; Casual omits card counting)
  if (difficulty === 'master' || difficulty === 'intermediate') {
    const ext = computeExternalRemainingCounts(hand, state.moveHistory);
    const boss = isBossPattern(pattern, ext, true);
    if (boss && afterDecomp.effectiveTurns <= 1) {
      score += 95;
    } else if (boss && afterDecomp.effectiveTurns <= 2 && prevPattern === null) {
      score += 36;
    }

    if (difficulty === 'master' && pattern.type === 'BOMB') {
      const higherExtBombs = getExternalBombRanks(ext).some((r) => r > pattern.mainRank);
      if ((higherExtBombs || hasExternalRocket(ext)) && minOpponentCards > 3 && afterDecomp.effectiveTurns > 2) {
        score -= 14;
      }
    }
  }

  return score;
}

interface SimState {
  hands: [Card[], Card[], Card[]];
  turn: Seat;
  lastPlay: { seat: Seat; pattern: HandPattern } | null;
  passCount: number;
  landlord: Seat;
}

function getSimKey(sim: SimState): string {
  const lp = sim.lastPlay
    ? `${sim.lastPlay.seat}:${sim.lastPlay.pattern.type}:${sim.lastPlay.pattern.mainRank}:${sim.lastPlay.pattern.chainLength}:${sim.lastPlay.pattern.length}`
    : 'F';
  const h0 = sim.hands[0].map((c) => c.rank).join(',');
  const h1 = sim.hands[1].map((c) => c.rank).join(',');
  const h2 = sim.hands[2].map((c) => c.rank).join(',');
  return `${sim.turn}|${lp}|${sim.passCount}|${h0}/${h1}/${h2}`;
}

/**
 * Master-tier Alpha-Beta Endgame Solver.
 * Landlord maximizes (+1 = proven landlord win), Farmers minimize (-1 = proven farmer win).
 * Protected by strict node & wall-clock budgets so UI/worker stays instantaneous.
 */
export function solveEndgameAlphaBeta(
  state: GameState,
  seat: Seat,
  maxNodes = 12000,
  maxTimeMs = 150,
  maxHandLimit = 9,
): AIMoveDecision | null {
  if (state.landlordSeat === null || state.phase !== 'PLAYING') return null;

  const landlord = state.landlordSeat;
  const maxHand = Math.max(state.hands[0].length, state.hands[1].length, state.hands[2].length);
  const totalCards = state.hands[0].length + state.hands[1].length + state.hands[2].length;
  if (maxHand > maxHandLimit || totalCards > 21) return null;

  const startTime = Date.now();
  let nodes = 0;
  let aborted = false;
  const tt = new Map<string, number>();

  const rootSim: SimState = {
    hands: [[...state.hands[0]], [...state.hands[1]], [...state.hands[2]]],
    turn: seat,
    lastPlay: state.lastPlay,
    passCount: state.passCount,
    landlord,
  };

  const orderMoves = (hand: Card[], prev: HandPattern | null): HandPattern[] => {
    const moves = generateCandidateMoves(hand, prev);
    return moves.sort((a, b) => {
      if (a.cards.length === hand.length) return -1;
      if (b.cards.length === hand.length) return 1;
      if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;
      return b.mainRank - a.mainRank;
    });
  };

  const alphabeta = (sim: SimState, alpha: number, beta: number, depth: number): number => {
    nodes++;
    if ((nodes & 255) === 0 && (nodes >= maxNodes || Date.now() - startTime >= maxTimeMs)) {
      aborted = true;
      return 0;
    }
    if (nodes >= maxNodes) {
      aborted = true;
      return 0;
    }

    if (sim.hands[sim.landlord].length === 0) return 1;
    const f1 = nextSeat(sim.landlord);
    const f2 = nextSeat(f1);
    if (sim.hands[f1].length === 0 || sim.hands[f2].length === 0) return -1;
    if (depth >= 24) return 0;

    const key = getSimKey(sim);
    const cached = tt.get(key);
    if (cached !== undefined) return cached;

    const hand = sim.hands[sim.turn];
    const isMax = sim.turn === sim.landlord;
    const moves = orderMoves(hand, sim.lastPlay?.pattern ?? null);

    // Quick 1-ply win check
    if (moves.length > 0 && moves[0].cards.length === hand.length) {
      const val = isMax ? 1 : -1;
      tt.set(key, val);
      return val;
    }

    let best = isMax ? -2 : 2;

    for (const move of moves) {
      const playedIds = new Set(move.cards.map((c) => c.id));
      const nextHands: [Card[], Card[], Card[]] = [
        sim.turn === 0 ? hand.filter((c) => !playedIds.has(c.id)) : sim.hands[0],
        sim.turn === 1 ? hand.filter((c) => !playedIds.has(c.id)) : sim.hands[1],
        sim.turn === 2 ? hand.filter((c) => !playedIds.has(c.id)) : sim.hands[2],
      ];

      const val = alphabeta(
        {
          hands: nextHands,
          turn: nextSeat(sim.turn),
          lastPlay: { seat: sim.turn, pattern: move },
          passCount: 0,
          landlord: sim.landlord,
        },
        alpha,
        beta,
        depth + 1,
      );

      if (aborted) return 0;

      if (isMax) {
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (best === 1 || alpha >= beta) break;
      } else {
        if (val < best) best = val;
        if (best < beta) beta = best;
        if (best === -1 || alpha >= beta) break;
      }
    }

    // Try PASS if following
    if (sim.lastPlay !== null) {
      const nextPass = sim.passCount + 1;
      const reset = nextPass >= 2;
      const passVal = alphabeta(
        {
          hands: sim.hands,
          turn: nextSeat(sim.turn),
          lastPlay: reset ? null : sim.lastPlay,
          passCount: reset ? 0 : nextPass,
          landlord: sim.landlord,
        },
        alpha,
        beta,
        depth + 1,
      );
      if (aborted) return 0;
      if (isMax) {
        if (passVal > best) best = passVal;
      } else {
        if (passVal < best) best = passVal;
      }
    }

    if (!aborted) {
      tt.set(key, best);
    }
    return best;
  };

  const targetWin = seat === landlord ? 1 : -1;
  const rootHand = rootSim.hands[seat];
  const rootMoves = orderMoves(rootHand, rootSim.lastPlay?.pattern ?? null);

  let bestRootMove: { isPass: boolean; cards: Card[]; pattern: HandPattern | null } | null = null;
  let allResolved = true;

  for (const move of rootMoves) {
    if (move.cards.length === rootHand.length) {
      return {
        isPass: false,
        cards: move.cards,
        pattern: move,
        score: 100000,
        usedEndgameSolver: true,
        solvedOutcome: 'WIN',
      };
    }

    if (!bestRootMove) {
      bestRootMove = { isPass: false, cards: move.cards, pattern: move };
    }

    const playedIds = new Set(move.cards.map((c) => c.id));
    const nextHands: [Card[], Card[], Card[]] = [
      seat === 0 ? rootHand.filter((c) => !playedIds.has(c.id)) : rootSim.hands[0],
      seat === 1 ? rootHand.filter((c) => !playedIds.has(c.id)) : rootSim.hands[1],
      seat === 2 ? rootHand.filter((c) => !playedIds.has(c.id)) : rootSim.hands[2],
    ];

    const val = alphabeta(
      {
        hands: nextHands,
        turn: nextSeat(seat),
        lastPlay: { seat, pattern: move },
        passCount: 0,
        landlord,
      },
      -1,
      1,
      1,
    );

    if (aborted) return null;
    if (val === targetWin) {
      return {
        isPass: false,
        cards: move.cards,
        pattern: move,
        score: 50000,
        usedEndgameSolver: true,
        solvedOutcome: 'WIN',
      };
    }
    if (val !== -targetWin) {
      allResolved = false;
    }
  }

  // Also test PASS at root if following
  if (rootSim.lastPlay !== null) {
    if (!bestRootMove) {
      bestRootMove = { isPass: true, cards: [], pattern: null };
    }
    const nextPass = rootSim.passCount + 1;
    const reset = nextPass >= 2;
    const passVal = alphabeta(
      {
        hands: rootSim.hands,
        turn: nextSeat(seat),
        lastPlay: reset ? null : rootSim.lastPlay,
        passCount: reset ? 0 : nextPass,
        landlord,
      },
      -1,
      1,
      1,
    );
    if (!aborted && passVal === targetWin) {
      return {
        isPass: true,
        cards: [],
        pattern: null,
        score: 50000,
        usedEndgameSolver: true,
        solvedOutcome: 'WIN',
      };
    }
    if (aborted || passVal !== -targetWin) {
      allResolved = false;
    }
  }

  if (allResolved && bestRootMove) {
    return {
      ...bestRootMove,
      score: -50000,
      usedEndgameSolver: true,
      solvedOutcome: 'LOSS',
    };
  }

  return null;
}

function applyMoveToSim(
  sim: SimState,
  move: { isPass: boolean; cards: Card[]; pattern: HandPattern | null },
): SimState {
  if (move.isPass) {
    const nextPass = sim.passCount + 1;
    const reset = nextPass >= 2;
    return {
      hands: sim.hands,
      turn: nextSeat(sim.turn),
      lastPlay: reset ? null : sim.lastPlay,
      passCount: reset ? 0 : nextPass,
      landlord: sim.landlord,
    };
  }

  const playedIds = new Set(move.cards.map((c) => c.id));
  const nextHands: [Card[], Card[], Card[]] = [
    sim.turn === 0 ? sim.hands[0].filter((c) => !playedIds.has(c.id)) : sim.hands[0],
    sim.turn === 1 ? sim.hands[1].filter((c) => !playedIds.has(c.id)) : sim.hands[1],
    sim.turn === 2 ? sim.hands[2].filter((c) => !playedIds.has(c.id)) : sim.hands[2],
  ];

  return {
    hands: nextHands,
    turn: nextSeat(sim.turn),
    lastPlay: { seat: sim.turn, pattern: move.pattern! },
    passCount: 0,
    landlord: sim.landlord,
  };
}

function evaluateSampledWorldWinProb(sim: SimState, perspectiveSeat: Seat): number {
  const landlord = sim.landlord;
  const f1 = nextSeat(landlord);
  const f2 = nextSeat(f1);

  if (sim.hands[landlord].length === 0) {
    return perspectiveSeat === landlord ? 1 : 0;
  }
  if (sim.hands[f1].length === 0 || sim.hands[f2].length === 0) {
    return perspectiveSeat === landlord ? 0 : 1;
  }

  const dL = decomposeHand(sim.hands[landlord]);
  const d1 = decomposeHand(sim.hands[f1]);
  const d2 = decomposeHand(sim.hands[f2]);

  const lControlBonus = sim.turn === landlord && sim.lastPlay === null ? 5.5 : 0;
  const fControlBonus = sim.turn !== landlord && sim.lastPlay === null ? 5.5 : 0;
  const lUrgency = sim.hands[landlord].length <= 2 ? (3 - sim.hands[landlord].length) * 7 : 0;
  const minFarmerLen = Math.min(sim.hands[f1].length, sim.hands[f2].length);
  const fUrgency = minFarmerLen <= 2 ? (3 - minFarmerLen) * 7 : 0;

  const landlordScore = dL.handValue + lControlBonus + lUrgency - sim.hands[landlord].length * 0.55;
  const bestFarmer = Math.max(d1.handValue, d2.handValue);
  const supportFarmer = Math.min(d1.handValue, d2.handValue);
  const farmerScore =
    bestFarmer + (supportFarmer - 12) * 0.25 + fControlBonus + fUrgency - minFarmerLen * 0.55;

  const diff = landlordScore - farmerScore;
  const landlordProb = 1 / (1 + Math.exp(-diff / 11));
  return perspectiveSeat === landlord ? landlordProb : 1 - landlordProb;
}

/**
 * Ultra-fast tactical rollout policy used inside PIMC midgame lookahead.
 * Runs without `decomposeHand` per move to stay comfortably inside <100ms total budget.
 */
function pickFastRolloutMove(
  sim: SimState,
): { isPass: boolean; cards: Card[]; pattern: HandPattern | null } {
  const hand = sim.hands[sim.turn];
  const prev = sim.lastPlay?.pattern ?? null;
  const prevSeat = sim.lastPlay?.seat ?? null;
  const moves = findBeatingPlays(hand, prev);

  if (moves.length === 0) {
    return { isPass: true, cards: [], pattern: null };
  }

  // Immediate win
  for (const m of moves) {
    if (m.cards.length === hand.length) {
      return { isPass: false, cards: m.cards, pattern: m };
    }
  }

  const isLandlord = sim.turn === sim.landlord;
  const teammate = isLandlord ? null : getTeammateSeat(sim.turn, sim.landlord);
  const teammateCards = teammate !== null ? sim.hands[teammate].length : 99;
  const minOppCards = isLandlord
    ? Math.min(sim.hands[nextSeat(sim.landlord)].length, sim.hands[nextSeat(nextSeat(sim.landlord))].length)
    : sim.hands[sim.landlord].length;

  let bestScore = -1e9;
  let bestMove: { isPass: boolean; cards: Card[]; pattern: HandPattern | null } = {
    isPass: false,
    cards: moves[0].cards,
    pattern: moves[0],
  };

  if (prev !== null) {
    let passScore = -4;
    if (teammate !== null && prevSeat === teammate) {
      if (teammateCards <= 4 || prev.mainRank >= Rank.JACK || prev.length >= 4) {
        passScore += 48;
      } else {
        passScore += 15;
      }
    } else if (minOppCards <= 2 && prevSeat !== teammate) {
      passScore -= 42;
    }
    bestScore = passScore;
    bestMove = { isPass: true, cards: [], pattern: null };
  }

  for (const m of moves) {
    let sc = m.cards.length * 4.2;
    if (prev === null) {
      sc -= (m.mainRank - Rank.THREE) * 0.7;
      if (teammate !== null && teammateCards === 1) {
        sc += m.type === 'SINGLE' ? 110 - m.mainRank * 4 : -25;
      } else if (teammate !== null && teammateCards === 2 && m.type === 'PAIR') {
        sc += 100 - m.mainRank * 4;
      } else if (!isLandlord && sim.turn === nextSeat(nextSeat(sim.landlord)) && m.type === 'SINGLE') {
        // landlord_up guard
        if (m.mainRank >= Rank.JACK && m.mainRank <= Rank.ACE) sc += 20;
        else if (m.mainRank <= Rank.NINE) sc -= 18;
      }
      if (minOppCards === 1 && !(teammate !== null && teammateCards === 1) && m.type === 'SINGLE') {
        sc += m.mainRank >= Rank.KING ? 18 : -50;
      }
    } else {
      sc -= (m.mainRank - prev.mainRank) * 1.1;
      if (teammate !== null && prevSeat === teammate) {
        if (teammateCards <= 4 || prev.mainRank >= Rank.JACK || prev.length >= 4) {
          sc -= 50;
        } else if (m.mainRank >= Rank.TWO) {
          sc -= 25;
        }
      }
    }

    if (m.type === 'BOMB') {
      sc += prev !== null && minOppCards <= 2 && prevSeat !== teammate ? 22 : -36;
    } else if (m.type === 'ROCKET') {
      sc += prev !== null && minOppCards <= 2 && prevSeat !== teammate ? 24 : -42;
    }

    if (sc > bestScore) {
      bestScore = sc;
      bestMove = { isPass: false, cards: m.cards, pattern: m };
    }
  }

  return bestMove;
}

function runPimcLookahead(
  state: GameState,
  seat: Seat,
  candidates: ScoredCandidate[],
  rng: () => number,
): AIMoveDecision {
  const startTime = Date.now();
  const BUDGET_MS = 95;
  const landlord = state.landlordSeat ?? 0;
  const prevPattern = state.lastPlay?.pattern ?? null;

  const maxHand = Math.max(state.hands[0].length, state.hands[1].length, state.hands[2].length);
  const totalCards = state.hands[0].length + state.hands[1].length + state.hands[2].length;
  const isEndgame = maxHand <= 8 && totalCards <= 19;

  // Select top competitive candidates (wider window in endgame to catch non-greedy traps)
  const scoreWindow = isEndgame ? 65 : 36;
  const competitive = candidates.filter((c) => c.score >= candidates[0].score - scoreWindow);
  const pool: ScoredCandidate[] = competitive.slice(0, Math.min(6, competitive.length));
  if (prevPattern !== null) {
    const passCand = candidates.find((c) => c.isPass);
    if (passCand && !pool.includes(passCand) && passCand.score >= candidates[0].score - 45) {
      pool.push(passCand);
    }
  }
  if (pool.length <= 1) {
    return {
      ...candidates[0],
      usedEndgameSolver: false,
    };
  }

  const sampleCount = 8;
  const determinizedHands = sampleDeterminizedHands(state, seat, sampleCount, rng);

  const winSums = new Array<number>(pool.length).fill(0);
  const sampleCounts = new Array<number>(pool.length).fill(0);
  const myIsLandlord = seat === landlord;

  for (let sIdx = 0; sIdx < determinizedHands.length; sIdx++) {
    if (sIdx > 0 && Date.now() - startTime >= BUDGET_MS) {
      break;
    }
    const sampledHands = determinizedHands[sIdx];
    const baseSim: SimState = {
      hands: sampledHands,
      turn: seat,
      lastPlay: state.lastPlay,
      passCount: state.passCount,
      landlord,
    };

    for (let cIdx = 0; cIdx < pool.length; cIdx++) {
      if (Date.now() - startTime >= BUDGET_MS) {
        break;
      }

      const cand = pool[cIdx];
      let sim = applyMoveToSim(baseSim, cand);
      let winProb: number;

      if (sim.hands[seat].length === 0) {
        winProb = 1.0;
      } else if (isEndgame) {
        const simState: GameState = {
          ...state,
          phase: 'PLAYING',
          hands: sim.hands,
          currentTurn: sim.turn,
          lastPlay: sim.lastPlay,
          passCount: sim.passCount,
        };
        const solved = solveEndgameAlphaBeta(simState, sim.turn, 2200, 10, 9);
        if (solved && (solved.solvedOutcome === 'WIN' || solved.solvedOutcome === 'LOSS')) {
          const turnIsMySide = (sim.turn === landlord) === myIsLandlord;
          if (solved.solvedOutcome === 'WIN') {
            winProb = turnIsMySide ? 1.0 : 0.0;
          } else {
            winProb = turnIsMySide ? 0.0 : 1.0;
          }
        } else {
          winProb = evaluateSampledWorldWinProb(sim, seat);
        }
      } else {
        // 3-ply rollout after our move (4 total plies including root move)
        const f1 = nextSeat(landlord);
        const f2 = nextSeat(f1);
        let finished = false;
        for (let step = 0; step < 3; step++) {
          if (
            sim.hands[landlord].length === 0 ||
            sim.hands[f1].length === 0 ||
            sim.hands[f2].length === 0
          ) {
            finished = true;
            break;
          }
          const rolloutMove = pickFastRolloutMove(sim);
          sim = applyMoveToSim(sim, rolloutMove);
        }
        if (
          finished ||
          sim.hands[landlord].length === 0 ||
          sim.hands[f1].length === 0 ||
          sim.hands[f2].length === 0
        ) {
          const landlordWon = sim.hands[landlord].length === 0;
          winProb = landlordWon === myIsLandlord ? 1.0 : 0.0;
        } else {
          winProb = evaluateSampledWorldWinProb(sim, seat);
        }
      }

      winSums[cIdx] += winProb;
      sampleCounts[cIdx] += 1;
    }
  }

  let bestIdx = 0;
  let bestCombined = -1e9;
  for (let cIdx = 0; cIdx < pool.length; cIdx++) {
    const cnt = sampleCounts[cIdx];
    const avgProb = cnt > 0 ? winSums[cIdx] / cnt : 0.5;
    // Combine sampled win probability (0..1000) with heuristic prior
    const combined = avgProb * 1000 + pool[cIdx].score * 0.6;
    if (combined > bestCombined) {
      bestCombined = combined;
      bestIdx = cIdx;
    }
  }

  const chosen = pool[bestIdx];
  return {
    ...chosen,
    usedEndgameSolver: false,
  };
}

/**
 * Choose the best play or pass for `seat` according to `difficulty`.
 * - `casual`: shallow heuristic + controlled random mistakes
 * - `intermediate`: full hand decomposition + card counting + 1-ply dynamic farmer cooperation
 * - `master`:
 *    - puzzle / all-mingpai: exact Alpha-Beta endgame solver
 *    - standard hidden-hand: zero peeking; belief-weighted PIMC lookahead (rollout / endgame voting)
 */
export function chooseBestMove(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
  rng: () => number = Math.random,
  options?: ChooseMoveOptions,
): AIMoveDecision {
  const hand = state.hands[seat];
  const prevPattern = state.lastPlay?.pattern ?? null;

  // Only invoke open-hand Alpha-Beta directly when all hands are publicly visible (puzzle or all mingpai)
  if (difficulty === 'master' && isPerfectInformationGame(state, seat, options)) {
    const solved = solveEndgameAlphaBeta(state, seat);
    if (solved && solved.solvedOutcome === 'WIN') return solved;
  }

  const candidates: ScoredCandidate[] = generateCandidateMoves(hand, prevPattern).map((pattern) => ({
    isPass: false,
    cards: pattern.cards,
    pattern,
    score: evaluateCandidateScore(
      state,
      seat,
      { isPass: false, pattern, cards: pattern.cards },
      difficulty,
      options,
    ),
  }));

  if (prevPattern !== null) {
    candidates.push({
      isPass: true,
      cards: [],
      pattern: null,
      score: evaluateCandidateScore(
        state,
        seat,
        { isPass: true, pattern: null, cards: [] },
        difficulty,
        options,
      ),
    });
  }

  if (candidates.length === 0) {
    return {
      isPass: true,
      cards: [],
      pattern: null,
      score: 0,
      usedEndgameSolver: false,
    };
  }

  candidates.sort((a, b) => b.score - a.score);

  // Instant 1-turn win is never randomized or delayed
  if (candidates[0].score >= 90000 || candidates.length === 1) {
    return {
      ...candidates[0],
      usedEndgameSolver: false,
    };
  }

  if (difficulty === 'casual') {
    const pool = candidates
      .slice(0, Math.min(4, candidates.length))
      .filter((c) => c.score >= candidates[0].score - 28);
    if (pool.length > 1) {
      const picked = pool[Math.floor(rng() * pool.length)];
      return {
        ...picked,
        usedEndgameSolver: false,
      };
    }
    return {
      ...candidates[0],
      usedEndgameSolver: false,
    };
  }

  if (difficulty === 'master') {
    return runPimcLookahead(state, seat, candidates, rng);
  }

  // Intermediate: 1-ply full heuristic + card counting + farmer synergy
  return {
    ...candidates[0],
    usedEndgameSolver: false,
  };
}

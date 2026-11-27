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
import { decomposeHand } from './decomposer';
import {
  computeExternalRemainingCounts,
  getExternalBombRanks,
  hasExternalRocket,
  isBossPattern,
} from './cardCounter';
import { nextSeat } from './gameLoop';

export type AIDifficulty = 'casual' | 'intermediate' | 'master';
export type PlayerPosition = 'landlord' | 'landlord_down' | 'landlord_up';

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
  const hasSJ = counts.has(Rank.SMALL_JOKER);
  const hasBJ = counts.has(Rank.BIG_JOKER);

  // Hand strength metric for bidding
  let bidScore = decomp.controlValue * 1.4 - decomp.effectiveTurns * 1.1 + twos * 0.6;
  if (hasBJ) bidScore += 1.2;
  if (hasSJ) bidScore += 0.8;
  if (difficulty === 'casual') {
    bidScore += 0.5;
  }

  if (state.firstCallerSeat === null) {
    return bidScore >= -1.5 ? 'CALL' : 'PASS';
  }

  const grabThreshold = 1.5 + state.grabCount * 2.5;
  return bidScore >= grabThreshold ? 'GRAB' : 'PASS';
}

/** Decide whether AI chooses 1x / 2x / 4x during DOUBLING. */
export function decideDoubleChoice(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'intermediate',
): DoubleChoice {
  const decomp = decomposeHand(state.hands[seat]);
  const isLandlord = seat === state.landlordSeat;
  const strength = decomp.handValue + (isLandlord ? 3 : 0);

  if (difficulty === 'casual') {
    return strength >= 40 ? 2 : 1;
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

function evaluateCandidateScore(
  state: GameState,
  seat: Seat,
  candidate: { isPass: boolean; pattern: HandPattern | null; cards: Card[] },
  difficulty: AIDifficulty,
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
  const teammateCards = teammateSeat !== null ? state.hands[teammateSeat].length : 99;

  if (candidate.isPass) {
    let passScore = -6;

    // Teammate cooperation: do NOT fight teammate who holds strong/low-card control
    if (teammateSeat !== null && prevSeat === teammateSeat && prevPattern) {
      const strongLead =
        prevPattern.type === 'BOMB' ||
        prevPattern.type === 'ROCKET' ||
        prevPattern.length >= 4 ||
        (prevPattern.type === 'SINGLE' && prevPattern.mainRank >= Rank.JACK) ||
        (prevPattern.type === 'PAIR' && prevPattern.mainRank >= Rank.TEN) ||
        (prevPattern.type === 'TRIPLE' && prevPattern.mainRank >= Rank.NINE);

      if (teammateCards <= 5 || strongLead) {
        passScore += 58;
      } else {
        passScore += 18;
      }
    } else if (prevSeat === landlordSeat && minOpponentCards <= 2) {
      // Opponent (landlord) is about to win; passing is terrible if we could block
      passScore -= 45;
    } else if (pos === 'landlord' && minOpponentCards <= 2) {
      passScore -= 40;
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
  score += turnDiff * 14 + (afterDecomp.handValue - beforeDecomp.handValue) * 0.9;

  // Prefer shedding low/multi-card patterns cleanly when leading
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
    // Penalize breaking an existing bomb or rocket
    if (beforeDecomp.bombCount > afterDecomp.bombCount) {
      score -= 44;
    }
    if (beforeDecomp.hasRocket && !afterDecomp.hasRocket) {
      score -= minOpponentCards === 1 ? 12 : 48;
    }
  }

  // 3. Role-specific tactics
  if (pos === 'landlord_up') {
    const downSeat = nextSeat(landlordSeat);
    const downCards = state.hands[downSeat].length;

    if (prevPattern === null) {
      if (downCards === 1) {
        // Feed smallest single to 1-card teammate
        if (pattern.type === 'SINGLE') {
          score += 135 - pattern.mainRank * 4.5;
        } else {
          score -= 35;
        }
      } else if (downCards === 2) {
        // Feed smallest pair to 2-card teammate
        if (pattern.type === 'PAIR') {
          score += 125 - pattern.mainRank * 4.5;
        }
      } else {
        // 守门员顶牌 (Guard/Top against landlord): block small singles/pairs
        if (pattern.type === 'SINGLE') {
          if (pattern.mainRank >= Rank.JACK && pattern.mainRank <= Rank.ACE) {
            score += 28 + (pattern.mainRank - Rank.JACK) * 4;
          } else if (pattern.mainRank <= Rank.NINE) {
            score -= 26 + (Rank.TEN - pattern.mainRank) * 2;
          }
        } else if (pattern.type === 'PAIR') {
          if (pattern.mainRank >= Rank.JACK && pattern.mainRank <= Rank.ACE) {
            score += 18 + (pattern.mainRank - Rank.JACK) * 3;
          } else if (pattern.mainRank <= Rank.SEVEN) {
            score -= 14;
          }
        }
      }
    }
  }

  // Teammate cooperation when following teammate
  if (teammateSeat !== null && prevSeat === teammateSeat && prevPattern) {
    const strongLead =
      prevPattern.type === 'BOMB' ||
      prevPattern.type === 'ROCKET' ||
      prevPattern.length >= 4 ||
      (prevPattern.type === 'SINGLE' && prevPattern.mainRank >= Rank.JACK) ||
      (prevPattern.type === 'PAIR' && prevPattern.mainRank >= Rank.TEN);

    if (teammateCards <= 5 || strongLead) {
      score -= 62;
    } else if (pattern.mainRank >= Rank.TWO) {
      score -= 32;
    }
  }

  // 4. Opponent alarm defense (防报单 / 防报双)
  if (minOpponentCards === 1 && prevPattern === null) {
    const feedingTeammate = pos === 'landlord_up' && teammateCards === 1;
    if (!feedingTeammate) {
      if (pattern.type === 'SINGLE') {
        score += pattern.mainRank >= Rank.KING ? 24 : -75 + pattern.mainRank * 3.5;
      } else {
        score += 28;
      }
    }
  } else if (minOpponentCards === 2 && prevPattern === null) {
    const feedingTeammate = pos === 'landlord_up' && teammateCards === 2;
    if (!feedingTeammate && pattern.type === 'PAIR') {
      score += pattern.mainRank >= Rank.KING ? 18 : -50 + pattern.mainRank * 2.5;
    }
  }

  // 5. Card counting bonus (Intermediate uses basic awareness; Master uses full external counts)
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

/**
 * Choose the best play or pass for `seat` according to `difficulty`.
 */
export function chooseBestMove(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
  rng: () => number = Math.random,
): AIMoveDecision {
  const hand = state.hands[seat];
  const prevPattern = state.lastPlay?.pattern ?? null;

  if (difficulty === 'master') {
    const solved = solveEndgameAlphaBeta(state, seat);
    if (solved && solved.solvedOutcome === 'WIN') return solved;
  }

  const candidates: ScoredCandidate[] = generateCandidateMoves(hand, prevPattern).map((pattern) => ({
    isPass: false,
    cards: pattern.cards,
    pattern,
    score: evaluateCandidateScore(state, seat, { isPass: false, pattern, cards: pattern.cards }, difficulty),
  }));

  if (prevPattern !== null) {
    candidates.push({
      isPass: true,
      cards: [],
      pattern: null,
      score: evaluateCandidateScore(state, seat, { isPass: true, pattern: null, cards: [] }, difficulty),
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

  // Instant win is never randomized even on casual
  if (candidates[0].score >= 90000) {
    return {
      ...candidates[0],
      usedEndgameSolver: false,
    };
  }

  if (difficulty === 'casual' && candidates.length > 1) {
    const pool = candidates.slice(0, Math.min(3, candidates.length)).filter((c) => c.score >= candidates[0].score - 22);
    if (pool.length > 1) {
      const picked = pool[Math.floor(rng() * pool.length)];
      return {
        ...picked,
        usedEndgameSolver: false,
      };
    }
  }

  return {
    ...candidates[0],
    usedEndgameSolver: false,
  };
}

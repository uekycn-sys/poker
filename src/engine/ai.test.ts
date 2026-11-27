import { describe, expect, it } from 'vitest';
import {
  AIDifficulty,
  GameState,
  Rank,
  Seat,
  analyzeCoachRecommendation,
  analyzeMatchBlunders,
  applyBidAction,
  applyDoubleChoice,
  applyPassTurn,
  applyPlayCards,
  chooseBestMove,
  computeExternalRemainingCounts,
  decideBidAction,
  decideDoubleChoice,
  decomposeHand,
  evaluateWinRate,
  getExternalBombRanks,
  hasExternalRocket,
  isBossPattern,
  analyzeHand,
  parseCards,
  startNewMatch,
} from './index';

function makePlayingState(
  hands: [ReturnType<typeof parseCards>, ReturnType<typeof parseCards>, ReturnType<typeof parseCards>],
  landlordSeat: Seat,
  currentTurn: Seat,
  lastPlay: GameState['lastPlay'] = null,
): GameState {
  const base = startNewMatch(100, 0);
  return {
    ...base,
    phase: 'PLAYING',
    hands,
    landlordSeat,
    currentTurn,
    lastPlay,
    doubleChoices: [1, 1, 1],
  };
}

describe('Hand Decomposer & Card Counter', () => {
  it('keeps straights and bombs intact and absorbs kickers accurately', () => {
    const d1 = decomposeHand(parseCards('3 4 5 6 7 8 8 8 8'));
    expect(d1.bombCount).toBe(1);
    expect(d1.effectiveTurns).toBe(2);
    expect(d1.groups.some((g) => g.type === 'STRAIGHT' && g.chainLength === 5)).toBe(true);
    expect(d1.groups.some((g) => g.type === 'BOMB' && g.mainRank === Rank.EIGHT)).toBe(true);

    const d2 = decomposeHand(parseCards('3 3 3 4 4 4 7 9'));
    expect(d2.effectiveTurns).toBe(1);
    expect(d2.groups.some((g) => g.type === 'AIRPLANE' && g.chainLength === 2)).toBe(true);
  });

  it('tracks external remaining counts, bombs, rocket, and boss patterns', () => {
    const myHand = parseCards('2 2 A K Q');
    const dummyState = makePlayingState([myHand, parseCards('3'), parseCards('4')], 0, 0);
    const played = applyPlayCards(dummyState, 0, parseCards('A'));

    const ext = computeExternalRemainingCounts(
      parseCards('2 2 K Q'),
      played.moveHistory,
    );
    expect(ext[Rank.TWO]).toBe(2);
    expect(ext[Rank.ACE]).toBe(3);
    expect(hasExternalRocket(ext)).toBe(true);
    expect(getExternalBombRanks(ext)).toContain(Rank.THREE);

    // Clear jokers and external bombs in a synthetic ext count to verify boss single
    const extNoThreat = { ...ext };
    extNoThreat[Rank.SMALL_JOKER] = 0;
    extNoThreat[Rank.BIG_JOKER] = 0;
    for (let r = Rank.THREE; r <= Rank.TWO; r++) {
      if (extNoThreat[r as Rank] === 4) extNoThreat[r as Rank] = 3;
    }
    extNoThreat[Rank.TWO] = 0;
    expect(isBossPattern(analyzeHand(parseCards('2')), extNoThreat, true)).toBe(true);
    expect(isBossPattern(analyzeHand(parseCards('K')), extNoThreat, true)).toBe(false);
  });
});

describe('Role-Aware & Cooperative AI Tactics', () => {
  it('landlord_up tops with high single (K/A) against landlord instead of leaking 3', () => {
    // Seat 0 = landlord (10 cards -> midgame), Seat 2 = landlord_up (holds 3 4 5 K A)
    const state = makePlayingState(
      [
        parseCards('3 4 5 6 7 8 9 10 J Q'),
        parseCards('6 7 8 9 10 J'),
        parseCards('3 4 5 K A'),
      ],
      0,
      2,
    );
    const move = chooseBestMove(state, 2, 'master');
    expect(move.isPass).toBe(false);
    expect(move.pattern?.type).toBe('SINGLE');
    expect(move.pattern!.mainRank).toBeGreaterThanOrEqual(Rank.JACK);
  });

  it('landlord_up feeds smallest single when landlord_down teammate has 1 card left', () => {
    // Seat 0 = landlord, Seat 1 = landlord_down (1 card), Seat 2 = landlord_up
    const state = makePlayingState(
      [
        parseCards('4 5 6 7 8 9 10 J Q K'),
        parseCards('Q'),
        parseCards('3 K A'),
      ],
      0,
      2,
    );
    const move = chooseBestMove(state, 2, 'master');
    expect(move.isPass).toBe(false);
    expect(move.pattern?.type).toBe('SINGLE');
    expect(move.pattern?.mainRank).toBe(Rank.THREE);
  });

  it('landlord_up passes instead of overtaking teammate who played A with 2 cards left', () => {
    const prev = analyzeHand(parseCards('A'));
    const state = makePlayingState(
      [
        parseCards('4 5 6 7 8 9 10 J Q K'),
        parseCards('9 10'),
        parseCards('2 8 7'),
      ],
      0,
      2,
      { seat: 1, pattern: prev },
    );
    const move = chooseBestMove(state, 2, 'master');
    expect(move.isPass).toBe(true);
  });

  it('landlord blocks alarm by avoiding small single lead when a farmer has 1 card left', () => {
    const state = makePlayingState(
      [
        parseCards('3 4 9 9 K'),
        parseCards('A'),
        parseCards('5 6 7 8 10 J Q K A'),
      ],
      0,
      0,
    );
    const move = chooseBestMove(state, 0, 'intermediate');
    expect(move.isPass).toBe(false);
    const playedLowSingle = move.pattern?.type === 'SINGLE' && move.pattern.mainRank < Rank.KING;
    expect(playedLowSingle).toBe(false);
  });
});

describe('Master Alpha-Beta Endgame Solver & AI Coach', () => {
  it('solves non-greedy forced win endgame via Alpha-Beta pruning', () => {
    // Landlord (seat 0): 2 5 5; Farmer 1: K 4; Farmer 2: 6 6.
    // Greedy 55 loses to Farmer 2's 66; playing 2 first secures boss lead and wins with 55!
    const state = makePlayingState(
      [parseCards('2 5 5'), parseCards('K 4'), parseCards('6 6')],
      0,
      0,
    );
    const decision = chooseBestMove(state, 0, 'master');
    expect(decision.usedEndgameSolver).toBe(true);
    expect(decision.solvedOutcome).toBe('WIN');
    expect(decision.isPass).toBe(false);
    expect(decision.pattern?.type).toBe('SINGLE');
    expect(decision.pattern?.mainRank).toBe(Rank.TWO);
  });

  it('evaluates win rate, provides Chinese tactical coach advice, and detects blunders', () => {
    const strongLandlordState = makePlayingState(
      [
        parseCards('SJ BJ 2 2 2 2 A'),
        parseCards('3 4 6 7 9 10 J K 3 5 8'),
        parseCards('3 4 6 7 9 10 Q K 4 5 8'),
      ],
      0,
      0,
    );
    const wr = evaluateWinRate(strongLandlordState, 0);
    expect(wr.landlordWinRate).toBeGreaterThan(75);
    expect(wr.landlordWinRate + wr.farmerWinRate).toBeCloseTo(100, 1);

    const advice = analyzeCoachRecommendation(strongLandlordState, 0);
    expect(advice.reason.length).toBeGreaterThan(10);
    expect(advice.tags.length).toBeGreaterThan(0);

    // Blunder test: landlord has 2 5 5, plays 5 5 (blunder) and loses to Farmer 2's 6 6
    let blunderMatch = makePlayingState(
      [parseCards('2 5 5'), parseCards('K 4'), parseCards('6 6')],
      0,
      0,
    );
    blunderMatch = applyPlayCards(blunderMatch, 0, parseCards('5 5'));
    blunderMatch = applyPassTurn(blunderMatch, 1);
    blunderMatch = applyPlayCards(blunderMatch, 2, parseCards('6 6'));
    expect(blunderMatch.phase).toBe('FINISHED');

    const blunders = analyzeMatchBlunders(blunderMatch, 0, 3);
    expect(blunders.length).toBeGreaterThanOrEqual(1);
    expect(blunders[0].moveIndex).toBe(0);
    expect(blunders[0].bestPattern?.mainRank).toBe(Rank.TWO);
    expect(blunders[0].winRateDrop).toBeGreaterThan(10);
  });
});

describe('30-Game Full 3-AI Simulation Stress Test', () => {
  function runFullAISimulation(difficulty: AIDifficulty, seedInit: number): GameState {
    let seed = seedInit;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let state = startNewMatch(100, (seedInit % 3) as Seat, rng);

    let bidGuard = 0;
    while (state.phase === 'BIDDING') {
      expect(bidGuard++).toBeLessThan(30);
      const seat = state.currentTurn;
      const bid = decideBidAction(state, seat, difficulty);
      state = applyBidAction(state, seat, bid, rng);
    }

    let doubleGuard = 0;
    while (state.phase === 'DOUBLING') {
      expect(doubleGuard++).toBeLessThan(6);
      const seat = state.currentTurn;
      const dbl = decideDoubleChoice(state, seat, difficulty);
      state = applyDoubleChoice(state, seat, dbl);
    }

    let playGuard = 0;
    while (state.phase === 'PLAYING') {
      expect(playGuard++).toBeLessThan(200);
      const seat = state.currentTurn;
      const move = chooseBestMove(state, seat, difficulty, rng);
      if (move.isPass) {
        state = applyPassTurn(state, seat);
      } else {
        state = applyPlayCards(state, seat, move.cards);
      }
    }

    expect(state.phase).toBe('FINISHED');
    expect(state.settlement).not.toBeNull();
    const deltas = state.settlement!.beanDeltas;
    expect(deltas[0] + deltas[1] + deltas[2]).toBe(0);
    return state;
  }

  it('completes 30 full AI matches (10 casual, 10 intermediate, 10 master) with 0 illegal moves', () => {
    const difficulties: AIDifficulty[] = ['casual', 'intermediate', 'master'];
    let totalMatches = 0;

    for (let dIdx = 0; dIdx < difficulties.length; dIdx++) {
      const diff = difficulties[dIdx];
      for (let i = 0; i < 10; i++) {
        const finalState = runFullAISimulation(diff, 1000 + dIdx * 100 + i);
        expect(finalState.settlement).not.toBeNull();
        totalMatches++;
      }
    }

    expect(totalMatches).toBe(30);
  });
});

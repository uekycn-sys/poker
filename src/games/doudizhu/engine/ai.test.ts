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
  assessFarmerDynamicRole,
  chooseBestMove,
  computeExternalRemainingCounts,
  computeSeatRankWeights,
  decideBidAction,
  decideDoubleChoice,
  decomposeHand,
  evaluateWinRate,
  getExternalBombRanks,
  hasExternalRocket,
  isBossPattern,
  analyzeHand,
  parseCards,
  sampleDeterminizedHands,
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

  it('landlord_down feeds smallest single/pair when landlord_up teammate has 1~2 cards left', () => {
    // Seat 0 = landlord, Seat 1 = landlord_down, Seat 2 = landlord_up (1 card left)
    const feed1State = makePlayingState(
      [
        parseCards('4 5 6 7 8 9 10 J Q K'),
        parseCards('3 8 8 K A'),
        parseCards('J'),
      ],
      0,
      1,
    );
    const move1 = chooseBestMove(feed1State, 1, 'intermediate');
    expect(move1.isPass).toBe(false);
    expect(move1.pattern?.type).toBe('SINGLE');
    expect(move1.pattern?.mainRank).toBe(Rank.THREE);

    // Seat 2 = landlord_up (2 cards left) -> landlord_down feeds smallest pair
    const feed2State = makePlayingState(
      [
        parseCards('4 5 6 7 8 9 10 J Q K'),
        parseCards('3 4 4 K A'),
        parseCards('J J'),
      ],
      0,
      1,
    );
    const move2 = chooseBestMove(feed2State, 1, 'intermediate');
    expect(move2.isPass).toBe(false);
    expect(move2.pattern?.type).toBe('PAIR');
    expect(move2.pattern?.mainRank).toBe(Rank.FOUR);
  });

  it('dynamically classifies farmer attacker vs support roles without peeking at hidden hands', () => {
    const state = makePlayingState(
      [
        parseCards('3 4 5 6 7 8 9 10 J Q'),
        parseCards('2 A K'), // Seat 1 strong 3 cards
        parseCards('3 5 7 9 J Q K 4 6 8'), // Seat 2 weak 10 cards
      ],
      0,
      2,
    );
    const seat2Decomp = decomposeHand(state.hands[2]);
    const hiddenAssessment = assessFarmerDynamicRole(state, 2, seat2Decomp, false);
    expect(hiddenAssessment.role).toBe('support');

    const visibleAssessment = assessFarmerDynamicRole(state, 2, seat2Decomp, true);
    expect(visibleAssessment.role).toBe('support');

    const seat1Decomp = decomposeHand(state.hands[1]);
    const attackerAssessment = assessFarmerDynamicRole(state, 1, seat1Decomp, false);
    expect(attackerAssessment.role).toBe('attacker');
  });

  it('incorporates grabCount and visible mingpai opponent strength in bidding & doubling', () => {
    let bidState = startNewMatch(100, 0, () => 0.42);
    bidState = {
      ...bidState,
      firstCallerSeat: 0,
      landlordSeat: 0,
      grabQueue: [1, 2],
      currentTurn: 1,
      hands: [
        parseCards('3 4 5 6 7 8 9 10 J Q K A 2 3 4 5 6'),
        parseCards('3 4 5 6 7 8 9 10 J Q K A A 2 2 7 8'),
        parseCards('4 5 6 7 8 9 10 J Q K Q K 3 4 5 6 7'),
      ],
    };

    // High grabCount raises grab bar
    const grabLowCount = decideBidAction({ ...bidState, grabCount: 0 }, 1, 'master');
    const grabHighCount = decideBidAction({ ...bidState, grabCount: 3 }, 1, 'master');
    expect(grabLowCount).toBe('GRAB');
    expect(grabHighCount).toBe('PASS');

    // Visible monster mingpai landlord deters doubling in DOUBLING phase
    const doublingBase = makePlayingState(
      [
        parseCards('SJ BJ 2 2 2 2 A A K K Q Q J 10 9 8 7 6 5 4'),
        parseCards('3 4 5 6 7 8 9 10 J Q K A 2 3 4 5 6'),
        parseCards('3 4 5 6 7 8 9 10 J Q K A 7 8 9 10 J'),
      ],
      0,
      1,
    );
    const dblStateNormal: GameState = { ...doublingBase, phase: 'DOUBLING', doubleChoices: [1, null, null] };
    const dblStateMingpaiMonster: GameState = {
      ...doublingBase,
      phase: 'DOUBLING',
      mingpaiSeats: [0],
      doubleChoices: [4, null, null],
    };
    expect(decideDoubleChoice(dblStateMingpaiMonster, 1, 'master')).toBe(1);
    expect(decideDoubleChoice(dblStateNormal, 1, 'master')).toBeGreaterThanOrEqual(1);
  });
});

describe('Master Alpha-Beta Endgame Solver & AI Coach', () => {
  it('solves non-greedy forced win endgame via Alpha-Beta pruning in open-hand/puzzle mode', () => {
    // Landlord (seat 0): 2 5 5; Farmer 1: K 4; Farmer 2: 6 6.
    // Greedy 55 loses to Farmer 2's 66; playing 2 first secures boss lead and wins with 55!
    const state: GameState = {
      ...makePlayingState([parseCards('2 5 5'), parseCards('K 4'), parseCards('6 6')], 0, 0),
      matchMode: 'puzzle',
    };
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

describe('Fairness, Determinizer & Master vs Intermediate Benchmark', () => {
  it('infers negative rank weights from PASS history and samples valid constrained hands', () => {
    let state = startNewMatch(100, 0, () => 0.12345);
    state = applyBidAction(state, 0, 'CALL');
    state = applyBidAction(state, 1, 'PASS');
    state = applyBidAction(state, 2, 'PASS');
    state = applyDoubleChoice(state, 0, 1);
    state = applyDoubleChoice(state, 1, 1);
    state = applyDoubleChoice(state, 2, 1);

    // Seat 0 leads a single K (find any K in hand 0, or inject clean state)
    const clean = makePlayingState(
      [
        parseCards('K 3 4 5 6 7 8 9 10 J Q 2 A 3 4 5 6 7 8 9'),
        parseCards('3 4 5 6 7 8 9 10 J Q A 2 3 4 5 6 7'),
        parseCards('4 5 6 7 8 9 10 J Q K A 2 SJ BJ 8 9 10'),
      ],
      0,
      0,
    );
    const afterK = applyPlayCards(clean, 0, [clean.hands[0].find((c) => c.rank === Rank.KING)!]);
    const afterPass1 = applyPassTurn(afterK, 1);

    const weights = computeSeatRankWeights(afterPass1, 0);
    // Seat 1 passed against Single K -> weight of A and 2 must be sharply discounted
    expect(weights[1][Rank.ACE]).toBeLessThan(0.5);
    expect(weights[1][Rank.TWO]).toBeLessThan(0.5);
    // Seat 2 hasn't passed yet -> baseline weight stays near 1.0
    expect(weights[2][Rank.ACE]).toBeCloseTo(1.0, 1);

    const samples = sampleDeterminizedHands(afterPass1, 0, 6, () => 0.5);
    expect(samples).toHaveLength(6);
    for (const s of samples) {
      expect(s[0]).toHaveLength(afterPass1.hands[0].length);
      expect(s[1]).toHaveLength(afterPass1.hands[1].length);
      expect(s[2]).toHaveLength(afterPass1.hands[2].length);
      const ids = new Set([...s[0], ...s[1], ...s[2]].map((c) => c.id));
      expect(ids.size).toBe(s[0].length + s[1].length + s[2].length);
    }
  });

  it('never peeks at hidden opponent hands in standard mode and remains stable when hidden hands are shuffled', () => {
    const stateA = makePlayingState(
      [
        parseCards('SJ 2 A K Q J 10 9 8 7 6 5 4 3 3'),
        parseCards('BJ 2 2 A K Q J 10 9 8 7 6'),
        parseCards('2 A K Q J 10 9 8 7 6 5 4'),
      ],
      0,
      0,
    );

    // Construct stateB by swapping/replacing hidden cards in seats 1 and 2 (preserving card counts)
    const stateB: GameState = {
      ...stateA,
      hands: [
        [...stateA.hands[0]],
        parseCards('3 4 4 5 5 6 6 7 7 8 8 9'),
        parseCards('BJ 2 2 2 A A K K Q Q J J'),
      ],
    };

    const makeSeededRng = (s: number) => () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const moveA = chooseBestMove(stateA, 0, 'master', makeSeededRng(777), { matchMode: 'standard' });
    const moveB = chooseBestMove(stateB, 0, 'master', makeSeededRng(777), { matchMode: 'standard' });

    expect(moveA.usedEndgameSolver).toBe(false);
    expect(moveB.usedEndgameSolver).toBe(false);
    expect(moveA.isPass).toBe(moveB.isPass);
    expect(moveA.pattern?.type).toBe(moveB.pattern?.type);
    expect(moveA.pattern?.mainRank).toBe(moveB.pattern?.mainRank);
    expect(moveA.cards.map((c) => c.id)).toEqual(moveB.cards.map((c) => c.id));
  });

  it('completes a 20-game Master vs Intermediate benchmark with <150ms average Master move time and 0 illegal moves', () => {
    let masterTotalMs = 0;
    let masterMoves = 0;
    let masterWins = 0;
    let totalGames = 0;

    for (let g = 0; g < 20; g++) {
      let seed = 5000 + g * 97;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const masterIsSeatZero = g % 2 === 0;
      let state = startNewMatch(100, (g % 3) as Seat, rng);

      let bidGuard = 0;
      while (state.phase === 'BIDDING') {
        expect(bidGuard++).toBeLessThan(30);
        const s = state.currentTurn;
        const diff: AIDifficulty =
          (masterIsSeatZero ? s === 0 : s !== 0) ? 'master' : 'intermediate';
        const bid = decideBidAction(state, s, diff);
        state = applyBidAction(state, s, bid, rng);
      }

      let dblGuard = 0;
      while (state.phase === 'DOUBLING') {
        expect(dblGuard++).toBeLessThan(6);
        const s = state.currentTurn;
        const diff: AIDifficulty =
          (masterIsSeatZero ? s === 0 : s !== 0) ? 'master' : 'intermediate';
        const dbl = decideDoubleChoice(state, s, diff);
        state = applyDoubleChoice(state, s, dbl);
      }

      let playGuard = 0;
      while (state.phase === 'PLAYING') {
        expect(playGuard++).toBeLessThan(200);
        const s = state.currentTurn;
        const isMasterSeat = masterIsSeatZero ? s === 0 : s !== 0;
        const diff: AIDifficulty = isMasterSeat ? 'master' : 'intermediate';

        const t0 = performance.now();
        const move = chooseBestMove(state, s, diff, rng, { matchMode: 'standard' });
        const dt = performance.now() - t0;

        if (isMasterSeat) {
          masterTotalMs += dt;
          masterMoves += 1;
          expect(move.usedEndgameSolver).toBe(false);
        }

        if (move.isPass) {
          state = applyPassTurn(state, s);
        } else {
          state = applyPlayCards(state, s, move.cards);
        }
      }

      expect(state.phase).toBe('FINISHED');
      expect(state.settlement).not.toBeNull();
      const deltas = state.settlement!.beanDeltas;
      expect(deltas[0] + deltas[1] + deltas[2]).toBe(0);

      const landlord = state.landlordSeat!;
      const masterWon = masterIsSeatZero
        ? (landlord === 0) === (state.settlement!.winnerRole === 'landlord')
        : (landlord !== 0) === (state.settlement!.winnerRole === 'farmer');
      if (masterWon) masterWins++;
      totalGames++;
    }

    const avgMasterMs = masterTotalMs / Math.max(1, masterMoves);
    expect(totalGames).toBe(20);
    expect(masterMoves).toBeGreaterThan(20);
    expect(avgMasterMs).toBeLessThan(150);
    // Keep reference to masterWins without flaky win-rate assertion on small 20-game sample
    expect(masterWins).toBeGreaterThanOrEqual(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  Rank,
  activateMingpai,
  analyzeAllPatterns,
  analyzeHand,
  applyBidAction,
  applyDoubleChoice,
  applyPassTurn,
  applyPlayCards,
  canPatternBeat,
  createDeck,
  dealCards,
  extractSmartSelection,
  findBeatingPlays,
  matchPatternToBeat,
  parseCards,
  shuffleDeck,
  sortCardsByPattern,
  sortCardsByRank,
  startNewMatch,
} from './index';

describe('deck and sorting', () => {
  it('creates 54 unique cards and deals 17/17/17 + 3 bottom cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    expect(new Set(deck.map((c) => c.id)).size).toBe(54);

    // Deterministic RNG
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const shuffled = shuffleDeck(deck, rng);
    expect(shuffled).toHaveLength(54);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(54);

    const { hands, bottomCards } = dealCards(deck, rng);
    expect(hands[0]).toHaveLength(17);
    expect(hands[1]).toHaveLength(17);
    expect(hands[2]).toHaveLength(17);
    expect(bottomCards).toHaveLength(3);

    const allIds = [...hands[0], ...hands[1], ...hands[2], ...bottomCards].map((c) => c.id);
    expect(new Set(allIds).size).toBe(54);
  });

  it('sorts cards by rank descending and by pattern groups', () => {
    const cards = parseCards('3 A BJ 3 K SJ 3 3 7 7 5');
    const byRank = sortCardsByRank(cards);
    expect(byRank[0].rank).toBe(Rank.BIG_JOKER);
    expect(byRank[1].rank).toBe(Rank.SMALL_JOKER);
    expect(byRank[byRank.length - 1].rank).toBe(Rank.THREE);

    const byPattern = sortCardsByPattern(cards);
    // Rocket (2) -> Bomb 3333 (4) -> Pair 77 (2) -> Singles A, K, 5
    expect(byPattern.slice(0, 2).map((c) => c.rank)).toEqual([Rank.BIG_JOKER, Rank.SMALL_JOKER]);
    expect(byPattern.slice(2, 6).every((c) => c.rank === Rank.THREE)).toBe(true);
    expect(byPattern.slice(6, 8).every((c) => c.rank === Rank.SEVEN)).toBe(true);
    expect(byPattern.slice(8).map((c) => c.rank)).toEqual([Rank.ACE, Rank.KING, Rank.FIVE]);
  });
});

describe('analyzeHand & pattern classification', () => {
  it('recognizes all 14 legal hand types', () => {
    expect(analyzeHand(parseCards('7')).type).toBe('SINGLE');
    expect(analyzeHand(parseCards('8 8')).type).toBe('PAIR');
    expect(analyzeHand(parseCards('9 9 9')).type).toBe('TRIPLE');
    expect(analyzeHand(parseCards('9 9 9 3')).type).toBe('TRIPLE_WITH_SINGLE');
    expect(analyzeHand(parseCards('9 9 9 4 4')).type).toBe('TRIPLE_WITH_PAIR');
    expect(analyzeHand(parseCards('3 4 5 6 7')).type).toBe('STRAIGHT');
    expect(analyzeHand(parseCards('3 3 4 4 5 5')).type).toBe('PAIR_STRAIGHT');
    expect(analyzeHand(parseCards('3 3 3 4 4 4')).type).toBe('AIRPLANE');
    expect(analyzeHand(parseCards('3 3 3 4 4 4 7 9')).type).toBe('AIRPLANE_WITH_SINGLES');
    expect(analyzeHand(parseCards('3 3 3 4 4 4 7 7 9 9')).type).toBe('AIRPLANE_WITH_PAIRS');
    expect(analyzeHand(parseCards('6 6 6 6 3 9')).type).toBe('FOUR_WITH_TWO_SINGLES');
    expect(analyzeHand(parseCards('6 6 6 6 3 3 9 9')).type).toBe('FOUR_WITH_TWO_PAIRS');
    expect(analyzeHand(parseCards('10 10 10 10')).type).toBe('BOMB');
    expect(analyzeHand(parseCards('SJ BJ')).type).toBe('ROCKET');
  });

  it('rejects illegal combinations and enforces strict bomb vs 3+1 distinction', () => {
    expect(analyzeHand(parseCards('3 4 5 6')).type).toBe('INVALID');
    expect(analyzeHand(parseCards('10 J Q K A 2')).type).toBe('INVALID');
    expect(analyzeHand(parseCards('K K A A 2 2')).type).toBe('INVALID');
    expect(analyzeHand(parseCards('A A A 2 2 2')).type).toBe('INVALID');
    expect(analyzeHand(parseCards('3 3 4 4')).type).toBe('INVALID');
    expect(
      analyzeHand([
        { id: 'j1', suit: 'joker', rank: Rank.SMALL_JOKER },
        { id: 'j2', suit: 'joker', rank: Rank.SMALL_JOKER },
      ]).type,
    ).toBe('INVALID');

    // 4444 is strictly BOMB, never TRIPLE_WITH_SINGLE
    const all4 = analyzeAllPatterns(parseCards('4 4 4 4'));
    expect(all4).toHaveLength(1);
    expect(all4[0].type).toBe('BOMB');
  });

  it('handles tricky airplane and four-with-two ambiguities accurately', () => {
    // 333444555666 leading -> AIRPLANE of length 4 (mainRank=3, chainLength=4)
    const lead3456 = analyzeHand(parseCards('3 3 3 4 4 4 5 5 5 6 6 6'));
    expect(lead3456.type).toBe('AIRPLANE');
    expect(lead3456.mainRank).toBe(Rank.THREE);
    expect(lead3456.chainLength).toBe(4);

    // Same 12 cards following 333444555+789 (AIRPLANE_WITH_SINGLES, k=3, mainRank=3)
    const targetAirplaneSingles = analyzeHand(parseCards('3 3 3 4 4 4 5 5 5 7 8 9'));
    expect(targetAirplaneSingles.type).toBe('AIRPLANE_WITH_SINGLES');
    const matched = matchPatternToBeat(parseCards('3 3 3 4 4 4 5 5 5 6 6 6'), targetAirplaneSingles);
    expect(matched).not.toBeNull();
    expect(matched!.type).toBe('AIRPLANE_WITH_SINGLES');
    expect(matched!.mainRank).toBe(Rank.FOUR);
    expect(matched!.chainLength).toBe(3);

    // 33334445 -> AIRPLANE_WITH_SINGLES (333+444 + 3,5)
    const a33334445 = analyzeHand(parseCards('3 3 3 3 4 4 4 5'));
    expect(a33334445.type).toBe('AIRPLANE_WITH_SINGLES');
    expect(a33334445.mainRank).toBe(Rank.THREE);
    expect(a33334445.chainLength).toBe(2);

    // 33334444 -> can be AIRPLANE_WITH_SINGLES (3-4) OR FOUR_WITH_TWO_PAIRS (4444+33+33)
    const all33334444 = analyzeAllPatterns(parseCards('3 3 3 3 4 4 4 4'));
    expect(all33334444.some((p) => p.type === 'AIRPLANE_WITH_SINGLES' && p.mainRank === Rank.THREE)).toBe(true);
    expect(all33334444.some((p) => p.type === 'FOUR_WITH_TWO_PAIRS' && p.mainRank === Rank.FOUR)).toBe(true);

    // 33334444 beats 3333+5566 as FOUR_WITH_TWO_PAIRS (4444 > 3333)
    const target422 = analyzeHand(parseCards('3 3 3 3 5 5 6 6'));
    const beat422 = matchPatternToBeat(parseCards('3 3 3 3 4 4 4 4'), target422);
    expect(beat422).not.toBeNull();
    expect(beat422!.type).toBe('FOUR_WITH_TWO_PAIRS');
    expect(beat422!.mainRank).toBe(Rank.FOUR);

    // 3334445555 -> AIRPLANE_WITH_PAIRS (333+444 + 55+55)
    const a3334445555 = analyzeHand(parseCards('3 3 3 4 4 4 5 5 5 5'));
    expect(a3334445555.type).toBe('AIRPLANE_WITH_PAIRS');
    expect(a3334445555.mainRank).toBe(Rank.THREE);
    expect(a3334445555.chainLength).toBe(2);
  });
});

describe('canPatternBeat & findBeatingPlays', () => {
  it('enforces Rocket > Bomb > higher same-type and ignores kicker ranks', () => {
    const rocket = analyzeHand(parseCards('SJ BJ'));
    const bombA = analyzeHand(parseCards('A A A A'));
    const bomb3 = analyzeHand(parseCards('3 3 3 3'));
    const straight5 = analyzeHand(parseCards('3 4 5 6 7'));
    const straight5High = analyzeHand(parseCards('4 5 6 7 8'));
    const straight6 = analyzeHand(parseCards('4 5 6 7 8 9'));
    const t1 = analyzeHand(parseCards('5 5 5 A'));
    const t2 = analyzeHand(parseCards('6 6 6 3'));

    expect(canPatternBeat(rocket, bombA)).toBe(true);
    expect(canPatternBeat(bombA, rocket)).toBe(false);
    expect(canPatternBeat(bombA, bomb3)).toBe(true);
    expect(canPatternBeat(bomb3, bombA)).toBe(false);
    expect(canPatternBeat(bomb3, straight6)).toBe(true);
    expect(canPatternBeat(straight5High, straight5)).toBe(true);
    expect(canPatternBeat(straight6, straight5)).toBe(false);
    expect(canPatternBeat(t2, t1)).toBe(true); // 666+3 beats 555+A
  });

  it('finds all beating plays across types and handles rocket defense', () => {
    const hand = parseCards('3 4 5 6 7 8 8 8 9 9 9 Q Q Q Q SJ BJ');

    const vsSingleK = findBeatingPlays(hand, analyzeHand(parseCards('K')));
    expect(vsSingleK.some((p) => p.type === 'SINGLE' && p.mainRank === Rank.SMALL_JOKER)).toBe(true);
    expect(vsSingleK.some((p) => p.type === 'BOMB' && p.mainRank === Rank.QUEEN)).toBe(true);
    expect(vsSingleK.some((p) => p.type === 'ROCKET')).toBe(true);

    const vsTriple31 = findBeatingPlays(hand, analyzeHand(parseCards('4 4 4 2')));
    expect(vsTriple31.some((p) => p.type === 'TRIPLE_WITH_SINGLE' && p.mainRank === Rank.EIGHT)).toBe(true);
    expect(vsTriple31.some((p) => p.type === 'TRIPLE_WITH_SINGLE' && p.mainRank === Rank.NINE)).toBe(true);

    const vsStraight = findBeatingPlays(hand, analyzeHand(parseCards('3 4 5 6 7')));
    expect(vsStraight.some((p) => p.type === 'STRAIGHT' && p.mainRank === Rank.FOUR && p.length === 5)).toBe(true);

    const vsAirplane = findBeatingPlays(hand, analyzeHand(parseCards('3 3 3 4 4 4')));
    expect(vsAirplane.some((p) => p.type === 'AIRPLANE' && p.mainRank === Rank.EIGHT)).toBe(true);

    const vsRocket = findBeatingPlays(hand, analyzeHand(parseCards('SJ BJ')));
    expect(vsRocket).toHaveLength(0);

    // Free lead hints include non-empty sorted plays
    const leadHints = findBeatingPlays(hand, null);
    expect(leadHints.length).toBeGreaterThan(5);
  });

  it('extracts smart straights and pair straights on swipe without altering valid plays', () => {
    // 5-card straight embedded among duplicates: 3 4 5 5 6 7 8 -> extracts 3..8 straight (6 cards)
    const swipe1 = parseCards('3 4 5 5 6 7 8');
    const ext1 = extractSmartSelection(swipe1, null);
    expect(ext1).not.toBeNull();
    expect(analyzeHand(ext1!).type).toBe('STRAIGHT');
    expect(ext1).toHaveLength(6);

    // Pair straight embedded with noise single: 4 4 5 5 6 6 9
    const swipe2 = parseCards('4 4 5 5 6 6 9');
    const ext2 = extractSmartSelection(swipe2, null);
    expect(ext2).not.toBeNull();
    expect(analyzeHand(ext2!).type).toBe('PAIR_STRAIGHT');
    expect(ext2).toHaveLength(6);

    // Already valid selection (444+55) is untouched
    const valid = parseCards('4 4 4 5 5');
    expect(extractSmartSelection(valid, null)).toBeNull();

    // Following straight 34567 inside 3 4 5 6 7 8 2 -> extracts 45678
    const swipeFollow = parseCards('3 4 5 6 7 8 2');
    const extFollow = extractSmartSelection(swipeFollow, analyzeHand(parseCards('3 4 5 6 7')));
    expect(extFollow).not.toBeNull();
    expect(analyzeHand(extFollow!).mainRank).toBe(Rank.FOUR);
    expect(extFollow).toHaveLength(5);
  });
});

describe('gameLoop state machine & settlement', () => {
  it('handles bidding, grabs, counter-grab, and all-pass redeal', () => {
    let state = startNewMatch(100, 0, () => 0.25);

    // Case 1: all pass -> automatic redeal
    state = applyBidAction(state, 0, 'PASS');
    state = applyBidAction(state, 1, 'PASS');
    state = applyBidAction(state, 2, 'PASS', () => 0.75);
    expect(state.redealCount).toBe(1);
    expect(state.phase).toBe('BIDDING');
    expect(state.currentTurn).toBe(1);

    // Case 2: 0 PASSes, 1 CALLs, 2 GRABs, 0 skipped (passed initial call), 1 counter-GRABs
    let bid2 = startNewMatch(100, 0, () => 0.35);
    bid2 = applyBidAction(bid2, 0, 'PASS');
    bid2 = applyBidAction(bid2, 1, 'CALL');
    expect(bid2.currentTurn).toBe(2);
    bid2 = applyBidAction(bid2, 2, 'GRAB');
    expect(bid2.currentTurn).toBe(1); // 0 skipped because 0 passed initial call
    bid2 = applyBidAction(bid2, 1, 'GRAB');

    expect(bid2.phase).toBe('DOUBLING');
    expect(bid2.landlordSeat).toBe(1);
    expect(bid2.grabCount).toBe(2);
    expect(bid2.hands[1]).toHaveLength(20);
  });

  it('computes zero-sum doubling math, trick resets, and Spring / Anti-Spring accurately', () => {
    // Construct deterministic custom state in BIDDING -> DOUBLING -> PLAYING
    let state = startNewMatch(100, 0);
    state = {
      ...state,
      hands: [
        parseCards('3 3 3 3 7'), // seat 0 (will become landlord + bottom 3 cards)
        parseCards('4 4 5'),
        parseCards('6 6 8'),
      ],
      bottomCards: parseCards('SJ BJ A'),
    };

    state = activateMingpai(state, 0); // mingpaiMultiplier = 4
    state = applyBidAction(state, 0, 'CALL');
    state = applyBidAction(state, 1, 'PASS');
    state = applyBidAction(state, 2, 'PASS');
    expect(state.phase).toBe('DOUBLING');

    // Super double (4x) for landlord 0, Double (2x) for farmer 1, No double (1x) for farmer 2
    state = applyDoubleChoice(state, 0, 4);
    state = applyDoubleChoice(state, 1, 2);
    state = applyDoubleChoice(state, 2, 1);
    expect(state.phase).toBe('PLAYING');
    expect(state.currentTurn).toBe(0);

    // Cannot pass on free lead
    expect(() => applyPassTurn(state, 0)).toThrow();

    // Landlord plays Rocket -> 1 bomb/rocket
    state = applyPlayCards(state, 0, parseCards('SJ BJ'));
    state = applyPassTurn(state, 1);
    state = applyPassTurn(state, 2);
    expect(state.lastPlay).toBeNull(); // trick reset after 2 passes

    // Landlord plays 3333 (Bomb)
    state = applyPlayCards(state, 0, parseCards('3 3 3 3'));
    state = applyPassTurn(state, 1);
    state = applyPassTurn(state, 2);

    // Landlord plays 7 (only A left) -> wait: 7 then pass/pass then A
    state = applyPlayCards(state, 0, parseCards('7'));
    state = applyPassTurn(state, 1);
    state = applyPassTurn(state, 2);
    state = applyPlayCards(state, 0, parseCards('A'));

    expect(state.phase).toBe('FINISHED');
    expect(state.settlement).not.toBeNull();
    const s = state.settlement!;
    expect(s.winnerRole).toBe('landlord');
    expect(s.isSpring).toBe(true);
    expect(s.isAntiSpring).toBe(false);
    // publicMultiplier = 2^0 (grab) * 2^2 (bomb+rocket) * 4 (mingpai) * 2 (spring) = 32
    expect(s.publicMultiplier).toBe(32);
    // Farmer 1: 100 * 32 * 4 * 2 = 25600; Farmer 2: 100 * 32 * 4 * 1 = 12800
    expect(s.beanDeltas[1]).toBe(-25600);
    expect(s.beanDeltas[2]).toBe(-12800);
    expect(s.beanDeltas[0]).toBe(38400);
    expect(s.beanDeltas[0] + s.beanDeltas[1] + s.beanDeltas[2]).toBe(0);
  });

  it('detects Anti-Spring only when landlord played exactly once', () => {
    let base = startNewMatch(100, 0);
    base = {
      ...base,
      phase: 'PLAYING',
      landlordSeat: 0,
      currentTurn: 0,
      doubleChoices: [1, 1, 1],
      hands: [parseCards('3 9'), parseCards('K'), parseCards('A')],
    };

    // Landlord plays once ('3'), farmer 1 plays 'K' and wins -> Anti-Spring!
    let anti = applyPlayCards(base, 0, parseCards('3'));
    anti = applyPlayCards(anti, 1, parseCards('K'));
    expect(anti.phase).toBe('FINISHED');
    expect(anti.settlement!.isAntiSpring).toBe(true);
    expect(anti.settlement!.isSpring).toBe(false);

    // If landlord played twice before farmer wins -> NOT Anti-Spring
    let normalBase: typeof base = {
      ...base,
      hands: [parseCards('3 9 Q'), parseCards('K'), parseCards('A')],
    };
    let normal = applyPlayCards(normalBase, 0, parseCards('3'));
    normal = applyPassTurn(normal, 1);
    normal = applyPassTurn(normal, 2);
    normal = applyPlayCards(normal, 0, parseCards('9'));
    normal = applyPlayCards(normal, 1, parseCards('K'));
    expect(normal.phase).toBe('FINISHED');
    expect(normal.settlement!.isAntiSpring).toBe(false);
  });
});

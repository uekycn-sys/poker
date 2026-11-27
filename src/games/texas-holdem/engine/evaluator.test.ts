import { describe, expect, it } from 'vitest';
import { createCard, createDeck, shuffleDeck } from './deck';
import { evaluate7Fast, evaluateBestHand } from './evaluator';
import { HoldemCard, HoldemRank, HoldemSuit } from './types';

function c(short: string): HoldemCard {
  const rankChar = short.slice(0, -1);
  const suitChar = short.slice(-1);
  const rankMap: Record<string, HoldemRank> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    T: 10,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  const suitMap: Record<string, HoldemSuit> = {
    s: 'spades',
    h: 'hearts',
    c: 'clubs',
    d: 'diamonds',
  };
  return createCard(suitMap[suitChar], rankMap[rankChar]);
}

describe('Texas Holdem Hand Evaluator', () => {
  it('ranks all 10 hand categories strictly from Royal Flush down to High Card', () => {
    const royal = evaluateBestHand([c('As'), c('Ks'), c('Qs'), c('Js'), c('Ts'), c('2d'), c('3c')]);
    const straightFlush = evaluateBestHand([c('9h'), c('8h'), c('7h'), c('6h'), c('5h'), c('As'), c('Kd')]);
    const quads = evaluateBestHand([c('Ac'), c('Ad'), c('Ah'), c('As'), c('Kc'), c('2d'), c('3s')]);
    const fullHouse = evaluateBestHand([c('Ks'), c('Kh'), c('Kd'), c('Qc'), c('Qd'), c('2s'), c('3c')]);
    const flush = evaluateBestHand([c('Ac'), c('Jc'), c('9c'), c('5c'), c('2c'), c('Kd'), c('Qh')]);
    const straight = evaluateBestHand([c('Td'), c('9s'), c('8c'), c('7h'), c('6d'), c('As'), c('2c')]);
    const trips = evaluateBestHand([c('Qh'), c('Qs'), c('Qd'), c('Ac'), c('9h'), c('4d'), c('2s')]);
    const twoPair = evaluateBestHand([c('Js'), c('Jd'), c('8c'), c('8h'), c('As'), c('4d'), c('2c')]);
    const onePair = evaluateBestHand([c('Ts'), c('Td'), c('Ac'), c('Kh'), c('7s'), c('4d'), c('2c')]);
    const highCard = evaluateBestHand([c('As'), c('Kd'), c('Jc'), c('9h'), c('6s'), c('4d'), c('2c')]);

    const ordered = [
      royal,
      straightFlush,
      quads,
      fullHouse,
      flush,
      straight,
      trips,
      twoPair,
      onePair,
      highCard,
    ];

    expect(ordered.map((x) => x.category)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ordered[i].score).toBeGreaterThan(ordered[i + 1].score);
      expect(ordered[i].bestFive).toHaveLength(5);
    }
    expect(royal.categoryName).toBe('皇家同花顺');
    expect(highCard.bestFive).toHaveLength(5);
  });

  it('handles A-2-3-4-5 wheel straight and ranks 6-high straight above wheel', () => {
    const wheel = evaluateBestHand([c('As'), c('2d'), c('3c'), c('4h'), c('5s'), c('Kd'), c('Qc')]);
    const sixHigh = evaluateBestHand([c('6s'), c('2d'), c('3c'), c('4h'), c('5s'), c('Kd'), c('Qc')]);
    const wheelSf = evaluateBestHand([c('As'), c('2s'), c('3s'), c('4s'), c('5s'), c('Kd'), c('Qc')]);

    expect(wheel.category).toBe(4);
    expect(sixHigh.category).toBe(4);
    expect(sixHigh.score).toBeGreaterThan(wheel.score);
    expect(wheelSf.category).toBe(8);
    expect(wheelSf.score).toBeGreaterThan(sixHigh.score);
  });

  it('resolves kickers accurately and identifies exact split-pot ties', () => {
    // Same pair of Aces, K-Q-9 kickers vs K-Q-8 kickers
    const board = [c('As'), c('Kd'), c('Qc'), c('4h'), c('2s')];
    const handA = evaluateBestHand([...board, c('Ah'), c('9d')]);
    const handB = evaluateBestHand([...board, c('Ac'), c('8h')]);
    expect(handA.category).toBe(1);
    expect(handB.category).toBe(1);
    expect(handA.score).toBeGreaterThan(handB.score);

    // Board plays straight for both players -> exact tie
    const straightBoard = [c('Ts'), c('Jd'), c('Qc'), c('Kh'), c('As')];
    const tie1 = evaluateBestHand([...straightBoard, c('2d'), c('3c')]);
    const tie2 = evaluateBestHand([...straightBoard, c('9s'), c('4h')]);
    expect(tie1.score).toBe(tie2.score);
    expect(tie1.category).toBe(4);
  });

  it('selects optimal 5-card combination when 7 cards contain 3 pairs or 2 trips', () => {
    const threePairs = evaluateBestHand([
      c('As'),
      c('Ad'),
      c('Kc'),
      c('Kh'),
      c('Qs'),
      c('Qd'),
      c('2c'),
    ]);
    expect(threePairs.category).toBe(2);
    expect(threePairs.description).toContain('A & K');

    const twoTrips = evaluateBestHand([
      c('Ks'),
      c('Kd'),
      c('Kc'),
      c('Qh'),
      c('Qs'),
      c('Qd'),
      c('Ac'),
    ]);
    expect(twoTrips.category).toBe(6);
    expect(twoTrips.description).toContain('K 带 Q');
  });

  it('matches evaluate7Fast identically against evaluateBestHand across 500 random 7-card hands', () => {
    const baseDeck = createDeck();
    for (let i = 0; i < 500; i++) {
      const shuffled = shuffleDeck(baseDeck, 1000 + i);
      const seven = shuffled.slice(0, 7);
      const fastScore = evaluate7Fast(
        seven[0].code,
        seven[1].code,
        seven[2].code,
        seven[3].code,
        seven[4].code,
        seven[5].code,
        seven[6].code,
      );
      const fullRes = evaluateBestHand(seven);
      expect(fastScore).toBe(fullRes.score);
    }
  });
});

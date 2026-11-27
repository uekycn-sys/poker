import { describe, expect, it } from 'vitest';
import { createCard } from './deck';
import { evaluateBestHand } from './evaluator';
import { calculateSidePots, distributePots } from './sidePots';
import { HandEvalResult, HoldemRank, HoldemSuit } from './types';

function c(short: string) {
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
  return createCard(suitMap[short.slice(-1)], rankMap[short.slice(0, -1)]);
}

function makeEval(cards: string[]): HandEvalResult {
  return evaluateBestHand(cards.map(c));
}

describe('Texas Holdem Side Pots & Split Pot Distribution', () => {
  it('calculates main pot and multiple side pots accurately with folded dead money', () => {
    const pots = calculateSidePots([
      { seat: 0, totalCommitted: 100, folded: false }, // short all-in
      { seat: 1, totalCommitted: 250, folded: true },  // folded after betting 250
      { seat: 2, totalCommitted: 400, folded: false }, // medium all-in
      { seat: 3, totalCommitted: 900, folded: false }, // big stack
      { seat: 4, totalCommitted: 900, folded: false }, // big stack
      { seat: 5, totalCommitted: 50, folded: true },   // SB folded
    ]);

    // Total committed = 100 + 250 + 400 + 900 + 900 + 50 = 2600
    // Layer 50: 6 * 50 = 300 (eligible: 0,2,3,4)
    // Layer 100: 5 * 50 = 250 (eligible: 0,2,3,4) -> merges with 50 => Main Pot = 550 (eligible: 0,2,3,4)
    // Layer 250: 4 * 150 = 600 (eligible: 2,3,4)
    // Layer 400: 3 * 150 = 450 (eligible: 2,3,4) -> merges with 250 => Side Pot 1 = 1050 (eligible: 2,3,4)
    // Layer 900: 2 * 500 = 1000 (eligible: 3,4) => Side Pot 2 = 1000 (eligible: 3,4)
    expect(pots).toHaveLength(3);
    expect(pots[0]).toEqual({
      id: 'main',
      label: '主池',
      amount: 550,
      eligibleSeats: [0, 2, 3, 4],
    });
    expect(pots[1]).toEqual({
      id: 'side-1',
      label: '边池 1',
      amount: 1050,
      eligibleSeats: [2, 3, 4],
    });
    expect(pots[2]).toEqual({
      id: 'side-2',
      label: '边池 2',
      amount: 1000,
      eligibleSeats: [3, 4],
    });

    const totalPotSum = pots.reduce((s, p) => s + p.amount, 0);
    expect(totalPotSum).toBe(2600);
  });

  it('awards main pot to short stack and side pots to stronger deep stacks', () => {
    const pots = calculateSidePots([
      { seat: 0, totalCommitted: 200, folded: false },
      { seat: 1, totalCommitted: 600, folded: false },
      { seat: 2, totalCommitted: 1000, folded: false },
      { seat: 3, totalCommitted: 1000, folded: false },
    ]);

    const board = ['2s', '7d', '9c', '4h', '5d'];
    const evals: Record<number, HandEvalResult> = {
      0: makeEval([...board, 'As', 'Ac']), // Pair Aces -> wins main pot (800)
      1: makeEval([...board, 'Ks', 'Kc']), // Pair Kings -> wins side 1 (1200)
      2: makeEval([...board, 'Js', 'Jd']), // Pair Jacks -> loses side 2
      3: makeEval([...board, 'Qs', 'Qh']), // Pair Queens -> wins side 2 (800)
    };

    const { totalWonBySeat } = distributePots(pots, evals, 0, 6, [0, 1, 2, 3]);
    expect(totalWonBySeat[0]).toBe(800);
    expect(totalWonBySeat[1]).toBe(1200);
    expect(totalWonBySeat[3]).toBe(800);
    expect(totalWonBySeat[2] ?? 0).toBe(0);
    const totalDistributed = Object.values(totalWonBySeat).reduce((a, b) => a + b, 0);
    expect(totalDistributed).toBe(2800);
  });

  it('splits pots evenly and awards odd chips clockwise starting left of Dealer button', () => {
    // Odd pot of 101 split 2 ways; dealer is seat 4 -> clockwise order left of 4 is 5, 0, 1, 2, 3
    // Between seat 1 and seat 5, seat 5 is closer left of dealer 4 -> seat 5 gets 51, seat 1 gets 50.
    const pots = [{ id: 'main', label: '主池', amount: 101, eligibleSeats: [1, 3, 5] }];
    const tieBoard = ['As', 'Ks', 'Qd', 'Jc', 'Th'];
    const evals: Record<number, HandEvalResult> = {
      1: makeEval([...tieBoard, '2c', '3d']),
      3: makeEval([...tieBoard, '2h', '4c']), // 3-way tie on Ace-high straight
      5: makeEval([...tieBoard, '2d', '5s']),
    };

    // 101 / 3 = 33 remainder 2 -> closest two left of dealerSeat=4 are seat 5 and seat 1
    const res = distributePots(pots, evals, 4, 6, [1, 3, 5]);
    expect(res.totalWonBySeat[5]).toBe(34);
    expect(res.totalWonBySeat[1]).toBe(34);
    expect(res.totalWonBySeat[3]).toBe(33);
    expect(res.payouts[0].oddChipsAwardedTo).toEqual([5, 1]);
  });

  it('conserves chips across complex 6-way all-in with multiple ties and odd chips', () => {
    const contributions = [
      { seat: 0, totalCommitted: 111, folded: false },
      { seat: 1, totalCommitted: 333, folded: false },
      { seat: 2, totalCommitted: 333, folded: true },
      { seat: 3, totalCommitted: 777, folded: false },
      { seat: 4, totalCommitted: 1200, folded: false },
      { seat: 5, totalCommitted: 1200, folded: false },
    ];
    const totalCommitted = contributions.reduce((s, x) => s + x.totalCommitted, 0);
    const pots = calculateSidePots(contributions);
    const board = ['As', 'Ks', 'Qs', 'Js', '2d'];
    const evals: Record<number, HandEvalResult> = {
      0: makeEval([...board, '3c', '4h']), // Flush A-high
      1: makeEval([...board, 'Ts', '5c']), // Royal Flush (ties or beats? Ts gives Royal Flush!)
      3: makeEval([...board, '9s', '5d']), // Flush A-K-Q-J-9
      4: makeEval([...board, 'Ad', 'Ac']), // Pair of Aces + board flush -> wait A-K-Q-J-x flush? No, 4 spades on board!
      5: makeEval([...board, 'Kd', 'Kc']),
    };

    const { totalWonBySeat } = distributePots(pots, evals, 2, 6, [0, 1, 3, 4, 5]);
    const distributed = Object.values(totalWonBySeat).reduce((a, b) => a + b, 0);
    expect(distributed).toBe(totalCommitted);
  });
});

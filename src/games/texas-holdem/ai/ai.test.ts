import { describe, expect, it } from 'vitest';
import { createCard, createDeck } from '../engine/deck';
import { applyAction, createHand, validateAction } from '../engine/rules';
import { HoldemCard, HoldemRank, HoldemSuit, PositionName } from '../engine/types';
import { analyzeCoachSpot, evaluateHeroDecision } from './coach';
import { decideAiAction } from './decision';
import { analyzeOuts, calculateEquity } from './equity';
import { getPreflopRangeMatrix, lookupPreflopGto } from './gtoRanges';
import { AI_PERSONAS_BY_SEAT } from './personas';

function c(short: string): HoldemCard {
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

describe('Texas Holdem Monte Carlo Equity & Outs Engine', () => {
  it('computes accurate Monte Carlo equities within 150ms for >= 1200 iterations', () => {
    const aces = calculateEquity([c('As'), c('Ah')], [], 1, 1200, 101);
    expect(aces.equity).toBeGreaterThan(0.8);
    expect(aces.elapsedMs).toBeLessThan(150);

    const sevenTwo = calculateEquity([c('7c'), c('2d')], [], 1, 1200, 202);
    expect(sevenTwo.equity).toBeLessThan(0.4);
    expect(sevenTwo.elapsedMs).toBeLessThan(150);

    // Multi-way flop benchmark (3 opponents, 1200 iterations)
    const flopMulti = calculateEquity(
      [c('Js'), c('Ts')],
      [c('Qs'), c('9c'), c('2s')],
      3,
      1200,
      303,
    );
    expect(flopMulti.iterations).toBe(1200);
    expect(flopMulti.elapsedMs).toBeLessThan(150);

    // Made Royal Flush on river -> 100% equity
    const royal = calculateEquity(
      [c('As'), c('Ks')],
      [c('Qs'), c('Js'), c('Ts'), c('4d'), c('7c')],
      2,
      1000,
      404,
    );
    expect(royal.equity).toBe(1);
  });

  it('detects exact deduplicated Outs for combo draws, flush draws, OESD, and gutshots', () => {
    // J♠ T♠ on Q♠ 9♣ 2♠ => Flush Draw (9) + OESD K/8 (8) - 2 overlap (K♠, 8♠) = 15 outs
    const combo = analyzeOuts([c('Js'), c('Ts')], [c('Qs'), c('9c'), c('2s')]);
    expect(combo.hasFlushDraw).toBe(true);
    expect(combo.hasOesd).toBe(true);
    expect(combo.totalOuts).toBe(15);

    // Pure Flush Draw (no straight draw): A♥ 5♥ on K♥ 8♥ 2♣ => 9 outs
    const flushDraw = analyzeOuts([c('Ah'), c('5h')], [c('Kh'), c('8h'), c('2c')]);
    expect(flushDraw.hasFlushDraw).toBe(true);
    expect(flushDraw.hasOesd).toBe(false);
    expect(flushDraw.totalOuts).toBe(9);

    // Pure OESD: 9♦ 8♣ on J♠ T♥ 2♣ => Q or 7 => 8 outs
    const oesd = analyzeOuts([c('9d'), c('8c')], [c('Js'), c('Th'), c('2c')]);
    expect(oesd.hasOesd).toBe(true);
    expect(oesd.totalOuts).toBe(8);

    // Pure Gutshot (no overcards): 7♠ 5♦ on A♣ 9♥ 8♠ => only 6 makes straight => 4 outs
    const gutshot = analyzeOuts([c('7s'), c('5d')], [c('Ac'), c('9h'), c('8s')]);
    expect(gutshot.hasGutshot).toBe(true);
    expect(gutshot.totalOuts).toBe(4);
  });
});

describe('GTO Preflop Ranges, AI Style Differentiation & EV Coach', () => {
  it('generates valid 13x13 GTO range matrices across all 6 positions', () => {
    const positions: PositionName[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
    for (const pos of positions) {
      for (const facingRaise of [false, true]) {
        const matrix = getPreflopRangeMatrix(pos, facingRaise);
        expect(matrix).toHaveLength(13);
        expect(matrix[0]).toHaveLength(13);
        // AA at (0,0) is always raise
        expect(matrix[0][0].handKey).toBe('AA');
        expect(matrix[0][0].action).toBe('raise');
      }
    }

    // 72o in UTG is always fold
    expect(lookupPreflopGto([c('7c'), c('2d')], 'UTG', false).action).toBe('fold');

    // BTN RFI range is strictly wider than UTG RFI range
    const utgCount = getPreflopRangeMatrix('UTG', false)
      .flat()
      .filter((x) => x.action === 'raise').length;
    const btnCount = getPreflopRangeMatrix('BTN', false)
      .flat()
      .filter((x) => x.action === 'raise').length;
    expect(btnCount).toBeGreaterThan(utgCount);
  });

  it('produces distinct exploitable behavior across AI personas and always legal actions', () => {
    const basePlayers = [
      { seat: 0, name: 'Hero', isHuman: true, stack: 2000 },
      { seat: 1, name: 'TAG', isHuman: false, stack: 2000 },
      { seat: 2, name: 'LAG', isHuman: false, stack: 2000 },
      { seat: 3, name: 'Station', isHuman: false, stack: 2000 },
      { seat: 4, name: 'Nit', isHuman: false, stack: 2000 },
      { seat: 5, name: 'GTO', isHuman: false, stack: 2000 },
    ];

    // Check legal decisions across a complete multi-AI hand
    let state = createHand({
      handId: 10,
      players: basePlayers,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      seed: 777,
    });

    let steps = 0;
    while (!state.isHandOver && steps < 40) {
      const seat = state.activeSeat!;
      const action =
        seat === 0
          ? { type: 'call' as const }
          : decideAiAction(state, seat, AI_PERSONAS_BY_SEAT[seat], {
              iterations: 1000,
              seed: 100 + steps,
            }).action;

      if (seat === 0 && !validateAction(state, 0, action).valid) {
        state = applyAction(state, 0, { type: 'check' });
      } else {
        expect(validateAction(state, seat, action).valid).toBe(true);
        state = applyAction(state, seat, action);
      }
      steps++;
    }
    expect(state.isHandOver).toBe(true);

    // Direct style comparison facing a large flop bet with weak gutshot (5h 4c on As Kd 2c, ~22% equity)
    const usedCodes1 = new Set(
      ['Qs', 'Jd', '5h', '4c', 'As', 'Kd', '2c'].map((s) => c(s).code),
    );
    const remaining1 = createDeck().filter((x) => !usedCodes1.has(x.code));

    // Build a clean heads-up flop spot where AI faces a large bet with a gutshot (5h 4c)
    let spot = createHand({
      handId: 11,
      players: [
        { seat: 0, name: 'Hero', isHuman: true, stack: 2000 },
        { seat: 3, name: 'Station', isHuman: false, stack: 2000 },
      ],
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      customDeck: [
        c('Qs'), // seat 0 (BTN/SB)
        c('5h'), // seat 3 (BB)
        c('Jd'), // seat 0
        c('4c'), // seat 3
        c('As'), // flop 1
        c('Kd'), // flop 2
        c('2c'), // flop 3
        ...remaining1,
      ],
    });
    spot = applyAction(spot, 0, { type: 'call' }); // BTN calls 20
    spot = applyAction(spot, 3, { type: 'check' }); // BB checks
    expect(spot.street).toBe('flop');
    // BB checks, Hero bets 2x pot (80)
    spot = applyAction(spot, 3, { type: 'check' });
    spot = applyAction(spot, 0, { type: 'raise', amount: 80 });

    const stationChoice = decideAiAction(spot, 3, AI_PERSONAS_BY_SEAT[3], {
      iterations: 1000,
      seed: 1,
    });
    const nitChoice = decideAiAction(spot, 3, AI_PERSONAS_BY_SEAT[4], {
      iterations: 1000,
      seed: 1,
    });

    expect(stationChoice.action.type).toBe('call');
    expect(nitChoice.action.type).toBe('fold');
  });

  it('flags -EV blunders for bad-odds calls and missed river value', () => {
    const usedCodes2 = new Set(
      ['7h', 'Kd', 'Ah', 'Ac', 'Ad', 'Qc', '4s', '9h', '2d'].map((s) => c(s).code),
    );
    const cleanRemaining = createDeck().filter((x) => !usedCodes2.has(x.code));
    let state = createHand({
      handId: 13,
      players: [
        { seat: 0, name: 'Hero', isHuman: true, stack: 2000 },
        { seat: 1, name: 'AI', isHuman: false, stack: 2000 },
      ],
      dealerSeat: 1,
      smallBlind: 10,
      bigBlind: 20,
      customDeck: [
        c('7h'), // AI SB
        c('Ah'), // Hero BB
        c('Kd'), // AI
        c('Ac'), // Hero -> Hero holds Ah Ac!
        c('Ad'), // Flop: Ad Qc 4s -> Hero has Set of Aces!
        c('Qc'),
        c('4s'),
        c('9h'), // Turn
        c('2d'), // River
        ...cleanRemaining,
      ],
    });

    state = applyAction(state, 1, { type: 'call' });
    state = applyAction(state, 0, { type: 'check' });
    state = applyAction(state, 0, { type: 'check' }); // flop
    state = applyAction(state, 1, { type: 'check' });
    state = applyAction(state, 0, { type: 'check' }); // turn
    state = applyAction(state, 1, { type: 'check' });
    expect(state.street).toBe('river');

    // Hero is first to act on River holding Set of Aces (~90%+ equity) and checks -> missed value blunder!
    const coach = analyzeCoachSpot(state, 0, AI_PERSONAS_BY_SEAT, 1000);
    expect(coach.heroEquityPct).toBeGreaterThanOrEqual(85);
    const review = evaluateHeroDecision(state, { type: 'check' }, coach, AI_PERSONAS_BY_SEAT);
    expect(review.isBlunder).toBe(true);
    expect(review.blunderType).toBe('missed_value');

    // Also test bad-odds call on river when Hero holds 3-high facing huge overbet
    const usedCodes3 = new Set(
      ['As', '3h', 'Kd', '2c', 'Ad', 'Qc', 'Js', '9h', '5d'].map((s) => c(s).code),
    );
    const rem3 = createDeck().filter((x) => !usedCodes3.has(x.code));
    let badOddsState = createHand({
      handId: 14,
      players: [
        { seat: 0, name: 'Hero', isHuman: true, stack: 2000 },
        { seat: 1, name: 'AI', isHuman: false, stack: 2000 },
      ],
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      customDeck: [
        c('3h'), // Hero SB/BTN
        c('As'), // AI BB
        c('2c'), // Hero
        c('Kd'), // AI
        c('Ad'),
        c('Qc'),
        c('Js'),
        c('9h'),
        c('5d'),
        ...rem3,
      ],
    });
    badOddsState = applyAction(badOddsState, 0, { type: 'call' });
    badOddsState = applyAction(badOddsState, 1, { type: 'check' });
    badOddsState = applyAction(badOddsState, 1, { type: 'check' });
    badOddsState = applyAction(badOddsState, 0, { type: 'check' });
    badOddsState = applyAction(badOddsState, 1, { type: 'check' });
    badOddsState = applyAction(badOddsState, 0, { type: 'check' });
    badOddsState = applyAction(badOddsState, 1, { type: 'raise', amount: 200 }); // 5x pot overbet

    const badCoach = analyzeCoachSpot(badOddsState, 0, AI_PERSONAS_BY_SEAT, 1000);
    const badReview = evaluateHeroDecision(
      badOddsState,
      { type: 'call' },
      badCoach,
      AI_PERSONAS_BY_SEAT,
    );
    expect(badReview.isBlunder).toBe(true);
    expect(badReview.blunderType).toBe('bad_odds_call');
  });
});

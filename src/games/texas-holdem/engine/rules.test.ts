import { describe, expect, it } from 'vitest';
import { createCard, createDeck } from './deck';
import {
  applyAction,
  createHand,
  getLegalActions,
  restoreFromStreetSnapshot,
  validateAction,
} from './rules';
import { HoldemCard, HoldemRank, HoldemSuit } from './types';

function makeSixPlayers(stack = 2000) {
  return [
    { seat: 0, name: 'Hero', isHuman: true, stack },
    { seat: 1, name: 'AI-1', isHuman: false, stack },
    { seat: 2, name: 'AI-2', isHuman: false, stack },
    { seat: 3, name: 'AI-3', isHuman: false, stack },
    { seat: 4, name: 'AI-4', isHuman: false, stack },
    { seat: 5, name: 'AI-5', isHuman: false, stack },
  ];
}

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

describe('Texas Holdem 6-Max NLH Rules Engine', () => {
  it('assigns 6-max positions, posts SB/BB, and starts preflop action at UTG', () => {
    const state = createHand({
      handId: 1,
      players: makeSixPlayers(2000),
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      seed: 42,
    });

    expect(state.players.map((p) => p.position)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO']);
    expect(state.players[1].streetBet).toBe(10);
    expect(state.players[2].streetBet).toBe(20);
    expect(state.pot).toBe(30);
    expect(state.currentBet).toBe(20);
    expect(state.activeSeat).toBe(3); // UTG
    expect(state.streetSnapshots.preflop).toBeDefined();
  });

  it('plays through preflop, flop, turn, river to showdown while conserving total chips', () => {
    let state = createHand({
      handId: 2,
      players: makeSixPlayers(2000),
      dealerSeat: 2,
      smallBlind: 10,
      bigBlind: 20,
      seed: 99,
    });

    // Seat 2 = BTN, 3 = SB, 4 = BB, 5 = UTG, 0 = MP, 1 = CO
    // UTG raises to 60, MP calls, CO folds, BTN folds, SB folds, BB calls
    state = applyAction(state, 5, { type: 'raise', amount: 60 });
    state = applyAction(state, 0, { type: 'call' });
    state = applyAction(state, 1, { type: 'fold' });
    state = applyAction(state, 2, { type: 'fold' });
    state = applyAction(state, 3, { type: 'fold' });
    state = applyAction(state, 4, { type: 'call' });

    expect(state.street).toBe('flop');
    expect(state.communityCards).toHaveLength(3);
    expect(state.pot).toBe(190); // 60*3 + 10(SB)
    expect(state.activeSeat).toBe(4); // BB acts first post-flop
    expect(state.streetSnapshots.flop).toBeDefined();

    // Flop: check around
    state = applyAction(state, 4, { type: 'check' });
    state = applyAction(state, 5, { type: 'check' });
    state = applyAction(state, 0, { type: 'check' });
    expect(state.street).toBe('turn');
    expect(state.communityCards).toHaveLength(4);
    expect(state.streetSnapshots.turn).toBeDefined();

    // Turn: BB bets 100, UTG raises to 250, MP folds, BB calls
    state = applyAction(state, 4, { type: 'raise', amount: 100 });
    state = applyAction(state, 5, { type: 'raise', amount: 250 });
    state = applyAction(state, 0, { type: 'fold' });
    state = applyAction(state, 4, { type: 'call' });

    expect(state.street).toBe('river');
    expect(state.communityCards).toHaveLength(5);
    expect(state.pot).toBe(690);
    expect(state.streetSnapshots.river).toBeDefined();

    // River: check-check -> showdown
    state = applyAction(state, 4, { type: 'check' });
    state = applyAction(state, 5, { type: 'check' });

    expect(state.isHandOver).toBe(true);
    expect(state.street).toBe('showdown');
    expect(state.showdown?.endedByFold).toBe(false);
    expect(state.showdown?.winningCardIds).toHaveLength(5);

    const totalEndChips = state.players.reduce((s, p) => s + p.stack, 0);
    expect(totalEndChips).toBe(state.initialTotalChips);
  });

  it('enforces strict Min-Raise and rejects illegal under-raises or checks facing bets', () => {
    let state = createHand({
      handId: 3,
      players: makeSixPlayers(2000),
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      seed: 123,
    });

    // UTG cannot check facing BB=20
    expect(validateAction(state, 3, { type: 'check' }).valid).toBe(false);

    // UTG min-raise is 40; 30 must be rejected
    expect(validateAction(state, 3, { type: 'raise', amount: 30 }).valid).toBe(false);
    expect(validateAction(state, 3, { type: 'raise', amount: 40 }).valid).toBe(true);

    // UTG raises to 100 (increment = 80)
    state = applyAction(state, 3, { type: 'raise', amount: 100 });
    const mpLegal = getLegalActions(state, 4);
    expect(mpLegal.callAmount).toBe(100);
    expect(mpLegal.minRaiseTo).toBe(180); // 100 + 80

    // MP tries raising to 150 (< 180) -> invalid
    expect(validateAction(state, 4, { type: 'raise', amount: 150 }).valid).toBe(false);
    expect(validateAction(state, 4, { type: 'raise', amount: 180 }).valid).toBe(true);
  });

  it('does NOT reopen betting when a short stack goes all-in below min-raise', () => {
    const players = makeSixPlayers(2000);
    players[4].stack = 130; // MP has only 130 total

    let state = createHand({
      handId: 4,
      players,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      seed: 7,
    });

    // UTG (seat 3) raises to 100 (increment 80 -> min-raise to 180)
    state = applyAction(state, 3, { type: 'raise', amount: 100 });
    // MP (seat 4) goes all-in for 130 (short all-in increment of 30 < 80)
    state = applyAction(state, 4, { type: 'all_in' });
    // CO (seat 5) has NOT acted yet -> can still raise (min-raise = 130 + 80 = 210)
    const coLegal = getLegalActions(state, 5);
    expect(coLegal.isReopened).toBe(true);
    expect(coLegal.canRaise).toBe(true);

    // CO calls 130, BTN folds, SB folds, BB folds -> back to UTG (seat 3)
    state = applyAction(state, 5, { type: 'call' });
    state = applyAction(state, 0, { type: 'fold' });
    state = applyAction(state, 1, { type: 'fold' });
    state = applyAction(state, 2, { type: 'fold' });

    expect(state.activeSeat).toBe(3);
    const utgLegal = getLegalActions(state, 3);
    expect(utgLegal.isReopened).toBe(false);
    expect(utgLegal.canRaise).toBe(false);
    expect(utgLegal.canCall).toBe(true);
    expect(utgLegal.callAmount).toBe(30);
    expect(validateAction(state, 3, { type: 'raise', amount: 300 }).valid).toBe(false);
  });

  it('auto-runs out remaining streets to showdown on multi-way preflop all-in', () => {
    const customDeck = createDeck();
    // Put deterministic hole cards at top
    const players = [
      { seat: 0, name: 'P0', isHuman: true, stack: 300 },
      { seat: 1, name: 'P1', isHuman: false, stack: 600 },
      { seat: 2, name: 'P2', isHuman: false, stack: 1200 },
    ];
    let state = createHand({
      handId: 5,
      players,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      customDeck,
    });

    // 3 players: BTN(0) acts first preflop -> all-in 300; SB(1) -> all-in 600; BB(2) -> call 600
    state = applyAction(state, 0, { type: 'all_in' });
    state = applyAction(state, 1, { type: 'all_in' });
    state = applyAction(state, 2, { type: 'call' });

    expect(state.isHandOver).toBe(true);
    expect(state.street).toBe('showdown');
    expect(state.communityCards).toHaveLength(5);
    expect(state.streetSnapshots.flop).toBeDefined();
    expect(state.streetSnapshots.turn).toBeDefined();
    expect(state.streetSnapshots.river).toBeDefined();
    expect(state.showdown?.pots.length).toBeGreaterThanOrEqual(2);
    expect(state.players.reduce((s, p) => s + p.stack, 0)).toBe(2100);
  });

  it('restores a playable street state faithfully from streetSnapshots', () => {
    const deck = createDeck();
    // Ensure deterministic cards so snapshot restore diverges cleanly
    void c('As');
    let state = createHand({
      handId: 6,
      players: makeSixPlayers(2000),
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      customDeck: deck,
    });

    state = applyAction(state, 3, { type: 'call' });
    state = applyAction(state, 4, { type: 'call' });
    state = applyAction(state, 5, { type: 'fold' });
    state = applyAction(state, 0, { type: 'fold' });
    state = applyAction(state, 1, { type: 'call' });
    state = applyAction(state, 2, { type: 'check' });

    expect(state.street).toBe('flop');
    const flopSnap = state.streetSnapshots.flop!;
    expect(flopSnap).toBeDefined();

    // Finish hand by folding
    let finished = applyAction(state, 1, { type: 'raise', amount: 50 });
    finished = applyAction(finished, 2, { type: 'fold' });
    finished = applyAction(finished, 3, { type: 'fold' });
    finished = applyAction(finished, 4, { type: 'fold' });
    expect(finished.isHandOver).toBe(true);

    // Restore from Flop snapshot and play differently
    const branched = restoreFromStreetSnapshot(flopSnap);
    expect(branched.isHandOver).toBe(false);
    expect(branched.street).toBe('flop');
    expect(branched.pot).toBe(80);
    expect(branched.activeSeat).toBe(1);
  });
});

import { createDeck, shuffleDeck } from './deck';
import { evaluateBestHand } from './evaluator';
import { calculateSidePots, distributePots } from './sidePots';
import {
  ActionRecord,
  BettingStreet,
  HandEvalResult,
  HandState,
  HoldemCard,
  LegalActions,
  PlayerAction,
  PlayerState,
  PositionName,
  ShowdownResult,
  StreetSnapshot,
} from './types';

export interface CreateHandPlayerInput {
  seat: number;
  name: string;
  isHuman: boolean;
  stack: number;
}

export interface CreateHandConfig {
  handId: number;
  players: CreateHandPlayerInput[];
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  seed?: number;
  customDeck?: HoldemCard[];
}

const SIX_MAX_POSITIONS: readonly PositionName[] = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    holeCards: p.holeCards.map((c) => ({ ...c })),
  };
}

function captureSnapshot(state: HandState, street: BettingStreet): StreetSnapshot {
  return {
    handId: state.handId,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    dealerSeat: state.dealerSeat,
    street,
    players: state.players.map(clonePlayer),
    communityCards: state.communityCards.map((c) => ({ ...c })),
    deck: state.deck.map((c) => ({ ...c })),
    pot: state.pot,
    currentBet: state.currentBet,
    lastFullRaiseSize: state.lastFullRaiseSize,
    lastFullRaiseBet: state.lastFullRaiseBet,
    activeSeat: state.activeSeat,
    actions: state.actions.map((a) => ({ ...a, action: { ...a.action } })),
    initialTotalChips: state.initialTotalChips,
  };
}

/**
 * Restores a live playable HandState at the start of a recorded street snapshot.
 */
export function restoreFromStreetSnapshot(snapshot: StreetSnapshot): HandState {
  const restored: HandState = {
    handId: snapshot.handId,
    smallBlind: snapshot.smallBlind,
    bigBlind: snapshot.bigBlind,
    dealerSeat: snapshot.dealerSeat,
    street: snapshot.street,
    players: snapshot.players.map(clonePlayer),
    communityCards: snapshot.communityCards.map((c) => ({ ...c })),
    deck: snapshot.deck.map((c) => ({ ...c })),
    pot: snapshot.pot,
    currentBet: snapshot.currentBet,
    lastFullRaiseSize: snapshot.lastFullRaiseSize,
    lastFullRaiseBet: snapshot.lastFullRaiseBet,
    activeSeat: snapshot.activeSeat,
    actions: snapshot.actions.map((a) => ({ ...a, action: { ...a.action } })),
    streetSnapshots: {
      [snapshot.street]: {
        ...snapshot,
        players: snapshot.players.map(clonePlayer),
        communityCards: snapshot.communityCards.map((c) => ({ ...c })),
        deck: snapshot.deck.map((c) => ({ ...c })),
        actions: snapshot.actions.map((a) => ({ ...a, action: { ...a.action } })),
      },
    },
    showdown: null,
    isHandOver: false,
    initialTotalChips: snapshot.initialTotalChips,
  };
  return restored;
}

/**
 * Assigns standard Hold'em position labels clockwise starting from dealerSeat.
 */
export function assignPositions(
  seats: readonly number[],
  dealerSeat: number,
): Record<number, PositionName> {
  const sorted = [...seats].sort((a, b) => a - b);
  const n = sorted.length;
  const dealerIdx = sorted.indexOf(dealerSeat);
  const startIdx = dealerIdx >= 0 ? dealerIdx : 0;

  const clockwise: number[] = [];
  for (let i = 0; i < n; i++) {
    clockwise.push(sorted[(startIdx + i) % n]);
  }

  const labels: PositionName[] =
    n === 2
      ? ['BTN', 'BB']
      : n === 3
        ? ['BTN', 'SB', 'BB']
        : n === 4
          ? ['BTN', 'SB', 'BB', 'CO']
          : n === 5
            ? ['BTN', 'SB', 'BB', 'MP', 'CO']
            : [...SIX_MAX_POSITIONS];

  const map: Record<number, PositionName> = {};
  for (let i = 0; i < clockwise.length; i++) {
    map[clockwise[i]] = labels[i] ?? 'MP';
  }
  return map;
}

function getClockwiseSeatsFrom(
  players: readonly PlayerState[],
  afterSeat: number,
): PlayerState[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const total = sorted.length;
  let startIdx = sorted.findIndex((p) => p.seat > afterSeat);
  if (startIdx === -1) startIdx = 0;

  const ordered: PlayerState[] = [];
  for (let i = 0; i < total; i++) {
    ordered.push(sorted[(startIdx + i) % total]);
  }
  return ordered;
}

function findNextActingSeat(
  players: readonly PlayerState[],
  afterSeat: number,
  currentBet: number,
): number | null {
  const ordered = getClockwiseSeatsFrom(players, afterSeat);
  for (const p of ordered) {
    if (p.folded || p.allIn) continue;
    if (!p.hasActedThisStreet || p.streetBet < currentBet) {
      return p.seat;
    }
  }
  return null;
}

function findFirstPostflopSeat(
  players: readonly PlayerState[],
  dealerSeat: number,
): number | null {
  const ordered = getClockwiseSeatsFrom(players, dealerSeat);
  for (const p of ordered) {
    if (!p.folded && !p.allIn) {
      return p.seat;
    }
  }
  return null;
}

function settleHand(state: HandState, endedByFold: boolean): HandState {
  const nonFolded = state.players.filter((p) => !p.folded);
  const nonFoldedSeats = nonFolded.map((p) => p.seat);
  const pots = calculateSidePots(
    state.players.map((p) => ({
      seat: p.seat,
      totalCommitted: p.totalCommitted,
      folded: p.folded,
    })),
  );

  const evalsBySeat: Record<number, HandEvalResult> = {};
  if (!endedByFold && nonFolded.length > 1) {
    for (const p of nonFolded) {
      const combined = [...p.holeCards, ...state.communityCards];
      if (combined.length >= 5) {
        evalsBySeat[p.seat] = evaluateBestHand(combined);
      }
    }
  }

  const { payouts, totalWonBySeat } = distributePots(
    pots,
    evalsBySeat,
    state.dealerSeat,
    state.players.length,
    nonFoldedSeats,
  );

  const updatedPlayers = state.players.map((p) => {
    const won = totalWonBySeat[p.seat] ?? 0;
    return {
      ...p,
      stack: p.stack + won,
    };
  });

  const netDeltaBySeat: Record<number, number> = {};
  for (const p of updatedPlayers) {
    netDeltaBySeat[p.seat] = (totalWonBySeat[p.seat] ?? 0) - p.totalCommitted;
  }

  const winnerSeatSet = new Set<number>();
  for (const payout of payouts) {
    for (const w of payout.winners) {
      winnerSeatSet.add(w);
    }
  }

  const winningCardSet = new Set<string>();
  if (!endedByFold) {
    for (const wSeat of winnerSeatSet) {
      const ev = evalsBySeat[wSeat];
      if (ev) {
        for (const c of ev.bestFive) {
          winningCardSet.add(c.id);
        }
      }
    }
  }

  const showdown: ShowdownResult = {
    pots,
    payouts,
    totalWonBySeat,
    netDeltaBySeat,
    evalsBySeat,
    winningCardIds: [...winningCardSet],
    endedByFold,
    winnerSeats: [...winnerSeatSet],
  };

  return {
    ...state,
    street: 'showdown',
    players: updatedPlayers,
    activeSeat: null,
    showdown,
    isHandOver: true,
  };
}

function advanceStreetOrShowdown(state: HandState): HandState {
  const nonFolded = state.players.filter((p) => !p.folded);
  if (nonFolded.length <= 1) {
    return settleHand(state, true);
  }

  let current = state;
  const playersCanActCount = nonFolded.filter((p) => !p.allIn && p.stack > 0).length;

  while (true) {
    if (current.street === 'river') {
      return settleHand(current, false);
    }

    const nextStreet: BettingStreet =
      current.street === 'preflop'
        ? 'flop'
        : current.street === 'flop'
          ? 'turn'
          : 'river';

    const dealCount = nextStreet === 'flop' ? 3 : 1;
    const dealtCards = current.deck.slice(0, dealCount);
    const remainingDeck = current.deck.slice(dealCount);

    const resetPlayers: PlayerState[] = current.players.map((p) => ({
      ...p,
      streetBet: 0,
      hasActedThisStreet: false,
      lastActedAtFullRaiseBet: null,
      lastActionLabel: p.folded ? '弃牌' : p.allIn ? 'All-in' : undefined,
    }));

    const firstSeat =
      playersCanActCount >= 2
        ? findFirstPostflopSeat(resetPlayers, current.dealerSeat)
        : null;

    const nextState: HandState = {
      ...current,
      street: nextStreet,
      players: resetPlayers,
      communityCards: [...current.communityCards, ...dealtCards],
      deck: remainingDeck,
      currentBet: 0,
      lastFullRaiseSize: current.bigBlind,
      lastFullRaiseBet: 0,
      activeSeat: firstSeat,
    };

    nextState.streetSnapshots = {
      ...current.streetSnapshots,
      [nextStreet]: captureSnapshot(nextState, nextStreet),
    };

    if (playersCanActCount >= 2 && firstSeat !== null) {
      return nextState;
    }

    // Auto-runout when fewer than 2 non-folded players have chips left to bet
    current = nextState;
  }
}

export function createHand(config: CreateHandConfig): HandState {
  const eligiblePlayers = config.players
    .filter((p) => p.stack > 0)
    .sort((a, b) => a.seat - b.seat);

  if (eligiblePlayers.length < 2) {
    throw new Error('At least 2 players with positive stacks are required to start a hand');
  }

  const seats = eligiblePlayers.map((p) => p.seat);
  const dealerSeat = seats.includes(config.dealerSeat) ? config.dealerSeat : seats[0];
  const positions = assignPositions(seats, dealerSeat);

  const deck = config.customDeck
    ? config.customDeck.map((c) => ({ ...c }))
    : shuffleDeck(createDeck(), config.seed);

  const players: PlayerState[] = eligiblePlayers.map((p) => ({
    seat: p.seat,
    name: p.name,
    isHuman: p.isHuman,
    stack: p.stack,
    holeCards: [],
    streetBet: 0,
    totalCommitted: 0,
    folded: false,
    allIn: false,
    hasActedThisStreet: false,
    lastActedAtFullRaiseBet: null,
    position: positions[p.seat],
  }));

  const initialTotalChips = players.reduce((acc, p) => acc + p.stack, 0);

  // Determine SB and BB seats
  const isHeadsUp = players.length === 2;
  const sbSeat = isHeadsUp
    ? dealerSeat
    : getClockwiseSeatsFrom(players, dealerSeat)[0].seat;
  const bbSeat = getClockwiseSeatsFrom(players, sbSeat)[0].seat;

  // Deal 2 hole cards clockwise starting from SB
  const dealOrder = [
    players.find((p) => p.seat === sbSeat)!,
    ...getClockwiseSeatsFrom(players, sbSeat).filter((p) => p.seat !== sbSeat),
  ];
  let deckIdx = 0;
  for (let round = 0; round < 2; round++) {
    for (const p of dealOrder) {
      p.holeCards.push(deck[deckIdx++]);
    }
  }
  const remainingDeck = deck.slice(deckIdx);

  // Post blinds
  let pot = 0;
  const postBlind = (seat: number, amount: number, label: string) => {
    const p = players.find((x) => x.seat === seat)!;
    const posted = Math.min(p.stack, amount);
    p.stack -= posted;
    p.streetBet += posted;
    p.totalCommitted += posted;
    pot += posted;
    if (p.stack === 0) {
      p.allIn = true;
      p.lastActionLabel = `${label} All-in`;
    } else {
      p.lastActionLabel = `${label} ${posted}`;
    }
    return posted;
  };

  const sbPosted = postBlind(sbSeat, config.smallBlind, '小盲');
  const bbPosted = postBlind(bbSeat, config.bigBlind, '大盲');
  const currentBet = Math.max(sbPosted, bbPosted);

  const canActPlayers = players.filter((p) => !p.allIn);
  const firstPreFlopSeat =
    canActPlayers.length >= 2
      ? findNextActingSeat(players, bbSeat, currentBet)
      : null;

  const initialState: HandState = {
    handId: config.handId,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    dealerSeat,
    street: 'preflop',
    players,
    communityCards: [],
    deck: remainingDeck,
    pot,
    currentBet,
    lastFullRaiseSize: config.bigBlind,
    lastFullRaiseBet: config.bigBlind,
    activeSeat: firstPreFlopSeat,
    actions: [],
    streetSnapshots: {},
    showdown: null,
    isHandOver: false,
    initialTotalChips,
  };

  initialState.streetSnapshots = {
    preflop: captureSnapshot(initialState, 'preflop'),
  };

  if (canActPlayers.length < 2 || firstPreFlopSeat === null) {
    return advanceStreetOrShowdown(initialState);
  }

  return initialState;
}

export function getLegalActions(state: HandState, seat: number): LegalActions {
  const empty: LegalActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canRaise: false,
    minRaiseTo: 0,
    maxRaiseTo: 0,
    canAllIn: false,
    isReopened: false,
  };

  if (state.isHandOver || state.activeSeat !== seat) {
    return empty;
  }

  const player = state.players.find((p) => p.seat === seat);
  if (!player || player.folded || player.allIn) {
    return empty;
  }

  const toCall = Math.max(0, state.currentBet - player.streetBet);
  const canCheck = toCall === 0;
  const canFold = toCall > 0;
  const canCall = toCall > 0 && player.stack > 0;
  const callAmount = Math.min(player.stack, toCall);
  const maxRaiseTo = player.streetBet + player.stack;

  // Check if at least one other non-folded player has chips left to match a raise
  const otherLivePlayers = state.players.filter(
    (p) => p.seat !== seat && !p.folded && !p.allIn && p.stack > 0,
  );

  // Short all-in reopen check: if player already acted at the last full raise level, cannot reopen betting
  const isReopened =
    !player.hasActedThisStreet ||
    player.lastActedAtFullRaiseBet === null ||
    player.lastActedAtFullRaiseBet < state.lastFullRaiseBet;

  const minIncrement =
    state.currentBet === 0
      ? state.bigBlind
      : Math.max(state.bigBlind, state.lastFullRaiseSize);
  const rawMinRaiseTo = state.currentBet + minIncrement;

  const canAllIn = player.stack > 0 && (toCall < player.stack || canCall);

  const canRaise =
    isReopened &&
    otherLivePlayers.length > 0 &&
    maxRaiseTo > state.currentBet &&
    maxRaiseTo >= rawMinRaiseTo;

  const minRaiseTo = canRaise ? rawMinRaiseTo : maxRaiseTo;

  return {
    canFold,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    canAllIn,
    isReopened,
  };
}

export function validateAction(
  state: HandState,
  seat: number,
  action: PlayerAction,
): { valid: boolean; reason?: string } {
  if (state.isHandOver) {
    return { valid: false, reason: 'Hand is already over' };
  }
  if (state.activeSeat !== seat) {
    return { valid: false, reason: `Not seat ${seat}'s turn (active: ${state.activeSeat})` };
  }

  const player = state.players.find((p) => p.seat === seat);
  if (!player || player.folded || player.allIn) {
    return { valid: false, reason: 'Player cannot act' };
  }

  const legal = getLegalActions(state, seat);
  const maxRaiseTo = player.streetBet + player.stack;

  switch (action.type) {
    case 'fold':
      if (!legal.canFold) {
        return { valid: false, reason: 'Cannot fold when facing no bet (use check)' };
      }
      return { valid: true };
    case 'check':
      if (!legal.canCheck) {
        return { valid: false, reason: 'Cannot check when facing a bet' };
      }
      return { valid: true };
    case 'call':
      if (!legal.canCall) {
        return { valid: false, reason: 'No bet to call' };
      }
      return { valid: true };
    case 'all_in':
      if (!legal.canAllIn) {
        return { valid: false, reason: 'Player has no chips to go all-in' };
      }
      // If facing a short all-in that didn't reopen betting, player can still call all-in if stack <= toCall,
      // or cannot raise if stack > toCall and !isReopened.
      if (!legal.isReopened && maxRaiseTo > state.currentBet) {
        return { valid: false, reason: 'Betting was not reopened by a prior short all-in' };
      }
      return { valid: true };
    case 'raise': {
      const target = action.amount;
      if (target === undefined || !Number.isFinite(target) || Math.floor(target) !== target) {
        return { valid: false, reason: 'Raise requires an integer target streetBet amount' };
      }
      if (!legal.isReopened) {
        return { valid: false, reason: 'Betting was not reopened by a prior short all-in' };
      }
      if (target > maxRaiseTo) {
        return { valid: false, reason: `Raise target ${target} exceeds max stack ${maxRaiseTo}` };
      }
      if (target <= state.currentBet) {
        return { valid: false, reason: `Raise target ${target} must exceed currentBet ${state.currentBet}` };
      }
      const isAllIn = target === maxRaiseTo;
      if (!isAllIn && !legal.canRaise) {
        return { valid: false, reason: 'Raising is not legal in this spot' };
      }
      if (!isAllIn && target < legal.minRaiseTo) {
        return {
          valid: false,
          reason: `Raise target ${target} is below min-raise ${legal.minRaiseTo}`,
        };
      }
      if (isAllIn && !legal.canRaise && target < legal.minRaiseTo) {
        // Short all-in above currentBet is allowed as an all-in raise if betting was reopened
        return { valid: true };
      }
      return { valid: true };
    }
  }
}

export function applyAction(
  state: HandState,
  seat: number,
  action: PlayerAction,
): HandState {
  const check = validateAction(state, seat, action);
  if (!check.valid) {
    throw new Error(`Invalid action for seat ${seat}: ${check.reason}`);
  }

  const street = state.street;
  if (street === 'showdown') {
    throw new Error('Cannot apply action at showdown');
  }

  const players = state.players.map(clonePlayer);
  const actor = players.find((p) => p.seat === seat)!;

  let amountAdded = 0;
  let nextCurrentBet = state.currentBet;
  let nextLastFullRaiseSize = state.lastFullRaiseSize;
  let nextLastFullRaiseBet = state.lastFullRaiseBet;
  let label = '';

  const toCall = Math.max(0, state.currentBet - actor.streetBet);

  if (action.type === 'fold') {
    actor.folded = true;
    actor.hasActedThisStreet = true;
    label = '弃牌';
  } else if (action.type === 'check') {
    actor.hasActedThisStreet = true;
    label = '过牌';
  } else if (action.type === 'call') {
    amountAdded = Math.min(actor.stack, toCall);
    actor.stack -= amountAdded;
    actor.streetBet += amountAdded;
    actor.totalCommitted += amountAdded;
    actor.hasActedThisStreet = true;
    actor.lastActedAtFullRaiseBet = state.lastFullRaiseBet;
    if (actor.stack === 0) {
      actor.allIn = true;
      label = `All-in ${actor.streetBet}`;
    } else {
      label = `跟注 ${amountAdded}`;
    }
  } else {
    const targetStreetBet =
      action.type === 'all_in' ? actor.streetBet + actor.stack : action.amount!;
    amountAdded = targetStreetBet - actor.streetBet;
    actor.stack -= amountAdded;
    actor.streetBet = targetStreetBet;
    actor.totalCommitted += amountAdded;
    actor.hasActedThisStreet = true;
    if (actor.stack === 0) {
      actor.allIn = true;
    }

    if (targetStreetBet > state.currentBet) {
      const increment = targetStreetBet - state.currentBet;
      const minFullInc =
        state.currentBet === 0 ? state.bigBlind : state.lastFullRaiseSize;
      const isFullRaise = increment >= minFullInc;

      nextCurrentBet = targetStreetBet;
      if (isFullRaise) {
        nextLastFullRaiseSize = increment;
        nextLastFullRaiseBet = targetStreetBet;
        actor.lastActedAtFullRaiseBet = targetStreetBet;
      } else {
        // Short all-in does NOT update lastFullRaiseBet, preserving reopen protection
        actor.lastActedAtFullRaiseBet = state.lastFullRaiseBet;
      }

      if (actor.allIn) {
        label = `All-in ${targetStreetBet}`;
      } else {
        label = state.currentBet === 0 ? `下注 ${targetStreetBet}` : `加注至 ${targetStreetBet}`;
      }
    } else {
      // All-in that only calls or under-calls
      actor.lastActedAtFullRaiseBet = state.lastFullRaiseBet;
      label = `All-in ${targetStreetBet}`;
    }
  }

  actor.lastActionLabel = label;

  const nextPot = state.pot + amountAdded;
  const record: ActionRecord = {
    seq: state.actions.length + 1,
    street,
    seat,
    position: actor.position,
    action: { ...action },
    amountAdded,
    resultingStreetBet: actor.streetBet,
    potAfter: nextPot,
    isAllIn: actor.allIn,
  };

  const nextStateBase: HandState = {
    ...state,
    players,
    pot: nextPot,
    currentBet: nextCurrentBet,
    lastFullRaiseSize: nextLastFullRaiseSize,
    lastFullRaiseBet: nextLastFullRaiseBet,
    actions: [...state.actions, record],
  };

  const nonFolded = players.filter((p) => !p.folded);
  if (nonFolded.length <= 1) {
    return settleHand(nextStateBase, true);
  }

  const nextSeat = findNextActingSeat(players, seat, nextCurrentBet);
  if (nextSeat !== null) {
    return {
      ...nextStateBase,
      activeSeat: nextSeat,
    };
  }

  // Betting round finished; proceed to next street or showdown
  return advanceStreetOrShowdown(nextStateBase);
}

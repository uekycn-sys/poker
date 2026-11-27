import {
  BidAction,
  Card,
  DoubleChoice,
  GameState,
  MatchSettlement,
  MoveRecord,
  Seat,
} from './types';
import { dealCards, sortCardsByRank } from './deck';
import { matchPatternToBeat } from './rules';

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}

export function createInitialGameState(baseScore = 100): GameState {
  return {
    phase: 'IDLE',
    baseScore,
    hands: [[], [], []],
    bottomCards: [],
    landlordSeat: null,
    currentTurn: 0,
    starterSeat: 0,
    firstCallerSeat: null,
    passedBeforeCall: [],
    grabQueue: [],
    otherGrabbed: false,
    bidHistory: [],
    grabCount: 0,
    mingpaiSeats: [],
    mingpaiMultiplier: 1,
    doubleChoices: [null, null, null],
    lastPlay: null,
    passCount: 0,
    playCounts: [0, 0, 0],
    bombCount: 0,
    rocketCount: 0,
    moveHistory: [],
    settlement: null,
    redealCount: 0,
  };
}

export function startNewMatch(
  baseScore = 100,
  starterSeat: Seat = 0,
  rng?: () => number,
  redealCount = 0,
): GameState {
  const { hands, bottomCards } = dealCards(undefined, rng);
  return {
    ...createInitialGameState(baseScore),
    phase: 'BIDDING',
    hands,
    bottomCards,
    currentTurn: starterSeat,
    starterSeat,
    redealCount,
  };
}

/**
 * Activate Mingpai (明牌):
 * - During BIDDING: sets mingpaiMultiplier to at least 4 (or keeps higher).
 * - Before landlord's first play in PLAYING: multiplies by 2 (at least 2).
 */
export function activateMingpai(state: GameState, seat: Seat): GameState {
  if (state.mingpaiSeats.includes(seat)) return state;
  if (state.phase === 'BIDDING') {
    return {
      ...state,
      mingpaiSeats: [...state.mingpaiSeats, seat],
      mingpaiMultiplier: Math.max(state.mingpaiMultiplier, 4),
    };
  }
  if (state.phase === 'PLAYING' && seat === state.landlordSeat && state.playCounts[seat] === 0) {
    return {
      ...state,
      mingpaiSeats: [...state.mingpaiSeats, seat],
      mingpaiMultiplier: Math.max(state.mingpaiMultiplier, 2),
    };
  }
  throw new Error('Mingpai is only allowed during bidding or before the landlord plays their first card');
}

function finalizeBidding(state: GameState): GameState {
  const landlord = state.landlordSeat;
  if (landlord === null) {
    throw new Error('Cannot finalize bidding without a landlord');
  }
  const nextHands: [Card[], Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
    [...state.hands[2]],
  ];
  nextHands[landlord] = sortCardsByRank([...nextHands[landlord], ...state.bottomCards]);

  return {
    ...state,
    phase: 'DOUBLING',
    hands: nextHands,
    currentTurn: landlord,
    grabQueue: [],
  };
}

/**
 * Apply a Call / Grab / Pass decision during the BIDDING phase.
 * Implements standard Happy Dou Dizhu (欢乐斗地主) bidding:
 * - Players who passed initial CALL cannot GRAB later.
 * - If at least one other eligible player grabs, the first caller gets one final counter-grab turn.
 * - If all three players pass initial CALL, automatically re-deals and increments `redealCount`.
 */
export function applyBidAction(
  state: GameState,
  seat: Seat,
  action: BidAction,
  rng?: () => number,
): GameState {
  if (state.phase !== 'BIDDING') {
    throw new Error(`Invalid bid in phase ${state.phase}`);
  }
  if (state.currentTurn !== seat) {
    throw new Error(`Not seat ${seat}'s turn to bid (currentTurn=${state.currentTurn})`);
  }

  const bidHistory = [...state.bidHistory, { seat, action }];

  if (state.firstCallerSeat === null) {
    if (action === 'GRAB') {
      throw new Error('Cannot GRAB before someone CALLs');
    }
    if (action === 'PASS') {
      const passedBeforeCall = [...state.passedBeforeCall, seat];
      if (passedBeforeCall.length === 3) {
        return startNewMatch(state.baseScore, nextSeat(state.starterSeat), rng, state.redealCount + 1);
      }
      return {
        ...state,
        passedBeforeCall,
        bidHistory,
        currentTurn: nextSeat(seat),
      };
    }

    // action === 'CALL'
    const candidate1 = nextSeat(seat);
    const candidate2 = nextSeat(candidate1);
    const grabQueue = [candidate1, candidate2].filter((s) => !state.passedBeforeCall.includes(s));
    const nextState: GameState = {
      ...state,
      firstCallerSeat: seat,
      landlordSeat: seat,
      grabQueue,
      otherGrabbed: false,
      bidHistory,
    };
    if (grabQueue.length === 0) {
      return finalizeBidding(nextState);
    }
    return {
      ...nextState,
      currentTurn: grabQueue[0],
    };
  }

  // Subsequent GRAB / PASS after firstCallerSeat is known
  if (action === 'CALL') {
    throw new Error('Cannot CALL after someone has already called');
  }
  if (state.grabQueue[0] !== seat) {
    throw new Error(`Unexpected bidder ${seat}; expected ${state.grabQueue[0]}`);
  }

  const remainingQueue = state.grabQueue.slice(1);
  let grabCount = state.grabCount;
  let landlordSeat = state.landlordSeat;
  let otherGrabbed = state.otherGrabbed;

  if (action === 'GRAB') {
    grabCount += 1;
    landlordSeat = seat;
    if (seat !== state.firstCallerSeat) {
      otherGrabbed = true;
    }
  }

  if (remainingQueue.length === 0 && otherGrabbed && seat !== state.firstCallerSeat) {
    remainingQueue.push(state.firstCallerSeat);
  }

  const updated: GameState = {
    ...state,
    grabQueue: remainingQueue,
    grabCount,
    landlordSeat,
    otherGrabbed,
    bidHistory,
  };

  if (remainingQueue.length === 0) {
    return finalizeBidding(updated);
  }

  return {
    ...updated,
    currentTurn: remainingQueue[0],
  };
}

/** Record a player's double choice (1x, 2x, 4x). Once all 3 choose, transitions to PLAYING. */
export function applyDoubleChoice(state: GameState, seat: Seat, choice: DoubleChoice): GameState {
  if (state.phase !== 'DOUBLING') {
    throw new Error(`Invalid double choice in phase ${state.phase}`);
  }
  if (state.doubleChoices[seat] !== null) {
    throw new Error(`Seat ${seat} has already made a double choice`);
  }

  const doubleChoices: [DoubleChoice | null, DoubleChoice | null, DoubleChoice | null] = [
    ...state.doubleChoices,
  ] as [DoubleChoice | null, DoubleChoice | null, DoubleChoice | null];
  doubleChoices[seat] = choice;

  const allChosen = doubleChoices.every((c) => c !== null);
  return {
    ...state,
    doubleChoices,
    phase: allChosen ? 'PLAYING' : 'DOUBLING',
    currentTurn: allChosen ? (state.landlordSeat as Seat) : nextSeat(seat),
  };
}

/** Compute the shared public multiplier before per-player doubling factors. */
export function calculatePublicMultiplier(
  state: GameState,
  isSpring = false,
  isAntiSpring = false,
): number {
  const grabMult = 2 ** state.grabCount;
  const bombMult = 2 ** (state.bombCount + state.rocketCount);
  const mingpaiMult = Math.max(1, state.mingpaiMultiplier);
  const springMult = isSpring || isAntiSpring ? 2 : 1;
  return grabMult * bombMult * mingpaiMult * springMult;
}

/** Calculate match settlement, Spring / Anti-Spring status, and zero-sum bean deltas. */
export function calculateSettlement(state: GameState, winnerSeat: Seat): MatchSettlement {
  if (state.landlordSeat === null) {
    throw new Error('Cannot settle match without landlordSeat');
  }
  const landlord = state.landlordSeat;
  const winnerRole = winnerSeat === landlord ? 'landlord' : 'farmer';
  const farmers = ([0, 1, 2] as Seat[]).filter((s) => s !== landlord);

  const isSpring = winnerRole === 'landlord' && farmers.every((f) => state.playCounts[f] === 0);
  const isAntiSpring = winnerRole === 'farmer' && state.playCounts[landlord] === 1;

  const publicMultiplier = calculatePublicMultiplier(state, isSpring, isAntiSpring);
  const dLandlord = state.doubleChoices[landlord] ?? 1;

  const effectiveMultipliers: [number, number, number] = [1, 1, 1];
  const beanDeltas: [number, number, number] = [0, 0, 0];

  let farmerMagnitudeSum = 0;
  for (const f of farmers) {
    const dFarmer = state.doubleChoices[f] ?? 1;
    const mult = publicMultiplier * dLandlord * dFarmer;
    effectiveMultipliers[f] = mult;
    const mag = state.baseScore * mult;
    farmerMagnitudeSum += mag;
    beanDeltas[f] = winnerRole === 'farmer' ? mag : -mag;
  }

  effectiveMultipliers[landlord] = farmers.reduce<number>(
    (sum, f) => sum + effectiveMultipliers[f],
    0,
  );
  beanDeltas[landlord] = winnerRole === 'landlord' ? farmerMagnitudeSum : -farmerMagnitudeSum;

  return {
    winnerRole,
    winnerSeat,
    isSpring,
    isAntiSpring,
    baseScore: state.baseScore,
    publicMultiplier,
    effectiveMultipliers,
    beanDeltas,
    breakdown: {
      grabCount: state.grabCount,
      bombCount: state.bombCount,
      rocketCount: state.rocketCount,
      mingpaiMultiplier: state.mingpaiMultiplier,
      springMultiplier: isSpring || isAntiSpring ? 2 : 1,
    },
  };
}

function cloneHands(hands: [Card[], Card[], Card[]]): [Card[], Card[], Card[]] {
  return [[...hands[0]], [...hands[1]], [...hands[2]]];
}

/** Play `cards` for `seat` during PLAYING phase, validating ownership and rule compliance. */
export function applyPlayCards(state: GameState, seat: Seat, cards: Card[]): GameState {
  if (state.phase !== 'PLAYING') {
    throw new Error(`Cannot play cards in phase ${state.phase}`);
  }
  if (state.currentTurn !== seat) {
    throw new Error(`Not seat ${seat}'s turn (currentTurn=${state.currentTurn})`);
  }
  if (cards.length === 0) {
    throw new Error('Cannot play 0 cards');
  }

  const handIds = new Set(state.hands[seat].map((c) => c.id));
  const playedIds = new Set<string>();
  for (const c of cards) {
    if (!handIds.has(c.id)) {
      throw new Error(`Card ${c.id} is not in seat ${seat}'s hand`);
    }
    if (playedIds.has(c.id)) {
      throw new Error(`Duplicate card ${c.id} in play`);
    }
    playedIds.add(c.id);
  }

  const pattern = matchPatternToBeat(cards, state.lastPlay?.pattern ?? null);
  if (!pattern) {
    throw new Error('Selected cards do not form a valid pattern that beats the previous play');
  }

  const snapshot = cloneHands(state.hands);
  const move: MoveRecord = {
    index: state.moveHistory.length,
    seat,
    isPass: false,
    cards: [...cards],
    pattern,
    handsSnapshot: snapshot,
    lastPlayBefore: state.lastPlay,
    timestamp: Date.now(),
  };

  const nextHands = cloneHands(state.hands);
  nextHands[seat] = nextHands[seat].filter((c) => !playedIds.has(c.id));

  const playCounts: [number, number, number] = [...state.playCounts] as [number, number, number];
  playCounts[seat] += 1;

  const bombCount = state.bombCount + (pattern.type === 'BOMB' ? 1 : 0);
  const rocketCount = state.rocketCount + (pattern.type === 'ROCKET' ? 1 : 0);

  const nextState: GameState = {
    ...state,
    hands: nextHands,
    lastPlay: { seat, pattern },
    passCount: 0,
    playCounts,
    bombCount,
    rocketCount,
    moveHistory: [...state.moveHistory, move],
  };

  if (nextHands[seat].length === 0) {
    return {
      ...nextState,
      phase: 'FINISHED',
      settlement: calculateSettlement(nextState, seat),
    };
  }

  return {
    ...nextState,
    currentTurn: nextSeat(seat),
  };
}

/** Pass the current turn (only allowed when following another player's play). */
export function applyPassTurn(state: GameState, seat: Seat): GameState {
  if (state.phase !== 'PLAYING') {
    throw new Error(`Cannot pass in phase ${state.phase}`);
  }
  if (state.currentTurn !== seat) {
    throw new Error(`Not seat ${seat}'s turn (currentTurn=${state.currentTurn})`);
  }
  if (state.lastPlay === null) {
    throw new Error('Cannot pass on a free lead');
  }

  const move: MoveRecord = {
    index: state.moveHistory.length,
    seat,
    isPass: true,
    cards: [],
    pattern: null,
    handsSnapshot: cloneHands(state.hands),
    lastPlayBefore: state.lastPlay,
    timestamp: Date.now(),
  };

  const nextPassCount = state.passCount + 1;
  const resetTrick = nextPassCount >= 2;

  return {
    ...state,
    lastPlay: resetTrick ? null : state.lastPlay,
    passCount: resetTrick ? 0 : nextPassCount,
    moveHistory: [...state.moveHistory, move],
    currentTurn: nextSeat(seat),
  };
}

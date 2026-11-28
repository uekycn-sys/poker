import { Card, GameState, Rank, Seat } from './types';
import { createDeck, sortCardsByRank } from './deck';
import { computeExternalRemainingCounts, ExternalCardCounts } from './cardCounter';

export type SeatRankWeights = [Record<Rank, number>, Record<Rank, number>, Record<Rank, number>];

const ALL_RANKS: Rank[] = [
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.EIGHT,
  Rank.NINE,
  Rank.TEN,
  Rank.JACK,
  Rank.QUEEN,
  Rank.KING,
  Rank.ACE,
  Rank.TWO,
  Rank.SMALL_JOKER,
  Rank.BIG_JOKER,
];

function createUniformWeights(): Record<Rank, number> {
  const weights = {} as Record<Rank, number>;
  for (const r of ALL_RANKS) {
    weights[r] = 1.0;
  }
  return weights;
}

/**
 * Infer per-seat rank probability weights strictly from public game observations
 * (`bidHistory`, `doubleChoices`, `moveHistory`) without inspecting hidden hands.
 */
export function computeSeatRankWeights(
  state: GameState,
  observerSeat: Seat,
): SeatRankWeights {
  const weights: SeatRankWeights = [
    createUniformWeights(),
    createUniformWeights(),
    createUniformWeights(),
  ];

  const landlord = state.landlordSeat;
  const isUnknown = (seat: Seat) =>
    seat !== observerSeat && !state.mingpaiSeats.includes(seat);

  // 1. Bidding signals: CALL / GRAB indicates high control cards; PASS suggests weaker control
  for (const bid of state.bidHistory) {
    if (!isUnknown(bid.seat)) continue;
    const w = weights[bid.seat];
    if (bid.action === 'CALL' || bid.action === 'GRAB') {
      w[Rank.ACE] *= 1.2;
      w[Rank.TWO] *= 1.45;
      w[Rank.SMALL_JOKER] *= 1.45;
      w[Rank.BIG_JOKER] *= 1.55;
    } else if (bid.action === 'PASS') {
      w[Rank.TWO] *= 0.82;
      w[Rank.SMALL_JOKER] *= 0.78;
      w[Rank.BIG_JOKER] *= 0.75;
    }
  }

  // 2. Doubling signals
  for (const seat of [0, 1, 2] as Seat[]) {
    if (!isUnknown(seat)) continue;
    const dbl = state.doubleChoices[seat];
    if (dbl === 4) {
      weights[seat][Rank.ACE] *= 1.25;
      weights[seat][Rank.TWO] *= 1.6;
      weights[seat][Rank.SMALL_JOKER] *= 1.75;
      weights[seat][Rank.BIG_JOKER] *= 1.85;
    } else if (dbl === 2) {
      weights[seat][Rank.TWO] *= 1.3;
      weights[seat][Rank.SMALL_JOKER] *= 1.35;
      weights[seat][Rank.BIG_JOKER] *= 1.4;
    }
  }

  // 3. Play / Pass history negative & positive inference
  for (const move of state.moveHistory) {
    const s = move.seat;
    if (!isUnknown(s)) continue;
    const w = weights[s];

    if (move.isPass && move.lastPlayBefore) {
      const prev = move.lastPlayBefore.pattern;
      const attacker = move.lastPlayBefore.seat;
      const isOpponent =
        landlord === null || (s === landlord) !== (attacker === landlord);

      // Farmer passing on teammate is often intentional yielding, not lack of cards
      if (!isOpponent) continue;

      if (prev.type === 'SINGLE') {
        if (prev.mainRank >= Rank.JACK) {
          const factor = prev.mainRank >= Rank.KING ? 0.22 : 0.45;
          for (let r = prev.mainRank + 1; r <= Rank.TWO; r++) {
            w[r as Rank] *= factor;
          }
          if (prev.mainRank >= Rank.TWO) {
            w[Rank.SMALL_JOKER] *= 0.2;
            w[Rank.BIG_JOKER] *= 0.2;
          } else if (prev.mainRank >= Rank.ACE) {
            w[Rank.SMALL_JOKER] *= 0.32;
            w[Rank.BIG_JOKER] *= 0.32;
          }
        } else if (prev.mainRank === Rank.SMALL_JOKER) {
          w[Rank.BIG_JOKER] *= 0.15;
        }
      } else if (prev.type === 'PAIR' && prev.mainRank >= Rank.NINE) {
        const factor = prev.mainRank >= Rank.QUEEN ? 0.32 : 0.52;
        for (let r = prev.mainRank + 1; r <= Rank.TWO; r++) {
          w[r as Rank] *= factor;
        }
      } else if (
        (prev.type === 'TRIPLE' ||
          prev.type === 'TRIPLE_WITH_SINGLE' ||
          prev.type === 'TRIPLE_WITH_PAIR') &&
        prev.mainRank >= Rank.TEN
      ) {
        for (let r = prev.mainRank + 1; r <= Rank.TWO; r++) {
          w[r as Rank] *= 0.55;
        }
      } else if (prev.type === 'BOMB') {
        w[Rank.SMALL_JOKER] *= 0.25;
        w[Rank.BIG_JOKER] *= 0.25;
      }
    } else if (!move.isPass && move.pattern) {
      // Playing a low/medium pure single often signals no pair/triple of that rank in hand
      if (move.pattern.type === 'SINGLE' && move.pattern.mainRank <= Rank.KING) {
        w[move.pattern.mainRank] *= 0.78;
      }
    }
  }

  // Clamp weights to prevent zeroing out feasible distributions
  for (const s of [0, 1, 2] as Seat[]) {
    for (const r of ALL_RANKS) {
      weights[s][r] = Math.max(0.05, Math.min(4.0, weights[s][r]));
    }
  }

  return weights;
}

function buildUnknownCardPool(
  state: GameState,
  observerSeat: Seat,
): { pool: Card[]; ext: ExternalCardCounts } {
  const ext = computeExternalRemainingCounts(state.hands[observerSeat], state.moveHistory);

  // Subtract visible mingpai seats' current cards
  const knownIds = new Set<string>(state.hands[observerSeat].map((c) => c.id));
  for (const m of state.moveHistory) {
    if (m.isPass) continue;
    for (const c of m.cards) knownIds.add(c.id);
  }
  for (const s of state.mingpaiSeats) {
    if (s === observerSeat) continue;
    for (const c of state.hands[s]) {
      ext[c.rank] = Math.max(0, ext[c.rank] - 1);
      knownIds.add(c.id);
    }
  }

  const remainingNeeded = { ...ext };
  const pool: Card[] = [];
  for (const card of createDeck()) {
    if (knownIds.has(card.id)) continue;
    if (remainingNeeded[card.rank] > 0) {
      remainingNeeded[card.rank] -= 1;
      pool.push(card);
    }
  }

  return { pool, ext };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function pickWeightedSubset(
  pool: Card[],
  count: number,
  seatWeights: Record<Rank, number>,
  rng: () => number,
): { picked: Card[]; rest: Card[] } {
  if (count <= 0) return { picked: [], rest: pool };
  if (count >= pool.length) return { picked: [...pool], rest: [] };

  const keyed = pool.map((card) => {
    const u = Math.max(1e-9, rng());
    const w = seatWeights[card.rank] ?? 1;
    return { card, key: -Math.log(u) / w };
  });
  keyed.sort((a, b) => a.key - b.key);

  return {
    picked: keyed.slice(0, count).map((k) => k.card),
    rest: keyed.slice(count).map((k) => k.card),
  };
}

/**
 * Sample `sampleCount` plausible full 3-hand worlds `[Card[], Card[], Card[]]` consistent
 * with `observerSeat`'s hand, `mingpaiSeats`, card counts of other seats, and behavioral weights
 * inferred from `moveHistory` / `bidHistory` / `doubleChoices`.
 * Never inspects hidden opponent/teammate cards.
 */
export function sampleDeterminizedHands(
  state: GameState,
  observerSeat: Seat,
  sampleCount: number,
  rng: () => number = Math.random,
): Array<[Card[], Card[], Card[]]> {
  const unknownSeats: Seat[] = ([0, 1, 2] as Seat[]).filter(
    (s) => s !== observerSeat && !state.mingpaiSeats.includes(s),
  );

  const makeVisibleBase = (): [Card[], Card[], Card[]] => [
    observerSeat === 0 || state.mingpaiSeats.includes(0) ? [...state.hands[0]] : [],
    observerSeat === 1 || state.mingpaiSeats.includes(1) ? [...state.hands[1]] : [],
    observerSeat === 2 || state.mingpaiSeats.includes(2) ? [...state.hands[2]] : [],
  ];

  if (unknownSeats.length === 0) {
    return [makeVisibleBase()];
  }

  const { pool } = buildUnknownCardPool(state, observerSeat);
  const weights = computeSeatRankWeights(state, observerSeat);
  const samples: Array<[Card[], Card[], Card[]]> = [];

  for (let i = 0; i < sampleCount; i++) {
    const hands = makeVisibleBase();

    if (unknownSeats.length === 1) {
      const u = unknownSeats[0];
      const need = state.hands[u].length;
      const { picked } = pickWeightedSubset(pool, need, weights[u], rng);
      hands[u] = sortCardsByRank(picked);
      samples.push(hands);
      continue;
    }

    const u1 = unknownSeats[0];
    const u2 = unknownSeats[1];
    const c1 = state.hands[u1].length;
    const c2 = state.hands[u2].length;

    if (c1 + c2 >= pool.length) {
      // Exact partition of external pool in O(pool.length)
      const shuffled = [...pool];
      shuffleInPlace(shuffled, rng);
      let rem1 = c1;
      let rem2 = c2;
      const h1: Card[] = [];
      const h2: Card[] = [];
      const w1Map = weights[u1];
      const w2Map = weights[u2];

      for (const card of shuffled) {
        if (rem1 <= 0 && rem2 <= 0) break;
        if (rem1 <= 0) {
          h2.push(card);
          rem2--;
          continue;
        }
        if (rem2 <= 0) {
          h1.push(card);
          rem1--;
          continue;
        }
        const score1 = w1Map[card.rank] * rem1;
        const score2 = w2Map[card.rank] * rem2;
        const p1 = score1 / (score1 + score2);
        if (rng() < p1) {
          h1.push(card);
          rem1--;
        } else {
          h2.push(card);
          rem2--;
        }
      }

      hands[u1] = sortCardsByRank(h1);
      hands[u2] = sortCardsByRank(h2);
    } else {
      // Partial pool (e.g., synthetic midgame test states without full moveHistory)
      const first = pickWeightedSubset(pool, c1, weights[u1], rng);
      const second = pickWeightedSubset(first.rest, c2, weights[u2], rng);
      hands[u1] = sortCardsByRank(first.picked);
      hands[u2] = sortCardsByRank(second.picked);
    }

    samples.push(hands);
  }

  return samples;
}

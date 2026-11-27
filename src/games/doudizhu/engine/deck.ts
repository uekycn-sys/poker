import { secureShuffle } from '../../../shared/random';
import { Card, Rank, SUIT_ORDER, Suit } from './types';

const STANDARD_SUITS: Exclude<Suit, 'joker'>[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const STANDARD_RANKS: Rank[] = [
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
];

/** Create a standard 54-card Dou Dizhu deck in deterministic order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of STANDARD_RANKS) {
    for (const suit of STANDARD_SUITS) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  deck.push({ id: `joker-${Rank.SMALL_JOKER}`, suit: 'joker', rank: Rank.SMALL_JOKER });
  deck.push({ id: `joker-${Rank.BIG_JOKER}`, suit: 'joker', rank: Rank.BIG_JOKER });
  return deck;
}

/** Pure Fisher-Yates shuffle returning a new array (uses CSPRNG when rng is omitted). */
export function shuffleDeck(deck: Card[], rng?: () => number): Card[] {
  return secureShuffle(deck, rng);
}

/** Sort cards descending by rank, breaking ties by suit priority (spades > hearts > clubs > diamonds). */
export function sortCardsByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
  });
}

/**
 * Group cards by pattern weight for easy reading:
 * Rocket -> Bombs (rank desc) -> Triples (rank desc) -> Pairs (rank desc) -> Singles (rank desc).
 */
export function sortCardsByPattern(cards: Card[]): Card[] {
  const byRank = new Map<Rank, Card[]>();
  for (const card of sortCardsByRank(cards)) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }

  const hasSmall = byRank.has(Rank.SMALL_JOKER);
  const hasBig = byRank.has(Rank.BIG_JOKER);
  const rocket: Card[] = [];
  if (hasSmall && hasBig) {
    rocket.push(...(byRank.get(Rank.BIG_JOKER) ?? []), ...(byRank.get(Rank.SMALL_JOKER) ?? []));
    byRank.delete(Rank.BIG_JOKER);
    byRank.delete(Rank.SMALL_JOKER);
  }

  const bombs: Card[] = [];
  const triples: Card[] = [];
  const pairs: Card[] = [];
  const singles: Card[] = [];

  const ranksDesc = [...byRank.keys()].sort((a, b) => b - a);
  for (const rank of ranksDesc) {
    const group = byRank.get(rank)!;
    if (group.length === 4) {
      bombs.push(...group);
    } else if (group.length === 3) {
      triples.push(...group);
    } else if (group.length === 2) {
      pairs.push(...group);
    } else {
      singles.push(...group);
    }
  }

  return [...rocket, ...bombs, ...triples, ...pairs, ...singles];
}

/** Deal 17 cards round-robin to each of the 3 seats (sorted descending) plus 3 bottom cards. */
export function dealCards(
  deck: Card[] = createDeck(),
  rng?: () => number,
): { hands: [Card[], Card[], Card[]]; bottomCards: Card[] } {
  const shuffled = shuffleDeck(deck, rng);
  const rawHands: [Card[], Card[], Card[]] = [[], [], []];
  for (let i = 0; i < 51; i++) {
    rawHands[i % 3].push(shuffled[i]);
  }
  const hands: [Card[], Card[], Card[]] = [
    sortCardsByRank(rawHands[0]),
    sortCardsByRank(rawHands[1]),
    sortCardsByRank(rawHands[2]),
  ];
  const bottomCards = sortCardsByRank(shuffled.slice(51, 54));
  return { hands, bottomCards };
}

/** Create a card helper for tests and puzzle definitions. */
export function makeCard(rank: Rank, suit?: Exclude<Suit, 'joker'>, index = 0): Card {
  if (rank === Rank.SMALL_JOKER || rank === Rank.BIG_JOKER) {
    return { id: `joker-${rank}`, suit: 'joker', rank };
  }
  const chosenSuit = suit ?? STANDARD_SUITS[index % STANDARD_SUITS.length];
  return { id: `${chosenSuit}-${rank}`, suit: chosenSuit, rank };
}

const TOKEN_TO_RANK: Record<string, Rank> = {
  '3': Rank.THREE,
  '4': Rank.FOUR,
  '5': Rank.FIVE,
  '6': Rank.SIX,
  '7': Rank.SEVEN,
  '8': Rank.EIGHT,
  '9': Rank.NINE,
  '10': Rank.TEN,
  T: Rank.TEN,
  J: Rank.JACK,
  Q: Rank.QUEEN,
  K: Rank.KING,
  A: Rank.ACE,
  '2': Rank.TWO,
  SJ: Rank.SMALL_JOKER,
  BJ: Rank.BIG_JOKER,
  小王: Rank.SMALL_JOKER,
  大王: Rank.BIG_JOKER,
};

/**
 * Parse a compact string such as `"3 3 3 4 4 4 5 6"` or `"BJ SJ 2 A K"` into unique `Card[]`.
 * Automatically assigns distinct suits when the same rank appears multiple times.
 */
export function parseCards(notation: string): Card[] {
  const tokens = notation
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const rankUsage = new Map<Rank, number>();
  return tokens.map((raw) => {
    const token = raw.toUpperCase();
    const rank = TOKEN_TO_RANK[token] ?? TOKEN_TO_RANK[raw];
    if (!rank) {
      throw new Error(`Unknown card token: "${raw}"`);
    }
    const used = rankUsage.get(rank) ?? 0;
    if (rank >= Rank.SMALL_JOKER && used >= 1) {
      throw new Error(`Duplicate joker token: "${raw}"`);
    }
    if (used >= 4) {
      throw new Error(`Too many cards of rank "${raw}" (max 4)`);
    }
    rankUsage.set(rank, used + 1);
    return makeCard(rank, undefined, used);
  });
}

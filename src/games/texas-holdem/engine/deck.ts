import { HoldemCard, HoldemRank, HoldemSuit } from './types';

export const SUITS: readonly HoldemSuit[] = ['spades', 'hearts', 'clubs', 'diamonds'] as const;
export const RANKS: readonly HoldemRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

const SUIT_SYMBOLS: Record<HoldemSuit, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

const RANK_CHARS: Record<HoldemRank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function createCard(suit: HoldemSuit, rank: HoldemRank): HoldemCard {
  const suitIdx = SUITS.indexOf(suit);
  const code = suitIdx * 13 + (rank - 2);
  return {
    id: `${suit[0]}${rank}`,
    suit,
    rank,
    code,
  };
}

export function cardFromCode(code: number): HoldemCard {
  const suitIdx = Math.floor(code / 13);
  const rank = ((code % 13) + 2) as HoldemRank;
  const suit = SUITS[suitIdx];
  return {
    id: `${suit[0]}${rank}`,
    suit,
    rank,
    code,
  };
}

export function createDeck(): HoldemCard[] {
  const deck: HoldemCard[] = [];
  for (let s = 0; s < SUITS.length; s++) {
    const suit = SUITS[s];
    for (let r = 0; r < RANKS.length; r++) {
      const rank = RANKS[r];
      deck.push({
        id: `${suit[0]}${rank}`,
        suit,
        rank,
        code: s * 13 + (rank - 2),
      });
    }
  }
  return deck;
}

/**
 * Deterministic Mulberry32 PRNG when a numeric seed is provided; falls back to Math.random.
 */
export function createRng(seed?: number): () => number {
  if (seed === undefined) {
    return () => Math.random();
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeck(cards: readonly HoldemCard[], seed?: number): HoldemCard[] {
  const copy = cards.map((c) => ({ ...c }));
  const rng = createRng(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function formatRankChar(rank: HoldemRank): string {
  return RANK_CHARS[rank];
}

export function formatCardShort(card: HoldemCard): string {
  return `${RANK_CHARS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

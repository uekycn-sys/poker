export type CardSuit = 'spades' | 'hearts' | 'clubs' | 'diamonds' | 'joker';

export interface PlayingCardData {
  id: string;
  suit: CardSuit;
  rank: number;
  /** Deck number (1-based) for multi-deck games such as Guandan (2 decks) or Blackjack (6-8 decks). */
  deckIndex?: number;
  /** Whether this card acts as a wild card (e.g. Guandan Fengrenpei or Laizi Doudizhu). */
  isWild?: boolean;
  /** Custom wild label shown in the top-right badge (defaults to '百搭'). */
  wildLabel?: string;
  /** Optional generic corner tag text. */
  badge?: string;
}

export interface CardCornerBadge {
  text: string;
  tone?: 'gold' | 'emerald' | 'crimson' | 'sky';
}

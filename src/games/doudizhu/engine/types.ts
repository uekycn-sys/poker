export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds' | 'joker';

export enum Rank {
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
  TWO = 15,
  SMALL_JOKER = 16,
  BIG_JOKER = 17,
}

export const RANK_LABELS: Record<Rank, string> = {
  [Rank.THREE]: '3',
  [Rank.FOUR]: '4',
  [Rank.FIVE]: '5',
  [Rank.SIX]: '6',
  [Rank.SEVEN]: '7',
  [Rank.EIGHT]: '8',
  [Rank.NINE]: '9',
  [Rank.TEN]: '10',
  [Rank.JACK]: 'J',
  [Rank.QUEEN]: 'Q',
  [Rank.KING]: 'K',
  [Rank.ACE]: 'A',
  [Rank.TWO]: '2',
  [Rank.SMALL_JOKER]: '小王',
  [Rank.BIG_JOKER]: '大王',
};

export const SUIT_ORDER: Record<Suit, number> = {
  joker: 5,
  spades: 4,
  hearts: 3,
  clubs: 2,
  diamonds: 1,
};

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type HandType =
  | 'INVALID'
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'TRIPLE_WITH_SINGLE'
  | 'TRIPLE_WITH_PAIR'
  | 'STRAIGHT'
  | 'PAIR_STRAIGHT'
  | 'AIRPLANE'
  | 'AIRPLANE_WITH_SINGLES'
  | 'AIRPLANE_WITH_PAIRS'
  | 'FOUR_WITH_TWO_SINGLES'
  | 'FOUR_WITH_TWO_PAIRS'
  | 'BOMB'
  | 'ROCKET';

export interface HandPattern {
  type: HandType;
  /** Lowest rank of the primary body (e.g. 3 for 34567, 4 for 444555+33, BIG_JOKER for ROCKET). */
  mainRank: Rank;
  /** Total number of cards in this pattern. */
  length: number;
  /** Length of consecutive rank chain (1 for non-chain types, >=5 for STRAIGHT, >=3 for PAIR_STRAIGHT, >=2 for AIRPLANE). */
  chainLength: number;
  cards: Card[];
}

/** 0 = bottom (human), 1 = right (下家), 2 = left (上家). Turn order: 0 -> 1 -> 2 -> 0. */
export type Seat = 0 | 1 | 2;

export type PlayerRole = 'landlord' | 'farmer';

export type GamePhase = 'IDLE' | 'DEALING' | 'BIDDING' | 'DOUBLING' | 'PLAYING' | 'FINISHED';

export type BidAction = 'CALL' | 'GRAB' | 'PASS';

/** 1 = 不加倍, 2 = 加倍, 4 = 超级加倍 */
export type DoubleChoice = 1 | 2 | 4;

export interface BidRecord {
  seat: Seat;
  action: BidAction;
}

export interface MoveRecord {
  index: number;
  seat: Seat;
  isPass: boolean;
  cards: Card[];
  pattern: HandPattern | null;
  /** Snapshot of all three hands BEFORE this move, enabling replay and "play from here". */
  handsSnapshot: [Card[], Card[], Card[]];
  lastPlayBefore: { seat: Seat; pattern: HandPattern } | null;
  timestamp: number;
}

export interface MatchSettlement {
  winnerRole: PlayerRole;
  winnerSeat: Seat;
  isSpring: boolean;
  isAntiSpring: boolean;
  baseScore: number;
  publicMultiplier: number;
  effectiveMultipliers: [number, number, number];
  beanDeltas: [number, number, number];
  breakdown: {
    grabCount: number;
    bombCount: number;
    rocketCount: number;
    mingpaiMultiplier: number;
    springMultiplier: number;
  };
}

export interface GameState {
  phase: GamePhase;
  matchMode?: 'standard' | 'puzzle' | 'replay-resume';
  baseScore: number;
  hands: [Card[], Card[], Card[]];
  bottomCards: Card[];
  landlordSeat: Seat | null;
  currentTurn: Seat;
  starterSeat: Seat;
  firstCallerSeat: Seat | null;
  passedBeforeCall: Seat[];
  grabQueue: Seat[];
  otherGrabbed: boolean;
  bidHistory: BidRecord[];
  grabCount: number;
  mingpaiSeats: Seat[];
  mingpaiMultiplier: number;
  doubleChoices: [DoubleChoice | null, DoubleChoice | null, DoubleChoice | null];
  lastPlay: { seat: Seat; pattern: HandPattern } | null;
  passCount: number;
  playCounts: [number, number, number];
  bombCount: number;
  rocketCount: number;
  moveHistory: MoveRecord[];
  settlement: MatchSettlement | null;
  redealCount: number;
}

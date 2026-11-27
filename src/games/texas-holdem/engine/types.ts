import { PlayingCardData } from '../../../shared/cards/types';

export type HoldemSuit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type HoldemRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface HoldemCard extends PlayingCardData {
  suit: HoldemSuit;
  rank: HoldemRank;
  /** 0..51 integer card code: suitIdx * 13 + (rank - 2) */
  code: number;
}

export type PositionName = 'BTN' | 'SB' | 'BB' | 'UTG' | 'MP' | 'CO';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type BettingStreet = Exclude<Street, 'showdown'>;

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface PlayerAction {
  type: ActionType;
  /** For 'raise', represents the player's total bet on the current street. */
  amount?: number;
}

/**
 * 0: High Card
 * 1: One Pair
 * 2: Two Pair
 * 3: Three of a Kind
 * 4: Straight
 * 5: Flush
 * 6: Full House
 * 7: Four of a Kind
 * 8: Straight Flush
 * 9: Royal Flush
 */
export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface HandEvalResult {
  category: HandCategory;
  categoryName: string;
  description: string;
  score: number;
  bestFive: HoldemCard[];
}

export interface SidePot {
  id: string;
  label: string;
  amount: number;
  eligibleSeats: number[];
}

export interface PotPayout {
  potId: string;
  potLabel: string;
  potAmount: number;
  winners: number[];
  shares: Record<number, number>;
  oddChipsAwardedTo: number[];
}

export interface PlayerState {
  seat: number;
  name: string;
  isHuman: boolean;
  stack: number;
  holeCards: HoldemCard[];
  streetBet: number;
  totalCommitted: number;
  folded: boolean;
  allIn: boolean;
  hasActedThisStreet: boolean;
  lastActedAtFullRaiseBet: number | null;
  position: PositionName;
  lastActionLabel?: string;
}

export interface ActionRecord {
  seq: number;
  street: BettingStreet;
  seat: number;
  position: PositionName;
  action: PlayerAction;
  amountAdded: number;
  resultingStreetBet: number;
  potAfter: number;
  isAllIn: boolean;
}

export interface StreetSnapshot {
  handId: number;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  street: BettingStreet;
  players: PlayerState[];
  communityCards: HoldemCard[];
  deck: HoldemCard[];
  pot: number;
  currentBet: number;
  lastFullRaiseSize: number;
  lastFullRaiseBet: number;
  activeSeat: number | null;
  actions: ActionRecord[];
  initialTotalChips: number;
}

export interface ShowdownResult {
  pots: SidePot[];
  payouts: PotPayout[];
  totalWonBySeat: Record<number, number>;
  netDeltaBySeat: Record<number, number>;
  evalsBySeat: Record<number, HandEvalResult>;
  winningCardIds: string[];
  endedByFold: boolean;
  winnerSeats: number[];
}

export interface HandState {
  handId: number;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  street: Street;
  players: PlayerState[];
  communityCards: HoldemCard[];
  deck: HoldemCard[];
  pot: number;
  currentBet: number;
  lastFullRaiseSize: number;
  lastFullRaiseBet: number;
  activeSeat: number | null;
  actions: ActionRecord[];
  streetSnapshots: Partial<Record<BettingStreet, StreetSnapshot>>;
  showdown: ShowdownResult | null;
  isHandOver: boolean;
  initialTotalChips: number;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canAllIn: boolean;
  isReopened: boolean;
}

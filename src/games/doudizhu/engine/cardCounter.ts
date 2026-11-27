import { Card, HandPattern, MoveRecord, Rank } from './types';

export type ExternalCardCounts = Record<Rank, number>;

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

export function createFullDeckCounts(): ExternalCardCounts {
  const counts = {} as ExternalCardCounts;
  for (const r of ALL_RANKS) {
    counts[r] = r >= Rank.SMALL_JOKER ? 1 : 4;
  }
  return counts;
}

/**
 * Compute how many cards of each rank remain outside `myHand` (in opponents'/teammate's hands).
 */
export function computeExternalRemainingCounts(
  myHand: Card[],
  moveHistory: MoveRecord[],
): ExternalCardCounts {
  const counts = createFullDeckCounts();
  for (const card of myHand) {
    counts[card.rank] = Math.max(0, counts[card.rank] - 1);
  }
  for (const move of moveHistory) {
    if (move.isPass) continue;
    for (const card of move.cards) {
      counts[card.rank] = Math.max(0, counts[card.rank] - 1);
    }
  }
  return counts;
}

export function hasExternalRocket(ext: ExternalCardCounts): boolean {
  return ext[Rank.SMALL_JOKER] > 0 && ext[Rank.BIG_JOKER] > 0;
}

export function getExternalBombRanks(ext: ExternalCardCounts): Rank[] {
  const bombs: Rank[] = [];
  for (let r = Rank.THREE; r <= Rank.TWO; r++) {
    if (ext[r as Rank] === 4) {
      bombs.push(r as Rank);
    }
  }
  return bombs;
}

function hasConsecutiveWindowInExternal(
  ext: ExternalCardCounts,
  minStart: number,
  chainLength: number,
  minPerRank: number,
): boolean {
  for (let start = minStart; start + chainLength - 1 <= Rank.ACE; start++) {
    let ok = true;
    for (let i = 0; i < chainLength; i++) {
      if (ext[(start + i) as Rank] < minPerRank) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Check whether `pattern` cannot be beaten by any non-bomb/non-rocket (or higher bomb)
 * constructible from `ext`. Note: when `checkBombs` is true, also checks external bombs/rocket.
 */
export function isBossPattern(
  pattern: HandPattern,
  ext: ExternalCardCounts,
  checkBombs = true,
): boolean {
  if (pattern.type === 'INVALID') return false;
  if (pattern.type === 'ROCKET') return true;

  if (pattern.type === 'BOMB') {
    if (hasExternalRocket(ext)) return false;
    return !getExternalBombRanks(ext).some((r) => r > pattern.mainRank);
  }

  if (checkBombs && (hasExternalRocket(ext) || getExternalBombRanks(ext).length > 0)) {
    return false;
  }

  switch (pattern.type) {
    case 'SINGLE':
      for (let r = pattern.mainRank + 1; r <= Rank.BIG_JOKER; r++) {
        if (ext[r as Rank] > 0) return false;
      }
      return true;
    case 'PAIR':
      for (let r = pattern.mainRank + 1; r <= Rank.TWO; r++) {
        if (ext[r as Rank] >= 2) return false;
      }
      return true;
    case 'TRIPLE':
    case 'TRIPLE_WITH_SINGLE':
    case 'TRIPLE_WITH_PAIR':
      for (let r = pattern.mainRank + 1; r <= Rank.TWO; r++) {
        if (ext[r as Rank] >= 3) return false;
      }
      return true;
    case 'STRAIGHT':
      return !hasConsecutiveWindowInExternal(ext, pattern.mainRank + 1, pattern.chainLength, 1);
    case 'PAIR_STRAIGHT':
      return !hasConsecutiveWindowInExternal(ext, pattern.mainRank + 1, pattern.chainLength, 2);
    case 'AIRPLANE':
    case 'AIRPLANE_WITH_SINGLES':
    case 'AIRPLANE_WITH_PAIRS':
      return !hasConsecutiveWindowInExternal(ext, pattern.mainRank + 1, pattern.chainLength, 3);
    case 'FOUR_WITH_TWO_SINGLES':
    case 'FOUR_WITH_TWO_PAIRS':
      return !getExternalBombRanks(ext).some((r) => r > pattern.mainRank);
  }
}

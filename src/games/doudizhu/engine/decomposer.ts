import { Card, Rank } from './types';

export type DecomposedGroupType =
  | 'ROCKET'
  | 'BOMB'
  | 'AIRPLANE'
  | 'PAIR_STRAIGHT'
  | 'STRAIGHT'
  | 'TRIPLE'
  | 'PAIR'
  | 'SINGLE';

export interface DecomposedGroup {
  type: DecomposedGroupType;
  mainRank: Rank;
  chainLength: number;
  cardCount: number;
}

export interface HandDecomposition {
  groups: DecomposedGroup[];
  rawTurns: number;
  effectiveTurns: number;
  controlValue: number;
  bombCount: number;
  hasRocket: boolean;
  handValue: number;
}

function scoreGroups(groups: DecomposedGroup[]): HandDecomposition {
  if (groups.length === 0) {
    return {
      groups: [],
      rawTurns: 0,
      effectiveTurns: 0,
      controlValue: 0,
      bombCount: 0,
      hasRocket: false,
      handValue: 100,
    };
  }

  let singles = 0;
  let pairs = 0;
  let triples = 0;
  const airplaneLens: number[] = [];
  let bombCount = 0;
  let hasRocket = false;
  let controlValue = 0;
  let straightCount = 0;
  let pairStraightCount = 0;
  let weakPenalty = 0;

  for (const g of groups) {
    switch (g.type) {
      case 'ROCKET':
        hasRocket = true;
        controlValue += 7.5;
        break;
      case 'BOMB':
        bombCount += 1;
        controlValue += 5.5 + (g.mainRank - Rank.THREE) * 0.12;
        break;
      case 'AIRPLANE':
        airplaneLens.push(g.chainLength);
        if (g.mainRank + g.chainLength - 1 >= Rank.QUEEN) controlValue += 0.6;
        break;
      case 'PAIR_STRAIGHT':
        pairStraightCount += 1;
        if (g.mainRank + g.chainLength - 1 >= Rank.QUEEN) controlValue += 0.45;
        break;
      case 'STRAIGHT':
        straightCount += 1;
        if (g.mainRank + g.chainLength - 1 >= Rank.KING) controlValue += 0.4;
        break;
      case 'TRIPLE':
        triples += 1;
        if (g.mainRank === Rank.TWO) controlValue += 5.0;
        else if (g.mainRank === Rank.ACE) controlValue += 2.6;
        else if (g.mainRank === Rank.KING) controlValue += 1.2;
        break;
      case 'PAIR':
        pairs += 1;
        if (g.mainRank === Rank.TWO) controlValue += 3.4;
        else if (g.mainRank === Rank.ACE) controlValue += 1.7;
        else if (g.mainRank === Rank.KING) controlValue += 0.85;
        else if (g.mainRank <= Rank.SEVEN) weakPenalty += 0.35;
        break;
      case 'SINGLE':
        singles += 1;
        if (g.mainRank === Rank.BIG_JOKER) controlValue += 3.2;
        else if (g.mainRank === Rank.SMALL_JOKER) controlValue += 2.5;
        else if (g.mainRank === Rank.TWO) controlValue += 1.7;
        else if (g.mainRank === Rank.ACE) controlValue += 0.85;
        else if (g.mainRank === Rank.KING) controlValue += 0.4;
        else if (g.mainRank <= Rank.NINE) weakPenalty += 0.6;
        break;
    }
  }

  let remSingles = singles;
  let remPairs = pairs;
  let absorbed = 0;

  for (const k of airplaneLens) {
    if (remSingles >= k) {
      remSingles -= k;
      absorbed += k;
    } else if (remPairs >= k) {
      remPairs -= k;
      absorbed += k;
    }
  }

  for (let i = 0; i < triples; i++) {
    if (remSingles >= 1) {
      remSingles -= 1;
      absorbed += 1;
    } else if (remPairs >= 1) {
      remPairs -= 1;
      absorbed += 1;
    }
  }

  const rawTurns = groups.length;
  const effectiveTurns = Math.max(1, rawTurns - absorbed);
  const handValue =
    40 -
    effectiveTurns * 5.2 +
    controlValue * 1.8 +
    (straightCount + pairStraightCount) * 1.2 +
    airplaneLens.length * 2.0 +
    bombCount * 3.5 +
    (hasRocket ? 4.5 : 0) -
    weakPenalty;

  return {
    groups,
    rawTurns,
    effectiveTurns,
    controlValue,
    bombCount,
    hasRocket,
    handValue,
  };
}

function buildBaseGroups(counts: number[]): DecomposedGroup[] {
  const groups: DecomposedGroup[] = [];
  for (let r = Rank.THREE; r <= Rank.BIG_JOKER; r++) {
    const c = counts[r];
    if (c === 0) continue;
    if (c === 4) {
      groups.push({ type: 'BOMB', mainRank: r as Rank, chainLength: 1, cardCount: 4 });
    } else if (c === 3) {
      groups.push({ type: 'TRIPLE', mainRank: r as Rank, chainLength: 1, cardCount: 3 });
    } else if (c === 2) {
      groups.push({ type: 'PAIR', mainRank: r as Rank, chainLength: 1, cardCount: 2 });
    } else {
      groups.push({ type: 'SINGLE', mainRank: r as Rank, chainLength: 1, cardCount: 1 });
    }
  }
  return groups;
}

/**
 * Memoized optimal hand decomposer for Dou Dizhu.
 * Evaluates combinations of Airplanes, Pair Straights, Straights, Bombs, and Rocket
 * to minimize `effectiveTurns` while preserving high-value control structures.
 */
export function decomposeHand(cards: Card[]): HandDecomposition {
  if (cards.length === 0) {
    return scoreGroups([]);
  }

  const counts = new Array<number>(18).fill(0);
  for (const card of cards) {
    counts[card.rank] += 1;
  }

  const prefixGroups: DecomposedGroup[] = [];
  if (counts[Rank.SMALL_JOKER] === 1 && counts[Rank.BIG_JOKER] === 1) {
    prefixGroups.push({
      type: 'ROCKET',
      mainRank: Rank.BIG_JOKER,
      chainLength: 1,
      cardCount: 2,
    });
    counts[Rank.SMALL_JOKER] = 0;
    counts[Rank.BIG_JOKER] = 0;
  }

  const groupMemo = new Map<string, DecomposedGroup[]>();

  // Start recursion with empty prefix inside recursion so scoreGroups doesn't double-count prefixGroups
  const solveClean = (stateCounts: number[], minStage: number, minRank: number): DecomposedGroup[] => {
    const bestGroupsKey = `${minStage}:${minRank}:${stateCounts.slice(3).join(',')}`;
    const cached = groupMemo.get(bestGroupsKey);
    if (cached) return cached;

    let bestGroups = buildBaseGroups(stateCounts);
    let bestScore = scoreGroups([...prefixGroups, ...bestGroups]).handValue;

    if (groupMemo.size > 4000) {
      return bestGroups;
    }

    if (minStage <= 0) {
      const s0 = minStage === 0 ? Math.max(Rank.THREE, minRank) : Rank.THREE;
      for (let start = s0; start <= Rank.KING; start++) {
        if (stateCounts[start] < 3 || stateCounts[start + 1] < 3) continue;
        let maxLen = 2;
        while (start + maxLen <= Rank.ACE && stateCounts[start + maxLen] >= 3) maxLen++;
        for (let len = maxLen; len >= 2; len--) {
          const next = [...stateCounts];
          for (let i = 0; i < len; i++) next[start + i] -= 3;
          const tail = solveClean(next, 0, start);
          const candidate: DecomposedGroup[] = [
            { type: 'AIRPLANE', mainRank: start as Rank, chainLength: len, cardCount: len * 3 },
            ...tail,
          ];
          const sc = scoreGroups([...prefixGroups, ...candidate]).handValue;
          if (sc > bestScore) {
            bestScore = sc;
            bestGroups = candidate;
          }
        }
      }
    }

    if (minStage <= 1) {
      const s1 = minStage === 1 ? Math.max(Rank.THREE, minRank) : Rank.THREE;
      for (let start = s1; start <= Rank.QUEEN; start++) {
        if (stateCounts[start] < 2 || stateCounts[start + 1] < 2 || stateCounts[start + 2] < 2) continue;
        let maxLen = 3;
        while (start + maxLen <= Rank.ACE && stateCounts[start + maxLen] >= 2) maxLen++;
        for (let len = maxLen; len >= 3; len--) {
          const next = [...stateCounts];
          for (let i = 0; i < len; i++) next[start + i] -= 2;
          const tail = solveClean(next, 1, start);
          const candidate: DecomposedGroup[] = [
            { type: 'PAIR_STRAIGHT', mainRank: start as Rank, chainLength: len, cardCount: len * 2 },
            ...tail,
          ];
          const sc = scoreGroups([...prefixGroups, ...candidate]).handValue;
          if (sc > bestScore) {
            bestScore = sc;
            bestGroups = candidate;
          }
        }
      }
    }

    const s2 = minStage === 2 ? Math.max(Rank.THREE, minRank) : Rank.THREE;
    for (let start = s2; start <= Rank.TEN; start++) {
      let maxLen = 0;
      while (start + maxLen <= Rank.ACE && stateCounts[start + maxLen] >= 1) maxLen++;
      if (maxLen < 5) continue;
      for (let len = maxLen; len >= 5; len--) {
        const next = [...stateCounts];
        for (let i = 0; i < len; i++) next[start + i] -= 1;
        const tail = solveClean(next, 2, start);
        const candidate: DecomposedGroup[] = [
          { type: 'STRAIGHT', mainRank: start as Rank, chainLength: len, cardCount: len },
          ...tail,
        ];
        const sc = scoreGroups([...prefixGroups, ...candidate]).handValue;
        if (sc > bestScore) {
          bestScore = sc;
          bestGroups = candidate;
        }
      }
    }

    groupMemo.set(bestGroupsKey, bestGroups);
    return bestGroups;
  };

  const bodyGroups = solveClean(counts, 0, Rank.THREE);
  return scoreGroups([...prefixGroups, ...bodyGroups]);
}

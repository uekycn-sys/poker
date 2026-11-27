import { Card, HandPattern, HandType, Rank } from './types';
import { sortCardsByRank } from './deck';

const PATTERN_PRIORITY: Record<HandType, number> = {
  ROCKET: 100,
  BOMB: 90,
  STRAIGHT: 80,
  PAIR_STRAIGHT: 75,
  AIRPLANE: 70,
  SINGLE: 60,
  PAIR: 60,
  TRIPLE: 60,
  TRIPLE_WITH_SINGLE: 55,
  TRIPLE_WITH_PAIR: 55,
  AIRPLANE_WITH_SINGLES: 50,
  AIRPLANE_WITH_PAIRS: 45,
  FOUR_WITH_TWO_SINGLES: 40,
  FOUR_WITH_TWO_PAIRS: 35,
  INVALID: 0,
};

function countByRank(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function groupCardsByRank(cards: Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const card of sortCardsByRank(cards)) {
    const arr = groups.get(card.rank) ?? [];
    arr.push(card);
    groups.set(card.rank, arr);
  }
  return groups;
}

function isJoker(rank: Rank): boolean {
  return rank === Rank.SMALL_JOKER || rank === Rank.BIG_JOKER;
}

function hasConsecutiveWindow(counts: Map<Rank, number>, start: Rank, len: number, minCount: number): boolean {
  if (start < Rank.THREE || start + len - 1 > Rank.ACE) return false;
  for (let r = start; r < start + len; r++) {
    if ((counts.get(r as Rank) ?? 0) < minCount) return false;
  }
  return true;
}

function sortPatterns(patterns: HandPattern[]): HandPattern[] {
  return [...patterns].sort((a, b) => {
    const prioDiff = PATTERN_PRIORITY[b.type] - PATTERN_PRIORITY[a.type];
    if (prioDiff !== 0) return prioDiff;
    if (b.chainLength !== a.chainLength) return b.chainLength - a.chainLength;
    return b.mainRank - a.mainRank;
  });
}

/**
 * Analyze a card selection and return ALL legally valid Dou Dizhu interpretations.
 * Useful for ambiguous combinations such as `333444555666` or `33334444`.
 */
export function analyzeAllPatterns(cards: Card[]): HandPattern[] {
  const len = cards.length;
  if (len === 0) return [];

  const counts = countByRank(cards);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const patterns: HandPattern[] = [];

  if (len === 1) {
    patterns.push({
      type: 'SINGLE',
      mainRank: ranks[0],
      length: 1,
      chainLength: 1,
      cards,
    });
  }

  if (len === 2) {
    if (counts.has(Rank.SMALL_JOKER) && counts.has(Rank.BIG_JOKER)) {
      patterns.push({
        type: 'ROCKET',
        mainRank: Rank.BIG_JOKER,
        length: 2,
        chainLength: 1,
        cards,
      });
    } else if (ranks.length === 1 && !isJoker(ranks[0])) {
      patterns.push({
        type: 'PAIR',
        mainRank: ranks[0],
        length: 2,
        chainLength: 1,
        cards,
      });
    }
  }

  if (len === 3 && ranks.length === 1) {
    patterns.push({
      type: 'TRIPLE',
      mainRank: ranks[0],
      length: 3,
      chainLength: 1,
      cards,
    });
  }

  if (len === 4) {
    if (ranks.length === 1) {
      // Four of a kind is strictly a BOMB, never TRIPLE_WITH_SINGLE.
      patterns.push({
        type: 'BOMB',
        mainRank: ranks[0],
        length: 4,
        chainLength: 1,
        cards,
      });
    } else if (ranks.length === 2) {
      const tripleRank = ranks.find((r) => counts.get(r) === 3);
      if (tripleRank !== undefined) {
        patterns.push({
          type: 'TRIPLE_WITH_SINGLE',
          mainRank: tripleRank,
          length: 4,
          chainLength: 1,
          cards,
        });
      }
    }
  }

  if (len === 5 && ranks.length === 2) {
    const tripleRank = ranks.find((r) => counts.get(r) === 3);
    const pairRank = ranks.find((r) => counts.get(r) === 2);
    if (tripleRank !== undefined && pairRank !== undefined && !isJoker(pairRank)) {
      patterns.push({
        type: 'TRIPLE_WITH_PAIR',
        mainRank: tripleRank,
        length: 5,
        chainLength: 1,
        cards,
      });
    }
  }

  if (len === 6) {
    for (const r of ranks) {
      if (counts.get(r) === 4) {
        patterns.push({
          type: 'FOUR_WITH_TWO_SINGLES',
          mainRank: r,
          length: 6,
          chainLength: 1,
          cards,
        });
      }
    }
  }

  if (len === 8) {
    for (const r of ranks) {
      if (counts.get(r) !== 4) continue;
      let validPairs = true;
      for (const other of ranks) {
        if (other === r) continue;
        const c = counts.get(other) ?? 0;
        if (isJoker(other) || c % 2 !== 0) {
          validPairs = false;
          break;
        }
      }
      if (validPairs) {
        patterns.push({
          type: 'FOUR_WITH_TWO_PAIRS',
          mainRank: r,
          length: 8,
          chainLength: 1,
          cards,
        });
      }
    }
  }

  // Straight (5+ consecutive single ranks, 3..A)
  if (len >= 5 && ranks.length === len && ranks[len - 1] <= Rank.ACE) {
    if (ranks[len - 1] - ranks[0] + 1 === len) {
      patterns.push({
        type: 'STRAIGHT',
        mainRank: ranks[0],
        length: len,
        chainLength: len,
        cards,
      });
    }
  }

  // Pair straight (3+ consecutive pairs, 3..A)
  if (len >= 6 && len % 2 === 0) {
    const k = len / 2;
    if (
      ranks.length === k &&
      ranks[k - 1] <= Rank.ACE &&
      ranks[k - 1] - ranks[0] + 1 === k &&
      ranks.every((r) => counts.get(r) === 2)
    ) {
      patterns.push({
        type: 'PAIR_STRAIGHT',
        mainRank: ranks[0],
        length: len,
        chainLength: k,
        cards,
      });
    }
  }

  // Pure airplane (2+ consecutive triples, 3..A)
  if (len >= 6 && len % 3 === 0) {
    const k = len / 3;
    if (
      ranks.length === k &&
      ranks[k - 1] <= Rank.ACE &&
      ranks[k - 1] - ranks[0] + 1 === k &&
      ranks.every((r) => counts.get(r) === 3)
    ) {
      patterns.push({
        type: 'AIRPLANE',
        mainRank: ranks[0],
        length: len,
        chainLength: k,
        cards,
      });
    }
  }

  // Airplane with singles (k >= 2 consecutive triples + k single kickers)
  if (len >= 8 && len % 4 === 0) {
    const k = len / 4;
    for (let start = Rank.THREE; start + k - 1 <= Rank.ACE; start++) {
      if (hasConsecutiveWindow(counts, start as Rank, k, 3)) {
        patterns.push({
          type: 'AIRPLANE_WITH_SINGLES',
          mainRank: start as Rank,
          length: len,
          chainLength: k,
          cards,
        });
      }
    }
  }

  // Airplane with pairs (k >= 2 consecutive triples + k pair kickers)
  if (len >= 10 && len % 5 === 0) {
    const k = len / 5;
    for (let start = Rank.THREE; start + k - 1 <= Rank.ACE; start++) {
      if (!hasConsecutiveWindow(counts, start as Rank, k, 3)) continue;

      let validKickers = true;
      for (const r of ranks) {
        const usedInBody = r >= start && r < start + k ? 3 : 0;
        const rem = (counts.get(r) ?? 0) - usedInBody;
        if (rem > 0 && (isJoker(r) || rem % 2 !== 0)) {
          validKickers = false;
          break;
        }
      }
      if (validKickers) {
        patterns.push({
          type: 'AIRPLANE_WITH_PAIRS',
          mainRank: start as Rank,
          length: len,
          chainLength: k,
          cards,
        });
      }
    }
  }

  return sortPatterns(patterns);
}

/** Return the primary (highest-priority) HandPattern, or INVALID if none matches. */
export function analyzeHand(cards: Card[]): HandPattern {
  const all = analyzeAllPatterns(cards);
  if (all.length > 0) return all[0];
  return {
    type: 'INVALID',
    mainRank: Rank.THREE,
    length: cards.length,
    chainLength: 0,
    cards,
  };
}

/** Check whether `candidate` legally beats `target`. */
export function canPatternBeat(candidate: HandPattern, target: HandPattern): boolean {
  if (candidate.type === 'INVALID' || target.type === 'INVALID') return false;
  if (target.type === 'ROCKET') return false;
  if (candidate.type === 'ROCKET') return true;
  if (candidate.type === 'BOMB') {
    return target.type === 'BOMB' ? candidate.mainRank > target.mainRank : true;
  }
  return (
    candidate.type === target.type &&
    candidate.length === target.length &&
    candidate.chainLength === target.chainLength &&
    candidate.mainRank > target.mainRank
  );
}

/**
 * Given a user's selected cards and an optional previous table pattern,
 * return the matching legal `HandPattern` (resolving ambiguities against `prevPattern`).
 */
export function matchPatternToBeat(cards: Card[], prevPattern: HandPattern | null): HandPattern | null {
  const all = analyzeAllPatterns(cards);
  if (all.length === 0) return null;
  if (!prevPattern) return all[0];
  return all.find((pattern) => canPatternBeat(pattern, prevPattern)) ?? null;
}

/**
 * Select `count` kicker cards from `hand` after removing `bodyCards`,
 * preferring pure singles (multiplicity 1) -> pairs -> triples -> bombs, ascending by rank.
 */
function pickSingleKickers(hand: Card[], bodyCards: Card[], count: number): Card[] | null {
  const bodyIds = new Set(bodyCards.map((c) => c.id));
  const remaining = hand.filter((c) => !bodyIds.has(c.id));
  if (remaining.length < count) return null;

  const remCounts = countByRank(remaining);
  const sorted = [...remaining].sort((a, b) => {
    const multA = remCounts.get(a.rank) ?? 1;
    const multB = remCounts.get(b.rank) ?? 1;
    if (multA !== multB) return multA - multB;
    return a.rank - b.rank;
  });

  // Avoid breaking a rocket if non-joker kickers are available
  const hasBothJokers = remCounts.has(Rank.SMALL_JOKER) && remCounts.has(Rank.BIG_JOKER);
  if (hasBothJokers && remaining.length - 2 >= count) {
    const withoutJokers = sorted.filter((c) => !isJoker(c.rank));
    if (withoutJokers.length >= count) {
      return withoutJokers.slice(0, count);
    }
  }

  return sorted.slice(0, count);
}

/**
 * Select `pairCount` kicker pairs from `hand` after removing `bodyCards`,
 * preferring pure pairs (multiplicity 2) -> triples -> quads, ascending by rank.
 */
function pickPairKickers(hand: Card[], bodyCards: Card[], pairCount: number): Card[] | null {
  const bodyIds = new Set(bodyCards.map((c) => c.id));
  const remaining = hand.filter((c) => !bodyIds.has(c.id));
  const byRank = groupCardsByRank(remaining);

  const candidates = [...byRank.entries()]
    .filter(([rank, arr]) => !isJoker(rank) && arr.length >= 2)
    .sort((a, b) => {
      const multA = a[1].length;
      const multB = b[1].length;
      const prioA = multA === 2 ? 0 : multA === 3 ? 1 : 2;
      const prioB = multB === 2 ? 0 : multB === 3 ? 1 : 2;
      if (prioA !== prioB) return prioA - prioB;
      return a[0] - b[0];
    });

  const picked: Card[] = [];
  for (const [, cards] of candidates) {
    let idx = 0;
    while (idx + 1 < cards.length && picked.length < pairCount * 2) {
      picked.push(cards[idx], cards[idx + 1]);
      idx += 2;
    }
    if (picked.length === pairCount * 2) break;
  }

  return picked.length === pairCount * 2 ? picked : null;
}

function getPatternSignature(pattern: HandPattern): string {
  const ranks = [...pattern.cards].map((c) => c.rank).sort((a, b) => a - b);
  return `${pattern.type}:${pattern.mainRank}:${pattern.chainLength}:${ranks.join(',')}`;
}

function dedupePatterns(patterns: HandPattern[]): HandPattern[] {
  const seen = new Set<string>();
  const result: HandPattern[] = [];
  for (const p of patterns) {
    const sig = getPatternSignature(p);
    if (!seen.has(sig)) {
      seen.add(sig);
      result.push(p);
    }
  }
  return result;
}

/**
 * Find all legal plays in `hand` that beat `prevPattern`.
 * When `prevPattern` is `null` (free lead), returns ordered suggestions for leading.
 */
export function findBeatingPlays(hand: Card[], prevPattern: HandPattern | null): HandPattern[] {
  if (hand.length === 0) return [];
  const byRank = groupCardsByRank(hand);
  const ranksAsc = [...byRank.keys()].sort((a, b) => a - b);
  const results: HandPattern[] = [];

  if (prevPattern && prevPattern.type === 'ROCKET') {
    return [];
  }

  if (prevPattern === null) {
    // Leading suggestions: singles -> pairs -> triples & kickers -> chains -> 4+2 -> bombs -> rocket
    for (const r of ranksAsc) {
      results.push({ type: 'SINGLE', mainRank: r, length: 1, chainLength: 1, cards: [byRank.get(r)![0]] });
    }
    for (const r of ranksAsc) {
      const group = byRank.get(r)!;
      if (group.length >= 2 && !isJoker(r)) {
        results.push({ type: 'PAIR', mainRank: r, length: 2, chainLength: 1, cards: group.slice(0, 2) });
      }
    }
    for (const r of ranksAsc) {
      const group = byRank.get(r)!;
      if (group.length >= 3) {
        const body = group.slice(0, 3);
        const k1 = pickSingleKickers(hand, body, 1);
        if (k1) {
          results.push({
            type: 'TRIPLE_WITH_SINGLE',
            mainRank: r,
            length: 4,
            chainLength: 1,
            cards: [...body, ...k1],
          });
        }
        const k2 = pickPairKickers(hand, body, 1);
        if (k2) {
          results.push({
            type: 'TRIPLE_WITH_PAIR',
            mainRank: r,
            length: 5,
            chainLength: 1,
            cards: [...body, ...k2],
          });
        }
        results.push({ type: 'TRIPLE', mainRank: r, length: 3, chainLength: 1, cards: body });
      }
    }
    // Find longest straights starting at each rank (at least 5)
    for (let start = Rank.THREE; start <= Rank.TEN; start++) {
      let len = 0;
      const straightCards: Card[] = [];
      while (start + len <= Rank.ACE && byRank.has((start + len) as Rank)) {
        straightCards.push(byRank.get((start + len) as Rank)![0]);
        len++;
        if (len >= 5) {
          results.push({
            type: 'STRAIGHT',
            mainRank: start as Rank,
            length: len,
            chainLength: len,
            cards: [...straightCards],
          });
        }
      }
    }
    // Pair straights >= 3
    for (let start = Rank.THREE; start <= Rank.QUEEN; start++) {
      let k = 0;
      const psCards: Card[] = [];
      while (start + k <= Rank.ACE && (byRank.get((start + k) as Rank)?.length ?? 0) >= 2) {
        psCards.push(...byRank.get((start + k) as Rank)!.slice(0, 2));
        k++;
        if (k >= 3) {
          results.push({
            type: 'PAIR_STRAIGHT',
            mainRank: start as Rank,
            length: k * 2,
            chainLength: k,
            cards: [...psCards],
          });
        }
      }
    }
    // Airplanes >= 2
    for (let start = Rank.THREE; start <= Rank.KING; start++) {
      let k = 0;
      const body: Card[] = [];
      while (start + k <= Rank.ACE && (byRank.get((start + k) as Rank)?.length ?? 0) >= 3) {
        body.push(...byRank.get((start + k) as Rank)!.slice(0, 3));
        k++;
        if (k >= 2) {
          const ks = pickSingleKickers(hand, body, k);
          if (ks) {
            results.push({
              type: 'AIRPLANE_WITH_SINGLES',
              mainRank: start as Rank,
              length: k * 4,
              chainLength: k,
              cards: [...body, ...ks],
            });
          }
          const kp = pickPairKickers(hand, body, k);
          if (kp) {
            results.push({
              type: 'AIRPLANE_WITH_PAIRS',
              mainRank: start as Rank,
              length: k * 5,
              chainLength: k,
              cards: [...body, ...kp],
            });
          }
          results.push({
            type: 'AIRPLANE',
            mainRank: start as Rank,
            length: k * 3,
            chainLength: k,
            cards: [...body],
          });
        }
      }
    }
  } else {
    const minRank = prevPattern.mainRank;
    const k = prevPattern.chainLength;

    switch (prevPattern.type) {
      case 'SINGLE': {
        // Prefer non-bomb singles first, then breaking pairs/triples, bombs handled separately
        const order = [...ranksAsc].sort((a, b) => {
          const multA = byRank.get(a)!.length;
          const multB = byRank.get(b)!.length;
          const pA = multA === 1 ? 0 : multA === 2 ? 1 : multA === 3 ? 2 : 3;
          const pB = multB === 1 ? 0 : multB === 2 ? 1 : multB === 3 ? 2 : 3;
          if (pA !== pB) return pA - pB;
          return a - b;
        });
        for (const r of order) {
          if (r > minRank) {
            results.push({ type: 'SINGLE', mainRank: r, length: 1, chainLength: 1, cards: [byRank.get(r)![0]] });
          }
        }
        break;
      }

      case 'PAIR': {
        const order = [...ranksAsc].sort((a, b) => {
          const multA = byRank.get(a)!.length;
          const multB = byRank.get(b)!.length;
          const pA = multA === 2 ? 0 : multA === 3 ? 1 : 2;
          const pB = multB === 2 ? 0 : multB === 3 ? 1 : 2;
          if (pA !== pB) return pA - pB;
          return a - b;
        });
        for (const r of order) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length >= 2 && !isJoker(r)) {
            results.push({ type: 'PAIR', mainRank: r, length: 2, chainLength: 1, cards: group.slice(0, 2) });
          }
        }
        break;
      }

      case 'TRIPLE': {
        for (const r of ranksAsc) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length >= 3) {
            results.push({ type: 'TRIPLE', mainRank: r, length: 3, chainLength: 1, cards: group.slice(0, 3) });
          }
        }
        break;
      }

      case 'TRIPLE_WITH_SINGLE': {
        for (const r of ranksAsc) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length >= 3) {
            const body = group.slice(0, 3);
            const kickers = pickSingleKickers(hand, body, 1);
            if (kickers) {
              results.push({
                type: 'TRIPLE_WITH_SINGLE',
                mainRank: r,
                length: 4,
                chainLength: 1,
                cards: [...body, ...kickers],
              });
            }
          }
        }
        break;
      }

      case 'TRIPLE_WITH_PAIR': {
        for (const r of ranksAsc) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length >= 3) {
            const body = group.slice(0, 3);
            const kickers = pickPairKickers(hand, body, 1);
            if (kickers) {
              results.push({
                type: 'TRIPLE_WITH_PAIR',
                mainRank: r,
                length: 5,
                chainLength: 1,
                cards: [...body, ...kickers],
              });
            }
          }
        }
        break;
      }

      case 'STRAIGHT': {
        for (let start = minRank + 1; start + k - 1 <= Rank.ACE; start++) {
          const cards: Card[] = [];
          let ok = true;
          for (let i = 0; i < k; i++) {
            const group = byRank.get((start + i) as Rank);
            if (!group || group.length < 1) {
              ok = false;
              break;
            }
            cards.push(group[0]);
          }
          if (ok) {
            results.push({ type: 'STRAIGHT', mainRank: start as Rank, length: k, chainLength: k, cards });
          }
        }
        break;
      }

      case 'PAIR_STRAIGHT': {
        for (let start = minRank + 1; start + k - 1 <= Rank.ACE; start++) {
          const cards: Card[] = [];
          let ok = true;
          for (let i = 0; i < k; i++) {
            const group = byRank.get((start + i) as Rank);
            if (!group || group.length < 2) {
              ok = false;
              break;
            }
            cards.push(group[0], group[1]);
          }
          if (ok) {
            results.push({
              type: 'PAIR_STRAIGHT',
              mainRank: start as Rank,
              length: k * 2,
              chainLength: k,
              cards,
            });
          }
        }
        break;
      }

      case 'AIRPLANE': {
        for (let start = minRank + 1; start + k - 1 <= Rank.ACE; start++) {
          const body: Card[] = [];
          let ok = true;
          for (let i = 0; i < k; i++) {
            const group = byRank.get((start + i) as Rank);
            if (!group || group.length < 3) {
              ok = false;
              break;
            }
            body.push(group[0], group[1], group[2]);
          }
          if (ok) {
            results.push({ type: 'AIRPLANE', mainRank: start as Rank, length: k * 3, chainLength: k, cards: body });
          }
        }
        break;
      }

      case 'AIRPLANE_WITH_SINGLES': {
        for (let start = minRank + 1; start + k - 1 <= Rank.ACE; start++) {
          const body: Card[] = [];
          let ok = true;
          for (let i = 0; i < k; i++) {
            const group = byRank.get((start + i) as Rank);
            if (!group || group.length < 3) {
              ok = false;
              break;
            }
            body.push(group[0], group[1], group[2]);
          }
          if (!ok) continue;
          const kickers = pickSingleKickers(hand, body, k);
          if (kickers) {
            results.push({
              type: 'AIRPLANE_WITH_SINGLES',
              mainRank: start as Rank,
              length: k * 4,
              chainLength: k,
              cards: [...body, ...kickers],
            });
          }
        }
        break;
      }

      case 'AIRPLANE_WITH_PAIRS': {
        for (let start = minRank + 1; start + k - 1 <= Rank.ACE; start++) {
          const body: Card[] = [];
          let ok = true;
          for (let i = 0; i < k; i++) {
            const group = byRank.get((start + i) as Rank);
            if (!group || group.length < 3) {
              ok = false;
              break;
            }
            body.push(group[0], group[1], group[2]);
          }
          if (!ok) continue;
          const kickers = pickPairKickers(hand, body, k);
          if (kickers) {
            results.push({
              type: 'AIRPLANE_WITH_PAIRS',
              mainRank: start as Rank,
              length: k * 5,
              chainLength: k,
              cards: [...body, ...kickers],
            });
          }
        }
        break;
      }

      case 'FOUR_WITH_TWO_SINGLES': {
        for (const r of ranksAsc) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length === 4) {
            const kickers = pickSingleKickers(hand, group, 2);
            if (kickers) {
              results.push({
                type: 'FOUR_WITH_TWO_SINGLES',
                mainRank: r,
                length: 6,
                chainLength: 1,
                cards: [...group, ...kickers],
              });
            }
          }
        }
        break;
      }

      case 'FOUR_WITH_TWO_PAIRS': {
        for (const r of ranksAsc) {
          const group = byRank.get(r)!;
          if (r > minRank && group.length === 4) {
            const kickers = pickPairKickers(hand, group, 2);
            if (kickers) {
              results.push({
                type: 'FOUR_WITH_TWO_PAIRS',
                mainRank: r,
                length: 8,
                chainLength: 1,
                cards: [...group, ...kickers],
              });
            }
          }
        }
        break;
      }

      case 'BOMB':
      case 'ROCKET':
      case 'INVALID':
        break;
    }
  }

  // Append beating bombs
  for (const r of ranksAsc) {
    const group = byRank.get(r)!;
    if (group.length === 4) {
      if (!prevPattern || prevPattern.type !== 'BOMB' || r > prevPattern.mainRank) {
        results.push({ type: 'BOMB', mainRank: r, length: 4, chainLength: 1, cards: [...group] });
      }
    }
  }

  // Append rocket
  if (byRank.has(Rank.SMALL_JOKER) && byRank.has(Rank.BIG_JOKER)) {
    results.push({
      type: 'ROCKET',
      mainRank: Rank.BIG_JOKER,
      length: 2,
      chainLength: 1,
      cards: [...byRank.get(Rank.BIG_JOKER)!, ...byRank.get(Rank.SMALL_JOKER)!],
    });
  }

  return dedupePatterns(results);
}

/**
 * Smart swipe-selection helper:
 * When the user swipes across 5+ cards that don't immediately form a legal play,
 * extract the best embedded straight / pair-straight (or matching chain against `prevPattern`).
 * Never alters a selection that is already valid.
 */
export function extractSmartSelection(selectedCards: Card[], prevPattern: HandPattern | null): Card[] | null {
  if (selectedCards.length < 5) return null;
  if (matchPatternToBeat(selectedCards, prevPattern) !== null) return null;

  if (prevPattern) {
    if (
      prevPattern.type === 'STRAIGHT' ||
      prevPattern.type === 'PAIR_STRAIGHT' ||
      prevPattern.type === 'AIRPLANE' ||
      prevPattern.type === 'AIRPLANE_WITH_SINGLES' ||
      prevPattern.type === 'AIRPLANE_WITH_PAIRS'
    ) {
      const beating = findBeatingPlays(selectedCards, prevPattern).filter((p) => p.type === prevPattern.type);
      if (beating.length > 0) {
        return beating[0].cards;
      }
    }
    return null;
  }

  const byRank = groupCardsByRank(selectedCards);

  // 1. Prefer longest embedded PAIR_STRAIGHT (>= 3 pairs)
  let bestPairStraight: Card[] = [];
  for (let start = Rank.THREE; start <= Rank.QUEEN; start++) {
    const current: Card[] = [];
    let len = 0;
    while (start + len <= Rank.ACE && (byRank.get((start + len) as Rank)?.length ?? 0) >= 2) {
      const group = byRank.get((start + len) as Rank)!;
      current.push(group[0], group[1]);
      len++;
    }
    if (len >= 3 && current.length > bestPairStraight.length) {
      bestPairStraight = current;
    }
  }
  if (bestPairStraight.length >= 6) {
    return bestPairStraight;
  }

  // 2. Otherwise longest embedded STRAIGHT (>= 5 cards)
  let bestStraight: Card[] = [];
  for (let start = Rank.THREE; start <= Rank.TEN; start++) {
    const current: Card[] = [];
    let len = 0;
    while (start + len <= Rank.ACE && byRank.has((start + len) as Rank)) {
      current.push(byRank.get((start + len) as Rank)![0]);
      len++;
    }
    if (len >= 5 && current.length > bestStraight.length) {
      bestStraight = current;
    }
  }
  if (bestStraight.length >= 5) {
    return bestStraight;
  }

  return null;
}

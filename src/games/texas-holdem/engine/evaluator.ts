import { HandCategory, HandEvalResult, HoldemCard, HoldemRank } from './types';

const CATEGORY_NAMES: Record<HandCategory, string> = {
  9: '皇家同花顺',
  8: '同花顺',
  7: '四条',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌',
};

const RANK_LABELS: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: '10',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

const STRAIGHT_HIGH_TABLE = new Uint8Array(8192);
const TOP5_SCORE_TABLE = new Int32Array(8192);

(function initLookupTables() {
  for (let mask = 0; mask < 8192; mask++) {
    // Straights from A-high (bit 12..8) down to 6-high (bit 4..0)
    let straightHigh = 0;
    for (let highBit = 12; highBit >= 4; highBit--) {
      const pattern = 0x1f << (highBit - 4);
      if ((mask & pattern) === pattern) {
        straightHigh = highBit + 2;
        break;
      }
    }
    // Wheel straight: A-5-4-3-2 -> bit 12 and bits 3..0
    if (straightHigh === 0 && (mask & 0x100f) === 0x100f) {
      straightHigh = 5;
    }
    STRAIGHT_HIGH_TABLE[mask] = straightHigh;

    // Top 5 distinct ranks packed as 4-bit nibbles (values 2..14)
    let packed = 0;
    let count = 0;
    for (let b = 12; b >= 0 && count < 5; b--) {
      if ((mask & (1 << b)) !== 0) {
        packed = (packed << 4) | (b + 2);
        count++;
      }
    }
    if (count > 0 && count < 5) {
      packed <<= (5 - count) * 4;
    }
    TOP5_SCORE_TABLE[mask] = packed;
  }
})();

// Pre-allocated scratch buffers for zero-allocation evaluate7Fast
const SCRATCH_SUIT_COUNTS = new Int32Array(4);
const SCRATCH_SUIT_MASKS = new Int32Array(4);
const SCRATCH_RANK_COUNTS = new Uint8Array(13);

/**
 * Zero-allocation 7-card Texas Hold'em evaluator operating on 0..51 card codes.
 * Returns a strictly comparable integer score where higher score === stronger 5-card hand.
 */
export function evaluate7Fast(
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  c4: number,
  c5: number,
  c6: number,
): number {
  SCRATCH_SUIT_COUNTS[0] = 0;
  SCRATCH_SUIT_COUNTS[1] = 0;
  SCRATCH_SUIT_COUNTS[2] = 0;
  SCRATCH_SUIT_COUNTS[3] = 0;
  SCRATCH_SUIT_MASKS[0] = 0;
  SCRATCH_SUIT_MASKS[1] = 0;
  SCRATCH_SUIT_MASKS[2] = 0;
  SCRATCH_SUIT_MASKS[3] = 0;
  SCRATCH_RANK_COUNTS.fill(0);

  let allRanksMask = 0;
  const codes = [c0, c1, c2, c3, c4, c5, c6];
  for (let i = 0; i < 7; i++) {
    const code = codes[i];
    const suit = (code / 13) | 0;
    const rankIdx = code - suit * 13;
    const bit = 1 << rankIdx;
    SCRATCH_SUIT_COUNTS[suit]++;
    SCRATCH_SUIT_MASKS[suit] |= bit;
    SCRATCH_RANK_COUNTS[rankIdx]++;
    allRanksMask |= bit;
  }

  // Check Flush / Straight Flush / Royal Flush first (cannot coexist with Quads/Full House in 7 cards)
  for (let s = 0; s < 4; s++) {
    if (SCRATCH_SUIT_COUNTS[s] >= 5) {
      const sMask = SCRATCH_SUIT_MASKS[s];
      const sfHigh = STRAIGHT_HIGH_TABLE[sMask];
      if (sfHigh > 0) {
        if (sfHigh === 14) {
          return (9 << 20) | 14;
        }
        return (8 << 20) | sfHigh;
      }
      return (5 << 20) | TOP5_SCORE_TABLE[sMask];
    }
  }

  let quadRank = 0;
  let trips1 = 0;
  let trips2 = 0;
  let pair1 = 0;
  let pair2 = 0;

  for (let r = 12; r >= 0; r--) {
    const cnt = SCRATCH_RANK_COUNTS[r];
    if (cnt === 4) {
      quadRank = r + 2;
      break;
    } else if (cnt === 3) {
      if (trips1 === 0) trips1 = r + 2;
      else if (trips2 === 0) trips2 = r + 2;
    } else if (cnt === 2) {
      if (pair1 === 0) pair1 = r + 2;
      else if (pair2 === 0) pair2 = r + 2;
    }
  }

  if (quadRank > 0) {
    let kicker = 0;
    for (let r = 12; r >= 0; r--) {
      if (SCRATCH_RANK_COUNTS[r] > 0 && r + 2 !== quadRank) {
        kicker = r + 2;
        break;
      }
    }
    return (7 << 20) | (quadRank << 4) | kicker;
  }

  if (trips1 > 0 && (trips2 > 0 || pair1 > 0)) {
    const fhPair = trips2 > pair1 ? trips2 : pair1;
    return (6 << 20) | (trips1 << 4) | fhPair;
  }

  const straightHigh = STRAIGHT_HIGH_TABLE[allRanksMask];
  if (straightHigh > 0) {
    return (4 << 20) | straightHigh;
  }

  if (trips1 > 0) {
    const remMask = allRanksMask & ~(1 << (trips1 - 2));
    let k1 = 0;
    let k2 = 0;
    for (let r = 12; r >= 0; r--) {
      if ((remMask & (1 << r)) !== 0) {
        if (k1 === 0) k1 = r + 2;
        else {
          k2 = r + 2;
          break;
        }
      }
    }
    return (3 << 20) | (trips1 << 8) | (k1 << 4) | k2;
  }

  if (pair1 > 0 && pair2 > 0) {
    const remMask = allRanksMask & ~(1 << (pair1 - 2)) & ~(1 << (pair2 - 2));
    let kicker = 0;
    for (let r = 12; r >= 0; r--) {
      if ((remMask & (1 << r)) !== 0) {
        kicker = r + 2;
        break;
      }
    }
    return (2 << 20) | (pair1 << 8) | (pair2 << 4) | kicker;
  }

  if (pair1 > 0) {
    const remMask = allRanksMask & ~(1 << (pair1 - 2));
    let k1 = 0;
    let k2 = 0;
    let k3 = 0;
    for (let r = 12; r >= 0; r--) {
      if ((remMask & (1 << r)) !== 0) {
        if (k1 === 0) k1 = r + 2;
        else if (k2 === 0) k2 = r + 2;
        else {
          k3 = r + 2;
          break;
        }
      }
    }
    return (1 << 20) | (pair1 << 12) | (k1 << 8) | (k2 << 4) | k3;
  }

  return (0 << 20) | TOP5_SCORE_TABLE[allRanksMask];
}

function evaluateFiveCodes(codes: readonly number[]): {
  category: HandCategory;
  score: number;
  primaryRank: number;
  secondaryRank: number;
} {
  let suitMask = 0;
  let sameSuit = true;
  const firstSuit = (codes[0] / 13) | 0;
  let rankMask = 0;
  const counts = new Uint8Array(13);

  for (let i = 0; i < 5; i++) {
    const c = codes[i];
    const s = (c / 13) | 0;
    const rIdx = c - s * 13;
    if (s !== firstSuit) sameSuit = false;
    suitMask |= 1 << s;
    rankMask |= 1 << rIdx;
    counts[rIdx]++;
  }
  void suitMask;

  const straightHigh = STRAIGHT_HIGH_TABLE[rankMask];

  if (sameSuit && straightHigh > 0) {
    if (straightHigh === 14) {
      return { category: 9, score: (9 << 20) | 14, primaryRank: 14, secondaryRank: 0 };
    }
    return { category: 8, score: (8 << 20) | straightHigh, primaryRank: straightHigh, secondaryRank: 0 };
  }

  let quad = 0;
  let trips = 0;
  let pair1 = 0;
  let pair2 = 0;
  const kickers: number[] = [];

  for (let r = 12; r >= 0; r--) {
    const cnt = counts[r];
    if (cnt === 4) quad = r + 2;
    else if (cnt === 3) trips = r + 2;
    else if (cnt === 2) {
      if (pair1 === 0) pair1 = r + 2;
      else pair2 = r + 2;
    } else if (cnt === 1) {
      kickers.push(r + 2);
    }
  }

  if (quad > 0) {
    return {
      category: 7,
      score: (7 << 20) | (quad << 4) | (kickers[0] ?? 0),
      primaryRank: quad,
      secondaryRank: kickers[0] ?? 0,
    };
  }

  if (trips > 0 && pair1 > 0) {
    return {
      category: 6,
      score: (6 << 20) | (trips << 4) | pair1,
      primaryRank: trips,
      secondaryRank: pair1,
    };
  }

  if (sameSuit) {
    return {
      category: 5,
      score: (5 << 20) | TOP5_SCORE_TABLE[rankMask],
      primaryRank: kickers[0] ?? 0,
      secondaryRank: 0,
    };
  }

  if (straightHigh > 0) {
    return {
      category: 4,
      score: (4 << 20) | straightHigh,
      primaryRank: straightHigh,
      secondaryRank: 0,
    };
  }

  if (trips > 0) {
    return {
      category: 3,
      score: (3 << 20) | (trips << 8) | ((kickers[0] ?? 0) << 4) | (kickers[1] ?? 0),
      primaryRank: trips,
      secondaryRank: 0,
    };
  }

  if (pair1 > 0 && pair2 > 0) {
    return {
      category: 2,
      score: (2 << 20) | (pair1 << 8) | (pair2 << 4) | (kickers[0] ?? 0),
      primaryRank: pair1,
      secondaryRank: pair2,
    };
  }

  if (pair1 > 0) {
    return {
      category: 1,
      score:
        (1 << 20) |
        (pair1 << 12) |
        ((kickers[0] ?? 0) << 8) |
        ((kickers[1] ?? 0) << 4) |
        (kickers[2] ?? 0),
      primaryRank: pair1,
      secondaryRank: 0,
    };
  }

  return {
    category: 0,
    score: (0 << 20) | TOP5_SCORE_TABLE[rankMask],
    primaryRank: kickers[0] ?? 0,
    secondaryRank: 0,
  };
}

function buildDescription(category: HandCategory, primaryRank: number, secondaryRank: number): string {
  const p = RANK_LABELS[primaryRank as HoldemRank] ?? String(primaryRank);
  const s = RANK_LABELS[secondaryRank as HoldemRank] ?? String(secondaryRank);
  switch (category) {
    case 9:
      return '皇家同花顺';
    case 8:
      return `${p}高同花顺`;
    case 7:
      return `四条 ${p}`;
    case 6:
      return `葫芦 ${p} 带 ${s}`;
    case 5:
      return `${p}高同花`;
    case 4:
      return `${p}高顺子`;
    case 3:
      return `三条 ${p}`;
    case 2:
      return `两对 ${p} & ${s}`;
    case 1:
      return `一对 ${p}`;
    case 0:
      return `${p}高牌`;
  }
}

/**
 * Evaluates the strongest 5-card Texas Hold'em hand from 5, 6, or 7 cards,
 * returning exact score, Chinese category/description, and the exact 5 cards used.
 */
export function evaluateBestHand(cards: readonly HoldemCard[]): HandEvalResult {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateBestHand expects 5..7 cards, got ${cards.length}`);
  }

  const n = cards.length;
  let bestScore = -1;
  let bestCategory: HandCategory = 0;
  let bestPrimary = 0;
  let bestSecondary = 0;
  let bestIndices: [number, number, number, number, number] = [0, 1, 2, 3, 4];

  const fiveCodes = [0, 0, 0, 0, 0];
  for (let a = 0; a < n - 4; a++) {
    fiveCodes[0] = cards[a].code;
    for (let b = a + 1; b < n - 3; b++) {
      fiveCodes[1] = cards[b].code;
      for (let c = b + 1; c < n - 2; c++) {
        fiveCodes[2] = cards[c].code;
        for (let d = c + 1; d < n - 1; d++) {
          fiveCodes[3] = cards[d].code;
          for (let e = d + 1; e < n; e++) {
            fiveCodes[4] = cards[e].code;
            const res = evaluateFiveCodes(fiveCodes);
            if (res.score > bestScore) {
              bestScore = res.score;
              bestCategory = res.category;
              bestPrimary = res.primaryRank;
              bestSecondary = res.secondaryRank;
              bestIndices = [a, b, c, d, e];
            }
          }
        }
      }
    }
  }

  const bestFive = bestIndices
    .map((idx) => cards[idx])
    .sort((x, y) => y.rank - x.rank);

  return {
    category: bestCategory,
    categoryName: CATEGORY_NAMES[bestCategory],
    description: buildDescription(bestCategory, bestPrimary, bestSecondary),
    score: bestScore,
    bestFive,
  };
}

export function getHandCategoryName(category: HandCategory): string {
  return CATEGORY_NAMES[category];
}

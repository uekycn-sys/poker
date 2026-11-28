import { cardFromCode, createRng, formatCardShort } from '../engine/deck';
import { evaluate7Fast, evaluateBestHand } from '../engine/evaluator';
import { HoldemCard } from '../engine/types';
import {
  ALL_HAND_KEYS,
  COMBO_C0,
  COMBO_C1,
  COMBO_HAND_KEY_IDX,
  TOTAL_HOLDEM_COMBOS,
  WeightedHandRange,
} from './rangeModel';

export interface EquityResult {
  /** Hero win + tie share in [0, 1]. */
  equity: number;
  /** Pure win fraction in [0, 1]. */
  winRate: number;
  /** Tie fraction in [0, 1]. */
  tieRate: number;
  iterations: number;
  elapsedMs: number;
}

export interface OutsAnalysis {
  totalOuts: number;
  outCards: HoldemCard[];
  drawTagsZh: string[];
  summaryZh: string;
  ruleOf2And4Pct: number;
  hasFlushDraw: boolean;
  hasOesd: boolean;
  hasGutshot: boolean;
}

const DECK_POOL = new Int32Array(52);
const OPP_SCORES = new Int32Array(8);

/**
 * Fast Monte Carlo Texas Hold'em equity estimator.
 * Runs >= 1000 iterations using zero-allocation integer evaluation (< 25ms typical).
 */
export function calculateEquity(
  heroCards: readonly HoldemCard[],
  boardCards: readonly HoldemCard[],
  numOpponents: number,
  iterations = 1200,
  seed?: number,
): EquityResult {
  const startMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (heroCards.length !== 2 || numOpponents <= 0) {
    return { equity: 1, winRate: 1, tieRate: 0, iterations: 0, elapsedMs: 0 };
  }

  const opponents = Math.min(5, Math.max(1, numOpponents));
  const dead = new Set<number>();
  for (const c of heroCards) dead.add(c.code);
  for (const c of boardCards) dead.add(c.code);

  let poolLen = 0;
  for (let code = 0; code < 52; code++) {
    if (!dead.has(code)) {
      DECK_POOL[poolLen++] = code;
    }
  }

  const h0 = heroCards[0].code;
  const h1 = heroCards[1].code;
  const boardNeeded = Math.max(0, 5 - boardCards.length);
  const drawNeeded = boardNeeded + opponents * 2;
  const rng = createRng(seed);

  const bFixed0 = boardCards[0]?.code ?? -1;
  const bFixed1 = boardCards[1]?.code ?? -1;
  const bFixed2 = boardCards[2]?.code ?? -1;
  const bFixed3 = boardCards[3]?.code ?? -1;
  const bFixed4 = boardCards[4]?.code ?? -1;

  let equitySum = 0;
  let winCount = 0;
  let tieCount = 0;

  // Deterministic river check if board already has 5 cards and only 1 opponent? Keep MC uniform & fast.
  const actualIterations = Math.max(1000, iterations);

  for (let iter = 0; iter < actualIterations; iter++) {
    // Partial Fisher-Yates for only `drawNeeded` cards
    for (let i = 0; i < drawNeeded; i++) {
      const j = i + Math.floor(rng() * (poolLen - i));
      const tmp = DECK_POOL[i];
      DECK_POOL[i] = DECK_POOL[j];
      DECK_POOL[j] = tmp;
    }

    let cursor = 0;
    const b0 = bFixed0 >= 0 ? bFixed0 : DECK_POOL[cursor++];
    const b1 = bFixed1 >= 0 ? bFixed1 : DECK_POOL[cursor++];
    const b2 = bFixed2 >= 0 ? bFixed2 : DECK_POOL[cursor++];
    const b3 = bFixed3 >= 0 ? bFixed3 : DECK_POOL[cursor++];
    const b4 = bFixed4 >= 0 ? bFixed4 : DECK_POOL[cursor++];

    const heroScore = evaluate7Fast(h0, h1, b0, b1, b2, b3, b4);
    let heroBeaten = false;
    let tiedOpps = 0;

    for (let opp = 0; opp < opponents; opp++) {
      const o0 = DECK_POOL[cursor++];
      const o1 = DECK_POOL[cursor++];
      const oppScore = evaluate7Fast(o0, o1, b0, b1, b2, b3, b4);
      OPP_SCORES[opp] = oppScore;
      if (oppScore > heroScore) {
        heroBeaten = true;
        break;
      } else if (oppScore === heroScore) {
        tiedOpps++;
      }
    }

    if (!heroBeaten) {
      if (tiedOpps === 0) {
        winCount++;
        equitySum += 1;
      } else {
        tieCount++;
        equitySum += 1 / (tiedOpps + 1);
      }
    }
  }

  const endMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    equity: equitySum / actualIterations,
    winRate: winCount / actualIterations,
    tieRate: tieCount / actualIterations,
    iterations: actualIterations,
    elapsedMs: Math.max(0, endMs - startMs),
  };
}

interface CompiledOpponentSampler {
  c0: Uint8Array;
  c1: Uint8Array;
  cdf: Float64Array;
  count: number;
  totalWeight: number;
}

function isRangeObject(
  input: WeightedHandRange | Record<string, number>,
): input is WeightedHandRange {
  return 'comboWeights' in input && input.comboWeights instanceof Float64Array;
}

function compileOpponentSampler(
  rangeInput: WeightedHandRange | Record<string, number>,
  deadLo: number,
  deadHi: number,
): CompiledOpponentSampler {
  const c0Arr = new Uint8Array(TOTAL_HOLDEM_COMBOS);
  const c1Arr = new Uint8Array(TOTAL_HOLDEM_COMBOS);
  const cdf = new Float64Array(TOTAL_HOLDEM_COMBOS);

  const hasComboWeights = isRangeObject(rangeInput);
  const weightRecord = hasComboWeights ? rangeInput.weights : rangeInput;

  let count = 0;
  let running = 0;

  for (let i = 0; i < TOTAL_HOLDEM_COMBOS; i++) {
    const a = COMBO_C0[i];
    const b = COMBO_C1[i];

    const aBlocked = a < 32 ? (deadLo & (1 << a)) !== 0 : (deadHi & (1 << (a - 32))) !== 0;
    if (aBlocked) continue;
    const bBlocked = b < 32 ? (deadLo & (1 << b)) !== 0 : (deadHi & (1 << (b - 32))) !== 0;
    if (bBlocked) continue;

    const w = hasComboWeights
      ? rangeInput.comboWeights[i]
      : (weightRecord[ALL_HAND_KEYS[COMBO_HAND_KEY_IDX[i]]] ?? 0);

    if (w > 0) {
      running += w;
      c0Arr[count] = a;
      c1Arr[count] = b;
      cdf[count] = running;
      count++;
    }
  }

  // Fallback to uniform live combos if range is completely blocked/empty
  if (count === 0 || running <= 0) {
    count = 0;
    running = 0;
    for (let i = 0; i < TOTAL_HOLDEM_COMBOS; i++) {
      const a = COMBO_C0[i];
      const b = COMBO_C1[i];
      const aBlocked = a < 32 ? (deadLo & (1 << a)) !== 0 : (deadHi & (1 << (a - 32))) !== 0;
      if (aBlocked) continue;
      const bBlocked = b < 32 ? (deadLo & (1 << b)) !== 0 : (deadHi & (1 << (b - 32))) !== 0;
      if (bBlocked) continue;
      running += 1;
      c0Arr[count] = a;
      c1Arr[count] = b;
      cdf[count] = running;
      count++;
    }
  }

  return {
    c0: c0Arr,
    c1: c1Arr,
    cdf,
    count,
    totalWeight: running,
  };
}

function sampleCdfIndex(cdf: Float64Array, count: number, target: number): number {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cdf[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Range-vs-Range Monte Carlo equity estimator.
 * Samples legal (non-conflicting) 2-card holdings from each opponent's weighted inferred range.
 * Executes >= 1200 iterations well within 150ms.
 */
export function calculateRangeEquity(
  heroCards: readonly HoldemCard[],
  boardCards: readonly HoldemCard[],
  opponentRanges: readonly (WeightedHandRange | Record<string, number>)[],
  iterations = 1200,
  seed?: number,
): EquityResult {
  const startMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (heroCards.length !== 2 || opponentRanges.length === 0) {
    return { equity: 1, winRate: 1, tieRate: 0, iterations: 0, elapsedMs: 0 };
  }

  const activeRanges = opponentRanges.slice(0, 5);
  let deadLo = 0;
  let deadHi = 0;
  for (const c of heroCards) {
    if (c.code < 32) deadLo |= 1 << c.code;
    else deadHi |= 1 << (c.code - 32);
  }
  for (const c of boardCards) {
    if (c.code < 32) deadLo |= 1 << c.code;
    else deadHi |= 1 << (c.code - 32);
  }

  const samplers = activeRanges.map((r) => compileOpponentSampler(r, deadLo, deadHi));
  const oppCount = samplers.length;

  const h0 = heroCards[0].code;
  const h1 = heroCards[1].code;
  const bFixed0 = boardCards[0]?.code ?? -1;
  const bFixed1 = boardCards[1]?.code ?? -1;
  const bFixed2 = boardCards[2]?.code ?? -1;
  const bFixed3 = boardCards[3]?.code ?? -1;
  const bFixed4 = boardCards[4]?.code ?? -1;
  const boardNeeded = Math.max(0, 5 - boardCards.length);

  const oppH0 = new Int32Array(oppCount);
  const oppH1 = new Int32Array(oppCount);
  const drawnBoard = new Int32Array(5);

  const rng = createRng(seed);
  const actualIterations = Math.max(1000, iterations);

  let equitySum = 0;
  let winCount = 0;
  let tieCount = 0;

  for (let iter = 0; iter < actualIterations; iter++) {
    let usedLo = deadLo;
    let usedHi = deadHi;

    // Sample conflict-free hole cards for each opponent from their weighted range
    for (let opp = 0; opp < oppCount; opp++) {
      const sampler = samplers[opp];
      let chosenA = -1;
      let chosenB = -1;

      for (let attempt = 0; attempt < 16; attempt++) {
        const idx = sampleCdfIndex(sampler.cdf, sampler.count, rng() * sampler.totalWeight);
        const a = sampler.c0[idx];
        const b = sampler.c1[idx];
        const aUsed = a < 32 ? (usedLo & (1 << a)) !== 0 : (usedHi & (1 << (a - 32))) !== 0;
        if (aUsed) continue;
        const bUsed = b < 32 ? (usedLo & (1 << b)) !== 0 : (usedHi & (1 << (b - 32))) !== 0;
        if (bUsed) continue;
        chosenA = a;
        chosenB = b;
        break;
      }

      if (chosenA < 0) {
        const startIdx = Math.floor(rng() * sampler.count);
        for (let step = 0; step < sampler.count; step++) {
          const idx = (startIdx + step) % sampler.count;
          const a = sampler.c0[idx];
          const b = sampler.c1[idx];
          const aUsed = a < 32 ? (usedLo & (1 << a)) !== 0 : (usedHi & (1 << (a - 32))) !== 0;
          if (aUsed) continue;
          const bUsed = b < 32 ? (usedLo & (1 << b)) !== 0 : (usedHi & (1 << (b - 32))) !== 0;
          if (bUsed) continue;
          chosenA = a;
          chosenB = b;
          break;
        }
      }

      if (chosenA < 0) {
        // Emergency fallback to any two unused deck cards
        for (let code = 0; code < 52; code++) {
          const used = code < 32 ? (usedLo & (1 << code)) !== 0 : (usedHi & (1 << (code - 32))) !== 0;
          if (!used) {
            if (chosenA < 0) chosenA = code;
            else {
              chosenB = code;
              break;
            }
          }
        }
      }

      oppH0[opp] = chosenA;
      oppH1[opp] = chosenB;
      if (chosenA < 32) usedLo |= 1 << chosenA;
      else usedHi |= 1 << (chosenA - 32);
      if (chosenB < 32) usedLo |= 1 << chosenB;
      else usedHi |= 1 << (chosenB - 32);
    }

    // Sample remaining community cards without conflict
    for (let k = 0; k < boardNeeded; k++) {
      let code = 0;
      do {
        code = Math.floor(rng() * 52);
      } while (code < 32 ? (usedLo & (1 << code)) !== 0 : (usedHi & (1 << (code - 32))) !== 0);
      drawnBoard[k] = code;
      if (code < 32) usedLo |= 1 << code;
      else usedHi |= 1 << (code - 32);
    }

    let bCursor = 0;
    const b0 = bFixed0 >= 0 ? bFixed0 : drawnBoard[bCursor++];
    const b1 = bFixed1 >= 0 ? bFixed1 : drawnBoard[bCursor++];
    const b2 = bFixed2 >= 0 ? bFixed2 : drawnBoard[bCursor++];
    const b3 = bFixed3 >= 0 ? bFixed3 : drawnBoard[bCursor++];
    const b4 = bFixed4 >= 0 ? bFixed4 : drawnBoard[bCursor++];

    const heroScore = evaluate7Fast(h0, h1, b0, b1, b2, b3, b4);
    let heroBeaten = false;
    let tiedOpps = 0;

    for (let opp = 0; opp < oppCount; opp++) {
      const oppScore = evaluate7Fast(oppH0[opp], oppH1[opp], b0, b1, b2, b3, b4);
      if (oppScore > heroScore) {
        heroBeaten = true;
        break;
      } else if (oppScore === heroScore) {
        tiedOpps++;
      }
    }

    if (!heroBeaten) {
      if (tiedOpps === 0) {
        winCount++;
        equitySum += 1;
      } else {
        tieCount++;
        equitySum += 1 / (tiedOpps + 1);
      }
    }
  }

  const endMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    equity: equitySum / actualIterations,
    winRate: winCount / actualIterations,
    tieRate: tieCount / actualIterations,
    iterations: actualIterations,
    elapsedMs: Math.max(0, endMs - startMs),
  };
}

function hasStraightInMask(mask: number): number {
  let highest = 0;
  for (let highBit = 12; highBit >= 4; highBit--) {
    const pattern = 0x1f << (highBit - 4);
    if ((mask & pattern) === pattern) {
      highest = highBit + 2;
      break;
    }
  }
  if (highest === 0 && (mask & 0x100f) === 0x100f) {
    highest = 5;
  }
  return highest;
}

/**
 * Computes deduplicated drawing Outs on Flop (3 board cards) or Turn (4 board cards).
 */
export function analyzeOuts(
  heroCards: readonly HoldemCard[],
  boardCards: readonly HoldemCard[],
): OutsAnalysis {
  if (heroCards.length !== 2 || (boardCards.length !== 3 && boardCards.length !== 4)) {
    return {
      totalOuts: 0,
      outCards: [],
      drawTagsZh: [],
      summaryZh: '当前阶段无听牌补牌统计',
      ruleOf2And4Pct: 0,
      hasFlushDraw: false,
      hasOesd: false,
      hasGutshot: false,
    };
  }

  const known = [...heroCards, ...boardCards];
  const knownCodes = new Set(known.map((c) => c.code));
  const currentEval = evaluateBestHand(known);
  const outCodes = new Set<number>();
  const drawTagsZh: string[] = [];

  let hasFlushDraw = false;
  let hasOesd = false;
  let hasGutshot = false;

  // 1. Flush Draw (4 of same suit, at least 1 in hero hand, and not already a made flush)
  if (currentEval.category < 5) {
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const suitMatched = known.filter((c) => ((c.code / 13) | 0) === sIdx);
      const heroHasSuit = heroCards.some((c) => ((c.code / 13) | 0) === sIdx);
      if (suitMatched.length === 4 && heroHasSuit) {
        hasFlushDraw = true;
        drawTagsZh.push('同花听牌 (9 Outs)');
        for (let r = 0; r < 13; r++) {
          const code = sIdx * 13 + r;
          if (!knownCodes.has(code)) {
            outCodes.add(code);
          }
        }
        break;
      }
    }
  }

  // 2. Straight Draw (OESD / Double Gutshot / Gutshot) when not already holding a straight+
  if (currentEval.category < 4) {
    let mask = 0;
    for (const c of known) {
      mask |= 1 << (c.rank - 2);
    }
    const straightRanks: number[] = [];
    for (let rIdx = 0; rIdx < 13; rIdx++) {
      if ((mask & (1 << rIdx)) !== 0) continue;
      if (hasStraightInMask(mask | (1 << rIdx)) > 0) {
        straightRanks.push(rIdx);
      }
    }

    if (straightRanks.length >= 2) {
      hasOesd = true;
      drawTagsZh.push(`两头顺子听牌 (${straightRanks.length * 4} Outs)`);
    } else if (straightRanks.length === 1) {
      hasGutshot = true;
      drawTagsZh.push('卡顺听牌 (4 Outs)');
    }

    for (const rIdx of straightRanks) {
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const code = sIdx * 13 + rIdx;
        if (!knownCodes.has(code)) {
          outCodes.add(code);
        }
      }
    }
  }

  // 3. Made-hand upgrade outs (when not already a combo draw >= 12 outs)
  const primaryDrawCount = outCodes.size;
  if (currentEval.category === 3) {
    // Trips / Set -> Full House or Quads using board ranks + hero pocket rank
    const rankCounts = new Map<number, number>();
    for (const c of known) {
      rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    }
    let upgradeAdded = 0;
    for (const [rank, count] of rankCounts.entries()) {
      if (count === 1 || count === 3) {
        const rIdx = rank - 2;
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const code = sIdx * 13 + rIdx;
          if (!knownCodes.has(code) && !outCodes.has(code)) {
            outCodes.add(code);
            upgradeAdded++;
          }
        }
      }
    }
    if (upgradeAdded > 0) {
      drawTagsZh.push(`暗三冲葫芦/四条 (+${upgradeAdded} Outs)`);
    }
  } else if (currentEval.category === 2) {
    // Two Pair -> Full House (4 outs)
    const rankCounts = new Map<number, number>();
    for (const c of known) {
      rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    }
    let fhAdded = 0;
    for (const [rank, count] of rankCounts.entries()) {
      if (count === 2) {
        const rIdx = rank - 2;
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const code = sIdx * 13 + rIdx;
          if (!knownCodes.has(code) && !outCodes.has(code)) {
            outCodes.add(code);
            fhAdded++;
          }
        }
      }
    }
    if (fhAdded > 0) {
      drawTagsZh.push(`两对冲葫芦 (+${fhAdded} Outs)`);
    }
  } else if (currentEval.category === 1 && primaryDrawCount < 8) {
    // One Pair -> Trips (2 outs) + Two Pair with unpaired hero hole card (3 outs)
    const boardRanks = new Set(boardCards.map((c) => c.rank));
    const [hA, hB] = heroCards;
    let pairUpgrade = 0;
    if (hA.rank === hB.rank) {
      // Pocket pair -> Set (2 outs)
      const rIdx = hA.rank - 2;
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const code = sIdx * 13 + rIdx;
        if (!knownCodes.has(code) && !outCodes.has(code)) {
          outCodes.add(code);
          pairUpgrade++;
        }
      }
    } else {
      for (const hc of heroCards) {
        const rIdx = hc.rank - 2;
        const isPaired = boardRanks.has(hc.rank);
        if (isPaired || hc.rank > Math.max(...boardCards.map((b) => b.rank))) {
          for (let sIdx = 0; sIdx < 4; sIdx++) {
            const code = sIdx * 13 + rIdx;
            if (!knownCodes.has(code) && !outCodes.has(code)) {
              outCodes.add(code);
              pairUpgrade++;
            }
          }
        }
      }
    }
    if (pairUpgrade > 0) {
      drawTagsZh.push(`暗三/两对补牌 (+${pairUpgrade} Outs)`);
    }
  } else if (currentEval.category === 0 && primaryDrawCount < 9) {
    // High Card -> Overcards to board (3 outs per overcard)
    const maxBoardRank = Math.max(...boardCards.map((c) => c.rank));
    const overcards = heroCards.filter((c) => c.rank > maxBoardRank);
    let overAdded = 0;
    for (const oc of overcards) {
      const rIdx = oc.rank - 2;
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const code = sIdx * 13 + rIdx;
        if (!knownCodes.has(code) && !outCodes.has(code)) {
          outCodes.add(code);
          overAdded++;
        }
      }
    }
    if (overAdded > 0) {
      drawTagsZh.push(`高张顶对补牌 (+${overAdded} Outs)`);
    }
  }

  const outCards = Array.from(outCodes)
    .sort((a, b) => (b % 13) - (a % 13) || a - b)
    .map(cardFromCode);

  const totalOuts = outCards.length;
  const isFlop = boardCards.length === 3;
  const ruleOf2And4Pct =
    totalOuts === 0
      ? 0
      : isFlop
        ? Math.min(96, totalOuts * 4 - Math.max(0, totalOuts - 8))
        : Math.min(96, Math.round(totalOuts * 2.17));

  let summaryZh = '当前暂无显著听牌补牌';
  if (hasFlushDraw && hasOesd) {
    summaryZh = `两头顺子 + 同花听牌（强力双抽）共 ${totalOuts} 张 Outs（成牌率约 ${ruleOf2And4Pct}%）`;
  } else if (hasFlushDraw && hasGutshot) {
    summaryZh = `同花听牌 + 卡顺共 ${totalOuts} 张 Outs（成牌率约 ${ruleOf2And4Pct}%）`;
  } else if (drawTagsZh.length > 0) {
    summaryZh = `${drawTagsZh.join(' + ')}，合计 ${totalOuts} 张 Outs（成牌率约 ${ruleOf2And4Pct}%）`;
  }

  if (outCards.length > 0 && outCards.length <= 6) {
    summaryZh += `：[${outCards.map(formatCardShort).join(' ')}]`;
  }

  return {
    totalOuts,
    outCards,
    drawTagsZh,
    summaryZh,
    ruleOf2And4Pct,
    hasFlushDraw,
    hasOesd,
    hasGutshot,
  };
}

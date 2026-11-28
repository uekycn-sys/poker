import { cardFromCode } from '../engine/deck';
import { ActionRecord, HandState, HoldemCard, PositionName } from '../engine/types';
import { analyzeBoardTexture, BoardTexture } from './boardTexture';
import { getPreflopRangeMatrix, RANKS_DESC, scorePreflopStrength } from './gtoRanges';
import { AiPersona, AiStyleId } from './personas';

export type RangeTightness = 'ultra_narrow' | 'narrow' | 'medium' | 'wide';

export interface WeightedHandRange {
  seat: number;
  personaName: string;
  styleId: AiStyleId;
  /** Weight [0..1] for each of the 169 canonical hand keys (AA, AKs, AKo, ...) */
  weights: Record<string, number>;
  /** Exact per-combo weights for all 1326 canonical card pairs */
  comboWeights: Float64Array;
  /** Fraction of 1326 starting combos represented (weighted sum / 1326) */
  rangePct: number;
  tightness: RangeTightness;
  actionSummaryZh: string;
  summaryZh: string;
}

export const TOTAL_HOLDEM_COMBOS = 1326;
export const TOTAL_CANONICAL_HANDS = 169;

const RANK_CHARS_DESC = RANKS_DESC;
const RANK_TO_IDX: Record<number, number> = {
  14: 0,
  13: 1,
  12: 2,
  11: 3,
  10: 4,
  9: 5,
  8: 6,
  7: 7,
  6: 8,
  5: 9,
  4: 10,
  3: 11,
  2: 12,
};

export const ALL_HAND_KEYS: string[] = [];
export const HAND_KEY_TO_IDX = new Map<string, number>();
export const HAND_KEY_COMBO_COUNTS = new Uint8Array(TOTAL_CANONICAL_HANDS);
export const HAND_KEY_STRENGTH = new Float32Array(TOTAL_CANONICAL_HANDS);

export const COMBO_C0 = new Uint8Array(TOTAL_HOLDEM_COMBOS);
export const COMBO_C1 = new Uint8Array(TOTAL_HOLDEM_COMBOS);
export const COMBO_HAND_KEY_IDX = new Uint8Array(TOTAL_HOLDEM_COMBOS);

(function initCanonicalTables() {
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const r1 = RANK_CHARS_DESC[row];
      const r2 = RANK_CHARS_DESC[col];
      const key = row === col ? `${r1}${r2}` : row < col ? `${r1}${r2}s` : `${r2}${r1}o`;
      const idx = ALL_HAND_KEYS.length;
      ALL_HAND_KEYS.push(key);
      HAND_KEY_TO_IDX.set(key, idx);
      HAND_KEY_COMBO_COUNTS[idx] = row === col ? 6 : row < col ? 4 : 12;
    }
  }

  let comboCursor = 0;
  const seenStrength = new Uint8Array(TOTAL_CANONICAL_HANDS);

  for (let c0 = 0; c0 < 52; c0++) {
    const s0 = (c0 / 13) | 0;
    const rank0 = (c0 % 13) + 2;
    for (let c1 = c0 + 1; c1 < 52; c1++) {
      const s1 = (c1 / 13) | 0;
      const rank1 = (c1 % 13) + 2;

      const hi = rank0 >= rank1 ? rank0 : rank1;
      const lo = rank0 >= rank1 ? rank1 : rank0;
      const hiChar = RANK_CHARS_DESC[RANK_TO_IDX[hi]];
      const loChar = RANK_CHARS_DESC[RANK_TO_IDX[lo]];
      const key =
        hi === lo ? `${hiChar}${loChar}` : `${hiChar}${loChar}${s0 === s1 ? 's' : 'o'}`;
      const keyIdx = HAND_KEY_TO_IDX.get(key)!;

      COMBO_C0[comboCursor] = c0;
      COMBO_C1[comboCursor] = c1;
      COMBO_HAND_KEY_IDX[comboCursor] = keyIdx;
      comboCursor++;

      if (!seenStrength[keyIdx]) {
        seenStrength[keyIdx] = 1;
        HAND_KEY_STRENGTH[keyIdx] = scorePreflopStrength([
          cardFromCode(c0),
          cardFromCode(c1),
        ]);
      }
    }
  }
})();

export const HAND_KEYS_BY_STRENGTH_DESC: number[] = Array.from(
  { length: TOTAL_CANONICAL_HANDS },
  (_, i) => i,
).sort((a, b) => HAND_KEY_STRENGTH[b] - HAND_KEY_STRENGTH[a]);

export const DEFAULT_HERO_MODEL_PERSONA: AiPersona = {
  seat: 0,
  id: 'hero-model',
  name: 'Hero',
  styleId: 'TAG',
  styleLabel: '均衡紧凶',
  shortTag: 'TAG',
  avatarId: 'spade',
  vpipBias: 0,
  pfrBias: 0.04,
  threeBetFreq: 0.6,
  cbetFreq: 0.7,
  semiBluffFreq: 0.6,
  pureBluffFreq: 0.16,
  callThresholdDelta: 0,
  thinValueThreshold: 0.6,
  foldToBetModifier: 0,
  bioZh: '',
  exploitTipZh: '',
};

type PreflopTier =
  | 'unacted'
  | 'check_bb'
  | 'limp'
  | 'open_raise'
  | 'cold_call'
  | 'three_bet'
  | 'call_3bet'
  | 'four_bet_plus';

const PREFLOP_TIER_LABELS_ZH: Record<PreflopTier, string> = {
  unacted: '未表态基准范围',
  check_bb: '大盲免费看牌范围',
  limp: '翻前平跟入池范围',
  open_raise: '率先开池加注范围',
  cold_call: '翻前平跟加注范围',
  three_bet: '3-Bet 反加范围',
  call_3bet: '跟注 3-Bet 范围',
  four_bet_plus: '4-Bet+ 超强范围',
};

function setHandWeights(
  target: Float64Array,
  handWeights: Record<string, number>,
): void {
  for (const [key, w] of Object.entries(handWeights)) {
    const idx = HAND_KEY_TO_IDX.get(key);
    if (idx !== undefined) {
      target[idx] = Math.max(target[idx], Math.min(1, w));
    }
  }
}

function addTopPctHands(
  target: Float64Array,
  pct: number,
  weight = 1,
  minWeightFloor = 0,
): void {
  const targetCombos = TOTAL_HOLDEM_COMBOS * Math.max(0.01, Math.min(1, pct));
  let acc = 0;
  for (const idx of HAND_KEYS_BY_STRENGTH_DESC) {
    if (acc >= targetCombos) break;
    const combos = HAND_KEY_COMBO_COUNTS[idx];
    const remaining = targetCombos - acc;
    const frac = remaining >= combos ? 1 : Math.max(0.2, remaining / combos);
    target[idx] = Math.max(target[idx], Math.max(minWeightFloor, weight * frac));
    acc += combos * frac;
  }
}

function analyzeOpponentPreflopTier(
  actions: readonly ActionRecord[],
  opponentSeat: number,
): PreflopTier {
  const preflop = actions.filter((a) => a.street === 'preflop');
  let raiseCount = 0;
  let openedByTarget = false;
  let tier: PreflopTier = 'unacted';

  for (const rec of preflop) {
    const isAgg = rec.action.type === 'raise' || (rec.action.type === 'all_in' && rec.amountAdded > 0);
    if (rec.seat === opponentSeat) {
      if (isAgg) {
        if (raiseCount === 0) {
          tier = 'open_raise';
          openedByTarget = true;
        } else if (raiseCount === 1) {
          tier = 'three_bet';
        } else {
          tier = 'four_bet_plus';
        }
      } else if (rec.action.type === 'call') {
        if (raiseCount === 0) {
          tier = 'limp';
        } else if (raiseCount >= 2 && openedByTarget) {
          tier = 'call_3bet';
        } else {
          tier = 'cold_call';
        }
      } else if (rec.action.type === 'check' && raiseCount === 0) {
        if (tier === 'unacted') tier = 'check_bb';
      }
    }
    if (isAgg) {
      raiseCount++;
    }
  }

  return tier;
}

function buildPreflopHandWeights(
  styleId: AiStyleId,
  position: PositionName,
  tier: PreflopTier,
): Float64Array {
  const w = new Float64Array(TOTAL_CANONICAL_HANDS);

  if (tier === 'four_bet_plus') {
    if (styleId === 'NIT' || styleId === 'CALLING_STATION') {
      setHandWeights(w, { AA: 1, KK: 1, QQ: 0.45, AKs: 0.8, AKo: 0.35 });
    } else if (styleId === 'LAG') {
      setHandWeights(w, {
        AA: 1,
        KK: 1,
        QQ: 0.9,
        JJ: 0.55,
        AKs: 1,
        AKo: 0.9,
        AQs: 0.5,
        A5s: 0.6,
        A4s: 0.45,
        KQs: 0.3,
      });
    } else {
      setHandWeights(w, { AA: 1, KK: 1, QQ: 0.75, AKs: 1, AKo: 0.65, A5s: 0.35 });
    }
    return w;
  }

  if (tier === 'three_bet') {
    if (styleId === 'NIT') {
      // ~4.3% ultra-narrow premium 3-bet range: QQ+/AK + partial JJ/AQs/AQo/TT/KQs
      setHandWeights(w, {
        AA: 1,
        KK: 1,
        QQ: 1,
        AKs: 1,
        AKo: 1,
        JJ: 0.85,
        AQs: 0.9,
        AQo: 0.5,
        TT: 0.45,
        KQs: 0.65,
        AJs: 0.5,
        A5s: 0.25,
      });
      return w;
    }
    if (styleId === 'CALLING_STATION') {
      setHandWeights(w, { AA: 1, KK: 1, QQ: 0.6, AKs: 0.85, AKo: 0.45 });
      return w;
    }
    const matrix = getPreflopRangeMatrix(position, true);
    for (const row of matrix) {
      for (const cell of row) {
        const idx = HAND_KEY_TO_IDX.get(cell.handKey)!;
        if (cell.action === 'raise') {
          w[idx] = cell.tier === 'premium' ? 1 : styleId === 'LAG' ? 0.9 : 0.72;
        }
      }
    }
    if (styleId === 'LAG') {
      setHandWeights(w, {
        '99': 0.65,
        ATs: 0.65,
        KJs: 0.7,
        KTs: 0.55,
        QJs: 0.7,
        JTs: 0.75,
        T9s: 0.65,
        '98s': 0.5,
        A5s: 0.8,
        A4s: 0.75,
        A3s: 0.6,
        A2s: 0.5,
        AJo: 0.55,
        KQo: 0.55,
      });
    }
    return w;
  }

  if (tier === 'open_raise') {
    if (styleId === 'NIT') {
      const pct = position === 'BTN' || position === 'CO' ? 0.13 : 0.09;
      addTopPctHands(w, pct, 1);
      return w;
    }
    if (styleId === 'CALLING_STATION') {
      addTopPctHands(w, 0.1, 1);
      return w;
    }
    const matrix = getPreflopRangeMatrix(position, false);
    for (const row of matrix) {
      for (const cell of row) {
        const idx = HAND_KEY_TO_IDX.get(cell.handKey)!;
        if (cell.action === 'raise') {
          w[idx] = styleId === 'TAG' && cell.tier === 'playable' ? 0.82 : 1;
        }
      }
    }
    if (styleId === 'LAG') {
      addTopPctHands(w, position === 'BTN' ? 0.46 : position === 'CO' ? 0.36 : 0.26, 0.72);
    }
    return w;
  }

  if (tier === 'call_3bet') {
    const baseLooseness =
      styleId === 'NIT' ? 0.09 : styleId === 'CALLING_STATION' ? 0.35 : styleId === 'LAG' ? 0.22 : 0.15;
    addTopPctHands(w, baseLooseness, 0.9);
    // Premiums often 4-bet instead of flatting 3-bet (except slowplays / station)
    if (styleId !== 'CALLING_STATION') {
      setHandWeights(w, { AA: 0.25, KK: 0.3, AKs: 0.45 });
    }
    return w;
  }

  if (tier === 'cold_call') {
    if (styleId === 'NIT') {
      addTopPctHands(w, 0.11, 0.9);
      setHandWeights(w, { AA: 0.15, KK: 0.15, QQ: 0.25, AKs: 0.25, AKo: 0.2 });
      return w;
    }
    if (styleId === 'CALLING_STATION') {
      addTopPctHands(w, 0.56, 0.95);
      return w;
    }
    const matrix = getPreflopRangeMatrix(position, true);
    for (const row of matrix) {
      for (const cell of row) {
        const idx = HAND_KEY_TO_IDX.get(cell.handKey)!;
        if (cell.action === 'call') {
          w[idx] = 0.9;
        } else if (cell.action === 'raise' && cell.tier !== 'premium') {
          w[idx] = 0.25;
        }
      }
    }
    if (styleId === 'LAG') {
      addTopPctHands(w, 0.34, 0.65);
    }
    return w;
  }

  if (tier === 'limp') {
    if (styleId === 'CALLING_STATION') {
      addTopPctHands(w, 0.68, 0.9);
    } else if (styleId === 'NIT') {
      addTopPctHands(w, 0.16, 0.85);
    } else {
      addTopPctHands(w, 0.34, 0.8);
      setHandWeights(w, { AA: 0.1, KK: 0.1, QQ: 0.15, AKs: 0.15 });
    }
    return w;
  }

  if (tier === 'check_bb') {
    const pct = styleId === 'CALLING_STATION' ? 0.9 : styleId === 'NIT' ? 0.5 : 0.78;
    addTopPctHands(w, pct, 0.85);
    setHandWeights(w, { AA: 0.1, KK: 0.1, QQ: 0.15, AKs: 0.15 });
    return w;
  }

  // 'unacted'
  const unactedPct =
    styleId === 'NIT' ? 0.15 : styleId === 'CALLING_STATION' ? 0.58 : styleId === 'LAG' ? 0.42 : 0.26;
  addTopPctHands(w, unactedPct, 0.9);
  return w;
}

type PostflopBucket =
  | 'monster'
  | 'strong_pair'
  | 'weak_pair'
  | 'strong_draw'
  | 'gutshot_overcards'
  | 'air';

function hasStraight5InMask(mask: number): boolean {
  for (let highBit = 12; highBit >= 4; highBit--) {
    const pattern = 0x1f << (highBit - 4);
    if ((mask & pattern) === pattern) return true;
  }
  return (mask & 0x100f) === 0x100f;
}

function classifyComboOnBoard(
  c0: number,
  c1: number,
  boardCards: readonly HoldemCard[],
  boardMaxRank: number,
  boardRankCounts: Uint8Array,
  boardSuitCounts: Uint8Array,
  boardRankMask: number,
  boardIsPaired: boolean,
): PostflopBucket {
  const s0 = (c0 / 13) | 0;
  const r0 = (c0 % 13) + 2;
  const s1 = (c1 / 13) | 0;
  const r1 = (c1 % 13) + 2;

  const isPocketPair = r0 === r1;
  const r0BoardCnt = boardRankCounts[r0 - 2];
  const r1BoardCnt = boardRankCounts[r1 - 2];

  // Flush check
  let flushHit = false;
  let flushDraw = false;
  if (s0 === s1) {
    const totalSuit = boardSuitCounts[s0] + 2;
    if (totalSuit >= 5) flushHit = true;
    else if (totalSuit === 4) flushDraw = true;
  } else {
    if (boardSuitCounts[s0] + 1 >= 5 || boardSuitCounts[s1] + 1 >= 5) flushHit = true;
    else if (boardSuitCounts[s0] + 1 === 4 || boardSuitCounts[s1] + 1 === 4) flushDraw = true;
  }
  if (flushHit) return 'monster';

  // Straight check
  const combinedMask = boardRankMask | (1 << (r0 - 2)) | (1 << (r1 - 2));
  if (hasStraight5InMask(combinedMask) && !hasStraight5InMask(boardRankMask)) {
    return 'monster';
  }

  // Trips / Set / Full House / Quads / Two Pair
  if (isPocketPair) {
    if (r0BoardCnt >= 1) return 'monster'; // Set / Quads / Full House
    if (r0 > boardMaxRank) return 'strong_pair'; // Overpair
    return 'weak_pair';
  }

  if (r0BoardCnt >= 2 || r1BoardCnt >= 2) return 'monster'; // Trips / Full House on paired board
  if (r0BoardCnt >= 1 && r1BoardCnt >= 1) return 'monster'; // Two Pair

  if (r0BoardCnt === 1 || r1BoardCnt === 1) {
    const pairedRank = r0BoardCnt === 1 ? r0 : r1;
    const kicker = r0BoardCnt === 1 ? r1 : r0;
    if (boardIsPaired) {
      // One pair card on a paired board -> Two pair (stronger if top pair)
      return pairedRank >= boardMaxRank ? 'strong_pair' : 'weak_pair';
    }
    if (pairedRank === boardMaxRank) {
      return kicker >= 10 ? 'strong_pair' : 'weak_pair';
    }
    return 'weak_pair';
  }

  // Draws (only relevant before river)
  if (boardCards.length < 5) {
    let straightOutRanks = 0;
    for (let bit = 0; bit < 13; bit++) {
      if ((combinedMask & (1 << bit)) !== 0) continue;
      if (hasStraight5InMask(combinedMask | (1 << bit))) {
        straightOutRanks++;
        if (straightOutRanks >= 2) break;
      }
    }
    if (flushDraw || straightOutRanks >= 2) return 'strong_draw';
    if (straightOutRanks === 1 || (r0 > boardMaxRank && r1 > boardMaxRank)) {
      return 'gutshot_overcards';
    }
  }

  return 'air';
}

function getPostflopBucketMultiplier(
  bucket: PostflopBucket,
  actionKind: 'bet' | 'raise' | 'call' | 'check',
  styleId: AiStyleId,
  texture: BoardTexture,
): number {
  const isDry = texture.wetness === 'dry';

  if (actionKind === 'bet') {
    switch (bucket) {
      case 'monster':
        return 1.0;
      case 'strong_pair':
        return styleId === 'CALLING_STATION' ? 0.72 : 0.95;
      case 'strong_draw':
        return styleId === 'LAG' ? 0.85 : styleId === 'NIT' ? 0.35 : styleId === 'CALLING_STATION' ? 0.25 : 0.68;
      case 'weak_pair':
        return isDry ? (styleId === 'LAG' ? 0.5 : 0.35) : 0.16;
      case 'gutshot_overcards':
        return isDry ? (styleId === 'LAG' ? 0.55 : styleId === 'NIT' ? 0.15 : 0.38) : styleId === 'LAG' ? 0.35 : 0.18;
      case 'air':
        if (styleId === 'LAG') return isDry ? 0.45 : 0.22;
        if (styleId === 'NIT') return isDry ? 0.12 : 0.03;
        if (styleId === 'CALLING_STATION') return 0.05;
        return isDry ? 0.32 : 0.09;
    }
  }

  if (actionKind === 'raise') {
    switch (bucket) {
      case 'monster':
        return 1.0;
      case 'strong_pair':
        return styleId === 'NIT' ? 0.14 : styleId === 'LAG' ? 0.45 : 0.28;
      case 'strong_draw':
        return styleId === 'LAG' ? 0.82 : styleId === 'NIT' ? 0.12 : styleId === 'CALLING_STATION' ? 0.1 : 0.58;
      case 'weak_pair':
        return styleId === 'LAG' ? 0.14 : 0.05;
      case 'gutshot_overcards':
        return styleId === 'LAG' ? 0.16 : 0.05;
      case 'air':
        return styleId === 'LAG' ? 0.1 : 0.02;
    }
  }

  if (actionKind === 'call') {
    switch (bucket) {
      case 'monster':
        return 0.72;
      case 'strong_pair':
        return 1.0;
      case 'weak_pair':
        return styleId === 'CALLING_STATION' ? 0.95 : styleId === 'LAG' ? 0.72 : styleId === 'NIT' ? 0.28 : 0.55;
      case 'strong_draw':
        return styleId === 'CALLING_STATION' ? 0.95 : styleId === 'NIT' ? 0.65 : 0.88;
      case 'gutshot_overcards':
        return styleId === 'CALLING_STATION' ? 0.55 : styleId === 'LAG' ? 0.35 : styleId === 'NIT' ? 0.06 : 0.2;
      case 'air':
        return styleId === 'CALLING_STATION' ? 0.18 : styleId === 'LAG' ? 0.08 : 0.02;
    }
  }

  // 'check'
  switch (bucket) {
    case 'monster':
      return styleId === 'CALLING_STATION' ? 0.85 : 0.48;
    case 'strong_pair':
      return 0.65;
    case 'weak_pair':
      return 0.92;
    case 'strong_draw':
      return 0.68;
    case 'gutshot_overcards':
      return 0.85;
    case 'air':
      return 0.92;
  }
}

/**
 * Infers an opponent's weighted 169-hand & 1326-combo range from their persona,
 * table position, and full preflop + postflop action history in `state.actions`.
 */
export function inferOpponentRange(
  state: HandState,
  opponentSeat: number,
  persona: AiPersona,
): WeightedHandRange {
  const player = state.players.find((p) => p.seat === opponentSeat);
  const position: PositionName = player?.position ?? 'MP';
  const preflopTier = analyzeOpponentPreflopTier(state.actions, opponentSeat);
  const handWeightsArr = buildPreflopHandWeights(persona.styleId, position, preflopTier);

  const comboWeights = new Float64Array(TOTAL_HOLDEM_COMBOS);
  for (let idx = 0; idx < TOTAL_HOLDEM_COMBOS; idx++) {
    comboWeights[idx] = handWeightsArr[COMBO_HAND_KEY_IDX[idx]];
  }

  // Condition on postflop actions if community cards are present
  const postflopOppActions = state.actions.filter(
    (a) => a.seat === opponentSeat && a.street !== 'preflop',
  );
  let lastPostflopTag = '';

  if (state.communityCards.length >= 3 && postflopOppActions.length > 0) {
    const texture = analyzeBoardTexture(state.communityCards);
    const boardRankCounts = new Uint8Array(13);
    const boardSuitCounts = new Uint8Array(4);
    let boardMaxRank = 0;
    let boardRankMask = 0;
    let boardIsPaired = false;

    for (const c of state.communityCards) {
      const rIdx = c.rank - 2;
      boardRankCounts[rIdx]++;
      if (boardRankCounts[rIdx] >= 2) boardIsPaired = true;
      boardSuitCounts[(c.code / 13) | 0]++;
      if (c.rank > boardMaxRank) boardMaxRank = c.rank;
      boardRankMask |= 1 << rIdx;
    }

    // Track whether a bet already occurred on each street before opponent acted
    const postflopAll = state.actions.filter((a) => a.street !== 'preflop');
    const streetHadBet = new Set<string>();
    const actionKinds: ('bet' | 'raise' | 'call' | 'check')[] = [];

    for (const rec of postflopAll) {
      const hadBet = streetHadBet.has(rec.street);
      const isAgg = rec.action.type === 'raise' || (rec.action.type === 'all_in' && rec.amountAdded > 0);
      if (rec.seat === opponentSeat) {
        if (isAgg) {
          const kind = hadBet ? 'raise' : 'bet';
          actionKinds.push(kind);
          lastPostflopTag = kind === 'raise' ? '翻后加注' : '翻后下注/C-Bet';
        } else if (rec.action.type === 'call') {
          actionKinds.push('call');
          lastPostflopTag = '翻后跟注';
        } else if (rec.action.type === 'check') {
          actionKinds.push('check');
        }
      }
      if (isAgg) {
        streetHadBet.add(rec.street);
      }
    }

    if (actionKinds.length > 0) {
      // Apply the most informative postflop actions (cap compounding to keep range non-degenerate)
      const activeKinds = actionKinds.slice(-2);
      for (let i = 0; i < TOTAL_HOLDEM_COMBOS; i++) {
        if (comboWeights[i] <= 0) continue;
        const bucket = classifyComboOnBoard(
          COMBO_C0[i],
          COMBO_C1[i],
          state.communityCards,
          boardMaxRank,
          boardRankCounts,
          boardSuitCounts,
          boardRankMask,
          boardIsPaired,
        );
        let mult = 1;
        for (const kind of activeKinds) {
          mult *= getPostflopBucketMultiplier(bucket, kind, persona.styleId, texture);
        }
        comboWeights[i] *= mult;
      }
    }
  }

  // Aggregate back to 169 canonical weights & compute exact weighted range percentage
  const weightSumPerHand = new Float64Array(TOTAL_CANONICAL_HANDS);
  let totalComboWeight = 0;
  for (let i = 0; i < TOTAL_HOLDEM_COMBOS; i++) {
    const w = comboWeights[i];
    totalComboWeight += w;
    weightSumPerHand[COMBO_HAND_KEY_IDX[i]] += w;
  }

  // Guard against empty range
  if (totalComboWeight < 1e-4) {
    for (let i = 0; i < TOTAL_HOLDEM_COMBOS; i++) {
      const w = handWeightsArr[COMBO_HAND_KEY_IDX[i]];
      comboWeights[i] = w;
      totalComboWeight += w;
      weightSumPerHand[COMBO_HAND_KEY_IDX[i]] += w;
    }
  }

  const weights: Record<string, number> = {};
  for (let k = 0; k < TOTAL_CANONICAL_HANDS; k++) {
    const avg = weightSumPerHand[k] / HAND_KEY_COMBO_COUNTS[k];
    if (avg > 0.001) {
      weights[ALL_HAND_KEYS[k]] = Number(avg.toFixed(4));
    }
  }

  const rangePct = Math.min(1, totalComboWeight / TOTAL_HOLDEM_COMBOS);
  const tightness: RangeTightness =
    rangePct <= 0.07
      ? 'ultra_narrow'
      : rangePct <= 0.16
        ? 'narrow'
        : rangePct <= 0.34
          ? 'medium'
          : 'wide';

  const tightnessLabelZh =
    tightness === 'ultra_narrow'
      ? '极窄强牌范围'
      : tightness === 'narrow'
        ? '偏紧价值范围'
        : tightness === 'medium'
          ? '中等平衡范围'
          : '宽松入池范围';

  const actionSummaryZh = lastPostflopTag
    ? `${PREFLOP_TIER_LABELS_ZH[preflopTier]} + ${lastPostflopTag}`
    : PREFLOP_TIER_LABELS_ZH[preflopTier];

  const pctStr = Math.max(1, Math.round(rangePct * 100));
  const summaryZh = `${persona.name}(${persona.shortTag}·${position}) ${actionSummaryZh} · ${tightnessLabelZh} (~${pctStr}%)`;

  return {
    seat: opponentSeat,
    personaName: persona.name,
    styleId: persona.styleId,
    weights,
    comboWeights,
    rangePct,
    tightness,
    actionSummaryZh,
    summaryZh,
  };
}

/**
 * Infers ranges for all active (non-folded) opponents relative to `heroSeat`.
 */
export function inferActiveOpponentRanges(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
): WeightedHandRange[] {
  const ranges: WeightedHandRange[] = [];
  for (const p of state.players) {
    if (p.seat === heroSeat || p.folded) continue;
    const persona = personasBySeat[p.seat] ?? {
      ...DEFAULT_HERO_MODEL_PERSONA,
      seat: p.seat,
      name: p.name,
    };
    ranges.push(inferOpponentRange(state, p.seat, persona));
  }
  return ranges;
}

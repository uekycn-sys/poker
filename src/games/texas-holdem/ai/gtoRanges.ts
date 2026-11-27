import { HoldemCard, HoldemRank, PositionName } from '../engine/types';

export const RANKS_DESC = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

const RANK_TO_CHAR: Record<HoldemRank, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

export type GtoAction = 'raise' | 'call' | 'fold';
export type HandTier = 'premium' | 'strong' | 'playable' | 'speculative' | 'fold';

export interface GtoMatrixCell {
  row: number;
  col: number;
  handKey: string;
  action: GtoAction;
  frequency: number;
  tier: HandTier;
  reasonZh: string;
}

export function getHandKeyFromRowCol(row: number, col: number): string {
  const r1 = RANKS_DESC[row];
  const r2 = RANKS_DESC[col];
  if (row === col) return `${r1}${r2}`;
  if (row < col) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

export function getHandKey(holeCards: readonly HoldemCard[]): string {
  if (holeCards.length < 2) return '';
  const [c1, c2] = holeCards;
  const high = c1.rank >= c2.rank ? c1 : c2;
  const low = c1.rank >= c2.rank ? c2 : c1;
  const ch1 = RANK_TO_CHAR[high.rank];
  const ch2 = RANK_TO_CHAR[low.rank];
  if (high.rank === low.rank) return `${ch1}${ch2}`;
  return `${ch1}${ch2}${high.suit === low.suit ? 's' : 'o'}`;
}

function parseRangeTokens(spec: string): Set<string> {
  const set = new Set<string>();
  const tokens = spec
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  for (const tok of tokens) {
    // Pair+ e.g. 77+
    if (/^[AKQJT98765432]{2}\+$/.test(tok) && tok[0] === tok[1]) {
      const idx = RANKS_DESC.indexOf(tok[0] as (typeof RANKS_DESC)[number]);
      for (let i = idx; i >= 0; i--) {
        set.add(`${RANKS_DESC[i]}${RANKS_DESC[i]}`);
      }
      continue;
    }
    // Pair range e.g. JJ-77
    if (/^[AKQJT98765432]{2}-[AKQJT98765432]{2}$/.test(tok)) {
      const [a, b] = tok.split('-');
      const i1 = RANKS_DESC.indexOf(a[0] as (typeof RANKS_DESC)[number]);
      const i2 = RANKS_DESC.indexOf(b[0] as (typeof RANKS_DESC)[number]);
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      for (let i = lo; i <= hi; i++) {
        set.add(`${RANKS_DESC[i]}${RANKS_DESC[i]}`);
      }
      continue;
    }
    // Suited/Offsuit+ e.g. ATs+ or KQo+
    if (/^[AKQJT98765432]{2}[so]\+$/.test(tok)) {
      const high = tok[0];
      const low = tok[1];
      const suffix = tok[2];
      const hiIdx = RANKS_DESC.indexOf(high as (typeof RANKS_DESC)[number]);
      const loIdx = RANKS_DESC.indexOf(low as (typeof RANKS_DESC)[number]);
      for (let i = loIdx; i > hiIdx; i--) {
        set.add(`${high}${RANKS_DESC[i]}${suffix}`);
      }
      continue;
    }
    // Range e.g. A5s-A2s or KTs-K8s
    if (/^[AKQJT98765432]{2}[so]-[AKQJT98765432]{2}[so]$/.test(tok)) {
      const [left, right] = tok.split('-');
      const high = left[0];
      const suffix = left[2];
      const i1 = RANKS_DESC.indexOf(left[1] as (typeof RANKS_DESC)[number]);
      const i2 = RANKS_DESC.indexOf(right[1] as (typeof RANKS_DESC)[number]);
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      for (let i = lo; i <= hi; i++) {
        set.add(`${high}${RANKS_DESC[i]}${suffix}`);
      }
      continue;
    }
    set.add(tok);
  }
  return set;
}

const PREMIUM_HANDS = parseRangeTokens('JJ+, AKs, AQs, KQs, AKo');
const STRONG_HANDS = parseRangeTokens('TT-88, AJs, ATs, KJs, QJs, JTs, AQo, AJo, KQo');

const RFI_RAISE: Record<PositionName, Set<string>> = {
  UTG: parseRangeTokens('77+, A9s+, A5s-A4s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo'),
  MP: parseRangeTokens('66+, A7s+, A5s-A3s, K9s+, QTs+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo'),
  CO: parseRangeTokens('44+, A2s+, K8s+, Q9s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo'),
  BTN: parseRangeTokens(
    '22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s, 43s, A5o+, A4o, A3o, A2o, K8o+, Q9o+, J9o+, T9o, 98o',
  ),
  SB: parseRangeTokens('22+, A2s+, K5s+, Q7s+, J7s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A8o+, KTo+, QTo+, JTo'),
  BB: parseRangeTokens('88+, ATs+, A5s, KJs+, QJs, JTs, AJo+, KQo'),
};

const RFI_CALL: Record<PositionName, Set<string>> = {
  UTG: new Set(),
  MP: new Set(),
  CO: new Set(),
  BTN: new Set(),
  SB: parseRangeTokens('K4s-K2s, Q6s-Q4s, J6s, T7s, 43s, A7o-A5o, K9o, Q9o, J9o, T9o'),
  BB: parseRangeTokens(
    '77-22, A9s-A2s, KTs-K2s, QTs-Q2s, J9s-J4s, T9s-T5s, 98s-95s, 87s-85s, 76s-74s, 65s-64s, 54s, 43s, ATo-A2o, KJo-K7o, QJo-Q8o, JTo-J8o, T9o-T8o, 98o, 87o',
  ),
};

const VS_RAISE_3BET: Record<PositionName, Set<string>> = {
  UTG: parseRangeTokens('QQ+, AKs, AKo, AQs'),
  MP: parseRangeTokens('QQ+, AKs, AQs, A5s, KQs, AKo'),
  CO: parseRangeTokens('JJ+, AKs, AQs, A5s-A4s, KQs, AKo, AQo'),
  BTN: parseRangeTokens('TT+, AKs, AQs, AJs, A5s-A4s, KQs, KJs, QJs, AKo, AQo'),
  SB: parseRangeTokens('TT+, AKs, AQs, AJs, A5s-A4s, KQs, KJs, QJs, JTs, AKo, AQo'),
  BB: parseRangeTokens('JJ+, AKs, AQs, A5s-A3s, KQs, K5s, Q9s, J9s, 76s, 65s, AKo, AQo'),
};

const VS_RAISE_CALL: Record<PositionName, Set<string>> = {
  UTG: parseRangeTokens('TT-77, AJs, ATs, KJs, QJs, JTs, AQo'),
  MP: parseRangeTokens('JJ-66, AJs, ATs, KJs, KTs, QJs, QTs, JTs, T9s, 98s, AQo, AJo'),
  CO: parseRangeTokens('TT-55, AJs-A9s, A3s, KJs-K9s, QJs-Q9s, JTs-J9s, T9s, 98s, 87s, 76s, AJo, KQo'),
  BTN: parseRangeTokens(
    '99-22, ATs-A2s, KTs-K8s, QTs-Q8s, JTs-J8s, T9s-T8s, 98s-97s, 87s-86s, 76s, 65s, 54s, AJo, ATo, KQo, KJo, QJo',
  ),
  SB: parseRangeTokens('99-55, ATs-A8s, KTs-K9s, QTs, JTs, T9s, 98s, 87s, AJo, KQo'),
  BB: parseRangeTokens(
    'TT-22, AJs-A2s, KJs-K2s, QJs-Q4s, JTs-J6s, T9s-T6s, 98s-96s, 87s-85s, 75s, 64s, 54s, 43s, AJo-A8o, A5o, KQo-K9o, QJo-Q9o, JTo-J9o, T9o, 98o',
  ),
};

function classifyTier(handKey: string, action: GtoAction): HandTier {
  if (action === 'fold') return 'fold';
  if (PREMIUM_HANDS.has(handKey)) return 'premium';
  if (STRONG_HANDS.has(handKey)) return 'strong';
  return action === 'raise' ? 'playable' : 'speculative';
}

function buildReasonZh(
  handKey: string,
  position: PositionName,
  facingRaise: boolean,
  action: GtoAction,
): string {
  if (!facingRaise) {
    if (action === 'raise') {
      return `${position} 位置使用 ${handKey} 属于 GTO 标准率先加注范围（Open Raise），兼具牌力与位置主动权。`;
    }
    if (action === 'call') {
      return position === 'BB'
        ? `大盲位无人加注时用 ${handKey} 过牌看翻牌，保留翻后可玩性与隐蔽暗牌。`
        : `小盲位面对前位平跟/盲注战时，${handKey} 适合低成本补齐观望翻牌。`;
    }
    return `${position} 位置起手 ${handKey} 期望收益为负（-EV），GTO 建议直接弃牌避免落后范围。`;
  }

  if (action === 'raise') {
    return `在 ${position} 位面对加注，${handKey} 属于 GTO 价值或极化 3-Bet 反击范围，可争夺死钱并建立大底池优势。`;
  }
  if (action === 'call') {
    return `在 ${position} 位面对加注，${handKey} 具有良好的底池赔率与同花/连张隐含赔率，建议平跟看翻牌。`;
  }
  return `在 ${position} 位面对前位加注，${handKey} 易被统治（Dominated），GTO 推荐弃牌止损。`;
}

/**
 * Generates a full 13x13 GTO preflop range heatmap matrix for the given position and scenario.
 */
export function getPreflopRangeMatrix(
  position: PositionName,
  facingRaise: boolean,
): GtoMatrixCell[][] {
  const raiseSet = facingRaise ? VS_RAISE_3BET[position] : RFI_RAISE[position];
  const callSet = facingRaise ? VS_RAISE_CALL[position] : RFI_CALL[position];

  const matrix: GtoMatrixCell[][] = [];
  for (let row = 0; row < 13; row++) {
    const rowCells: GtoMatrixCell[] = [];
    for (let col = 0; col < 13; col++) {
      const handKey = getHandKeyFromRowCol(row, col);
      let action: GtoAction = 'fold';
      let frequency = 100;

      if (raiseSet.has(handKey)) {
        action = 'raise';
        frequency = PREMIUM_HANDS.has(handKey) ? 100 : 85;
      } else if (callSet.has(handKey)) {
        action = 'call';
        frequency = 80;
      }

      rowCells.push({
        row,
        col,
        handKey,
        action,
        frequency,
        tier: classifyTier(handKey, action),
        reasonZh: buildReasonZh(handKey, position, facingRaise, action),
      });
    }
    matrix.push(rowCells);
  }
  return matrix;
}

export function lookupPreflopGto(
  holeCards: readonly HoldemCard[],
  position: PositionName,
  facingRaise: boolean,
): GtoMatrixCell {
  const key = getHandKey(holeCards);
  const matrix = getPreflopRangeMatrix(position, facingRaise);
  for (const row of matrix) {
    for (const cell of row) {
      if (cell.handKey === key) return cell;
    }
  }
  return matrix[12][0];
}

/**
 * Computes a normalized 0..1 preflop strength score for any two hole cards (Chen-inspired).
 */
export function scorePreflopStrength(holeCards: readonly HoldemCard[]): number {
  if (holeCards.length < 2) return 0;
  const [a, b] = holeCards;
  const high = Math.max(a.rank, b.rank);
  const low = Math.min(a.rank, b.rank);
  const isPair = high === low;
  const suited = a.suit === b.suit;
  const gap = high - low;

  let base =
    high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;

  if (isPair) {
    base = Math.max(5, base * 2);
  } else {
    if (suited) base += 2;
    if (gap === 1) base += 1;
    else if (gap === 2) base -= 1;
    else if (gap === 3) base -= 2;
    else if (gap === 4) base -= 4;
    else if (gap >= 5) base -= 5;
    if (high < 12 && gap <= 1) base += 1;
  }

  return Math.max(0.05, Math.min(1, base / 20));
}

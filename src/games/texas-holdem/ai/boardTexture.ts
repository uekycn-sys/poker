import { HandState, HoldemCard, HoldemRank, PositionName } from '../engine/types';

export type BoardWetness = 'dry' | 'semi_wet' | 'wet';
export type FlushBoardStatus = 'rainbow' | 'two_tone' | 'monotone' | 'four_flush';
export type HighCardStructure = 'none' | 'ace_high' | 'broadway' | 'medium' | 'low';

export interface BoardTexture {
  cardCount: number;
  flushStatus: FlushBoardStatus;
  maxSuitCount: number;
  /** True when >= 3 cards share a suit on board (同花面) */
  hasFlushOnBoard: boolean;
  /** True when >= 2 cards share a suit (有同花听牌可能) */
  hasFlushDrawBoard: boolean;
  /** True when two distinct suits each appear >= 2 times on turn/river (双同花听牌面) */
  isDoubleFlushDraw: boolean;
  /** True when >= 3 distinct board ranks fit in a 5-rank straight window (顺子连接面) */
  isStraightConnected: boolean;
  /** True when >= 3 ranks are tightly connected (<= 4 span) or >= 4 cards in 5-rank window */
  isHighlyConnected: boolean;
  /** True when board has at least one pair (公对面) */
  isPaired: boolean;
  /** True when board has trips or quads (三条/四条面) */
  isTripsOrQuads: boolean;
  /** True when board has two separate pairs */
  isDoublePaired: boolean;
  highRank: HoldemRank | 0;
  broadwayCount: number;
  hasAce: boolean;
  highCardStructure: HighCardStructure;
  wetness: BoardWetness;
  tagsZh: string[];
  summaryZh: string;
}

export interface PostflopPositionInfo {
  isIp: boolean;
  isOop: boolean;
  actingOrderIdx: number;
  totalNonFolded: number;
  position: PositionName;
  positionLabelZh: string;
}

const RANK_LABEL: Record<number, string> = {
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

/**
 * Analyzes postflop community cards for flush draws, straight connectivity,
 * paired/trips structure, high-card profile, and overall dry/wet classification.
 */
export function analyzeBoardTexture(communityCards: readonly HoldemCard[]): BoardTexture {
  if (communityCards.length === 0) {
    return {
      cardCount: 0,
      flushStatus: 'rainbow',
      maxSuitCount: 0,
      hasFlushOnBoard: false,
      hasFlushDrawBoard: false,
      isDoubleFlushDraw: false,
      isStraightConnected: false,
      isHighlyConnected: false,
      isPaired: false,
      isTripsOrQuads: false,
      isDoublePaired: false,
      highRank: 0,
      broadwayCount: 0,
      hasAce: false,
      highCardStructure: 'none',
      wetness: 'dry',
      tagsZh: [],
      summaryZh: '翻前阶段（尚无公共牌）',
    };
  }

  const suitCounts = [0, 0, 0, 0];
  const rankCounts = new Map<number, number>();
  let rankMask = 0;
  let highRank: HoldemRank | 0 = 0;
  let broadwayCount = 0;
  let hasAce = false;

  for (const card of communityCards) {
    const suitIdx = (card.code / 13) | 0;
    suitCounts[suitIdx]++;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    rankMask |= 1 << (card.rank - 2);
    if (card.rank > highRank) highRank = card.rank;
    if (card.rank >= 10) broadwayCount++;
    if (card.rank === 14) hasAce = true;
  }

  const maxSuitCount = Math.max(...suitCounts);
  const twoSuitGroups = suitCounts.filter((cnt) => cnt >= 2).length;
  const isDoubleFlushDraw = twoSuitGroups >= 2;
  const hasFlushOnBoard = maxSuitCount >= 3;
  const hasFlushDrawBoard = maxSuitCount >= 2;

  const flushStatus: FlushBoardStatus =
    maxSuitCount >= 4
      ? 'four_flush'
      : maxSuitCount === 3
        ? 'monotone'
        : maxSuitCount === 2
          ? 'two_tone'
          : 'rainbow';

  let pairCount = 0;
  let maxRankFreq = 0;
  for (const count of rankCounts.values()) {
    if (count >= 2) pairCount++;
    if (count > maxRankFreq) maxRankFreq = count;
  }
  const isPaired = maxRankFreq >= 2;
  const isTripsOrQuads = maxRankFreq >= 3;
  const isDoublePaired = pairCount >= 2;

  // Straight connectivity via 5-rank and 4-rank sliding windows (including wheel Ace)
  let maxIn5Window = 0;
  let maxIn4Window = 0;
  // Standard windows 2..6 up to T..A
  for (let lowBit = 0; lowBit <= 8; lowBit++) {
    let cnt5 = 0;
    for (let offset = 0; offset < 5; offset++) {
      if ((rankMask & (1 << (lowBit + offset))) !== 0) cnt5++;
    }
    if (cnt5 > maxIn5Window) maxIn5Window = cnt5;
  }
  // Wheel 5-rank window: A,2,3,4,5 -> bit 12 + bits 0..3
  {
    let wheelCnt = (rankMask & (1 << 12)) !== 0 ? 1 : 0;
    for (let b = 0; b < 4; b++) {
      if ((rankMask & (1 << b)) !== 0) wheelCnt++;
    }
    if (wheelCnt > maxIn5Window) maxIn5Window = wheelCnt;
  }
  // Tight 4-rank windows
  for (let lowBit = 0; lowBit <= 9; lowBit++) {
    let cnt4 = 0;
    for (let offset = 0; offset < 4; offset++) {
      if ((rankMask & (1 << (lowBit + offset))) !== 0) cnt4++;
    }
    if (cnt4 > maxIn4Window) maxIn4Window = cnt4;
  }
  {
    let wheel4 = (rankMask & (1 << 12)) !== 0 ? 1 : 0;
    for (let b = 0; b < 3; b++) {
      if ((rankMask & (1 << b)) !== 0) wheel4++;
    }
    if (wheel4 > maxIn4Window) maxIn4Window = wheel4;
  }

  const isStraightConnected = maxIn5Window >= 3;
  const isHighlyConnected = maxIn4Window >= 3 || maxIn5Window >= 4;

  const highCardStructure: HighCardStructure = hasAce
    ? 'ace_high'
    : highRank >= 12 || broadwayCount >= 2
      ? 'broadway'
      : highRank >= 9
        ? 'medium'
        : 'low';

  let wetnessScore = 0;
  if (flushStatus === 'monotone' || flushStatus === 'four_flush') wetnessScore += 3;
  else if (isDoubleFlushDraw) wetnessScore += 2.5;
  else if (flushStatus === 'two_tone') wetnessScore += 1.5;

  if (isHighlyConnected) wetnessScore += 2.5;
  else if (isStraightConnected) wetnessScore += 1.5;

  if (broadwayCount >= 2 && !isPaired) wetnessScore += 0.5;
  if (isPaired) wetnessScore -= 1;

  const wetness: BoardWetness =
    wetnessScore >= 3 ? 'wet' : wetnessScore >= 1.5 ? 'semi_wet' : 'dry';

  const tagsZh: string[] = [];
  if (wetness === 'dry') tagsZh.push('干燥面');
  else if (wetness === 'semi_wet') tagsZh.push('半湿润面');
  else tagsZh.push('湿润面');

  if (flushStatus === 'four_flush') tagsZh.push('四同花危面');
  else if (flushStatus === 'monotone') tagsZh.push('单色同花面');
  else if (isDoubleFlushDraw) tagsZh.push('双同花听牌面');
  else if (flushStatus === 'two_tone') tagsZh.push('双花听牌面');
  else tagsZh.push('彩虹面');

  if (isStraightConnected) tagsZh.push('顺子连接面');
  if (isTripsOrQuads) tagsZh.push('三条公牌面');
  else if (isDoublePaired) tagsZh.push('双公对面');
  else if (isPaired) tagsZh.push('公对面');

  if (highCardStructure === 'ace_high') tagsZh.push('A高结构');
  else if (highCardStructure === 'broadway') tagsZh.push(`${RANK_LABEL[highRank]}高大牌面`);
  else if (highCardStructure === 'medium') tagsZh.push(`${RANK_LABEL[highRank]}高中张面`);
  else tagsZh.push(`${RANK_LABEL[highRank]}高低牌面`);

  const summaryZh =
    wetness === 'dry'
      ? `${tagsZh.join(' · ')}（听牌稀少，范围优势方适合小额高频施压）`
      : wetness === 'wet'
        ? `${tagsZh.join(' · ')}（听牌密集，需用大额两极化尺度保护成牌）`
        : `${tagsZh.join(' · ')}（存在一定听牌与转牌动态变化）`;

  return {
    cardCount: communityCards.length,
    flushStatus,
    maxSuitCount,
    hasFlushOnBoard,
    hasFlushDrawBoard,
    isDoubleFlushDraw,
    isStraightConnected,
    isHighlyConnected,
    isPaired,
    isTripsOrQuads,
    isDoublePaired,
    highRank,
    broadwayCount,
    hasAce,
    highCardStructure,
    wetness,
    tagsZh,
    summaryZh,
  };
}

/**
 * Determines whether `seat` is In Position (IP) or Out of Position (OOP) postflop
 * relative to all currently non-folded players.
 */
export function getPostflopPositionInfo(
  state: HandState,
  seat: number,
): PostflopPositionInfo {
  const player = state.players.find((p) => p.seat === seat);
  const position = player?.position ?? 'BB';

  const sorted = [...state.players].sort((a, b) => a.seat - b.seat);
  let startIdx = sorted.findIndex((p) => p.seat > state.dealerSeat);
  if (startIdx === -1) startIdx = 0;

  const nonFoldedClockwise = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[(startIdx + i) % sorted.length];
    if (!p.folded) {
      nonFoldedClockwise.push(p);
    }
  }

  const actingOrderIdx = Math.max(
    0,
    nonFoldedClockwise.findIndex((p) => p.seat === seat),
  );
  const totalNonFolded = nonFoldedClockwise.length;
  // Last non-folded player clockwise from SB (i.e. closest to/on BTN) acts last = IP
  const isIp = totalNonFolded <= 1 || actingOrderIdx === totalNonFolded - 1;
  const isOop = !isIp;

  return {
    isIp,
    isOop,
    actingOrderIdx,
    totalNonFolded,
    position,
    positionLabelZh: isIp ? '有利位置 (IP)' : '不利位置 (OOP)',
  };
}

import { AvatarStyleId } from '../../../shared/store/playerStore';
import { ActionRecord, HandState } from '../engine/types';

export type AiStyleId = 'TAG' | 'LAG' | 'CALLING_STATION' | 'NIT' | 'GTO_PRO';

export interface AiPersona {
  seat: number;
  id: string;
  name: string;
  styleId: AiStyleId;
  styleLabel: string;
  shortTag: string;
  avatarId: AvatarStyleId;
  /** Baseline preflop looseness shift (-0.25..+0.25) */
  vpipBias: number;
  /** Baseline preflop aggression shift (-0.25..+0.25) */
  pfrBias: number;
  /** 3-bet probability multiplier */
  threeBetFreq: number;
  /** Postflop C-Bet tendency */
  cbetFreq: number;
  /** Semi-bluff raise/bet frequency with draws */
  semiBluffFreq: number;
  /** Pure bluff frequency with air */
  pureBluffFreq: number;
  /** Equity threshold adjustment when calling bets (negative = calls much lighter!) */
  callThresholdDelta: number;
  /** Thin value threshold on river/turn */
  thinValueThreshold: number;
  /** How often opponent folds to aggression */
  foldToBetModifier: number;
  bioZh: string;
  exploitTipZh: string;
}

export const AI_PERSONAS: AiPersona[] = [
  {
    seat: 1,
    id: 'ai-tag',
    name: '维克多',
    styleId: 'TAG',
    styleLabel: '紧凶鲨鱼 (TAG)',
    shortTag: '紧凶 TAG',
    avatarId: 'spade',
    vpipBias: -0.02,
    pfrBias: 0.06,
    threeBetFreq: 0.58,
    cbetFreq: 0.72,
    semiBluffFreq: 0.55,
    pureBluffFreq: 0.14,
    callThresholdDelta: 0.02,
    thinValueThreshold: 0.62,
    foldToBetModifier: 0.02,
    bioZh: '严守位置与翻前范围，价值下注尺度和时机精准，极少在劣势底池恋战。',
    exploitTipZh: '反制思路：尊重他的大额加注，多利用位置对其转牌/河牌过牌施压。',
  },
  {
    seat: 2,
    id: 'ai-lag',
    name: '莉莉',
    styleId: 'LAG',
    styleLabel: '松凶海盗 (LAG)',
    shortTag: '松凶 LAG',
    avatarId: 'phoenix',
    vpipBias: 0.16,
    pfrBias: 0.2,
    threeBetFreq: 0.85,
    cbetFreq: 0.86,
    semiBluffFreq: 0.82,
    pureBluffFreq: 0.36,
    callThresholdDelta: -0.04,
    thinValueThreshold: 0.55,
    foldToBetModifier: -0.05,
    bioZh: '入池率与翻前加注率极高，热衷位置 3-Bet、高频持续下注与双枪半诈唬。',
    exploitTipZh: '反制思路：收紧开池但用中等强牌抓诈唬（Bluff-Catch），强牌可设陷阱过牌加注。',
  },
  {
    seat: 3,
    id: 'ai-station',
    name: '巴勃',
    styleId: 'CALLING_STATION',
    styleLabel: '铁壁跟注站',
    shortTag: '跟注站',
    avatarId: 'diamond',
    vpipBias: 0.24,
    pfrBias: -0.18,
    threeBetFreq: 0.1,
    cbetFreq: 0.28,
    semiBluffFreq: 0.12,
    pureBluffFreq: 0.04,
    callThresholdDelta: -0.19,
    thinValueThreshold: 0.52,
    foldToBetModifier: -0.25,
    bioZh: '几乎不弃掉任何对子或听牌，很少主动加注，最容易被纯诈唬送筹码。',
    exploitTipZh: '剥削金律：绝对不要对他诈唬！拿到顶对/中对时大胆做三街薄价值下注（Thin Value）。',
  },
  {
    seat: 4,
    id: 'ai-nit',
    name: '格雷',
    styleId: 'NIT',
    styleLabel: '花岗岩 (Nit)',
    shortTag: '岩石 Nit',
    avatarId: 'crown',
    vpipBias: -0.2,
    pfrBias: -0.05,
    threeBetFreq: 0.22,
    cbetFreq: 0.58,
    semiBluffFreq: 0.2,
    pureBluffFreq: 0.03,
    callThresholdDelta: 0.12,
    thinValueThreshold: 0.72,
    foldToBetModifier: 0.2,
    bioZh: '只玩超强起手牌，翻前几乎不偷盲，一旦在翻后主动加注往往代表暗三或以上怪物牌。',
    exploitTipZh: '剥削金律：疯狂偷取他的盲注；一旦他主动加注或全下，果断弃掉边缘顶对！',
  },
  {
    seat: 5,
    id: 'ai-gto',
    name: '艾琳',
    styleId: 'GTO_PRO',
    styleLabel: '均衡大师 (GTO)',
    shortTag: '均衡 GTO',
    avatarId: 'crown',
    vpipBias: 0.0,
    pfrBias: 0.02,
    threeBetFreq: 0.62,
    cbetFreq: 0.68,
    semiBluffFreq: 0.64,
    pureBluffFreq: 0.18,
    callThresholdDelta: 0.0,
    thinValueThreshold: 0.6,
    foldToBetModifier: 0.0,
    bioZh: '严格保持价值与诈唬频率平衡的职业教练模型，是检验你标准 GTO 功底的试金石。',
    exploitTipZh: '反制思路：保持平衡防守频率（MDF），不要暴露明显弃牌率或跟注率漏洞。',
  },
];

export const AI_PERSONAS_BY_SEAT: Record<number, AiPersona> = Object.fromEntries(
  AI_PERSONAS.map((p) => [p.seat, p]),
);

export interface PlayerHudStats {
  seat: number;
  handsPlayed: number;
  vpipHands: number;
  pfrHands: number;
  aggressiveActions: number;
  passiveCalls: number;
}

export function createInitialHudStats(seats: readonly number[]): Record<number, PlayerHudStats> {
  const map: Record<number, PlayerHudStats> = {};
  for (const seat of seats) {
    map[seat] = {
      seat,
      handsPlayed: 0,
      vpipHands: 0,
      pfrHands: 0,
      aggressiveActions: 0,
      passiveCalls: 0,
    };
  }
  return map;
}

export function getVpipPct(stats: PlayerHudStats | undefined): number {
  if (!stats || stats.handsPlayed === 0) return 0;
  return Math.round((stats.vpipHands / stats.handsPlayed) * 100);
}

export function getPfrPct(stats: PlayerHudStats | undefined): number {
  if (!stats || stats.handsPlayed === 0) return 0;
  return Math.round((stats.pfrHands / stats.handsPlayed) * 100);
}

/**
 * Updates session-wide HUD stats (VPIP / PFR / AF) once a hand completes (or from its action log).
 */
export function accumulateHandHudStats(
  prev: Record<number, PlayerHudStats>,
  hand: HandState,
): Record<number, PlayerHudStats> {
  const next: Record<number, PlayerHudStats> = { ...prev };
  const vpipSeats = new Set<number>();
  const pfrSeats = new Set<number>();
  const aggCount: Record<number, number> = {};
  const callCount: Record<number, number> = {};

  for (const act of hand.actions as ActionRecord[]) {
    if (act.street === 'preflop') {
      if (act.action.type === 'call' || act.action.type === 'raise' || act.action.type === 'all_in') {
        vpipSeats.add(act.seat);
      }
      if (act.action.type === 'raise' || (act.action.type === 'all_in' && act.amountAdded > 0)) {
        pfrSeats.add(act.seat);
      }
    }
    if (act.action.type === 'raise' || act.action.type === 'all_in') {
      aggCount[act.seat] = (aggCount[act.seat] ?? 0) + 1;
    } else if (act.action.type === 'call') {
      callCount[act.seat] = (callCount[act.seat] ?? 0) + 1;
    }
  }

  for (const p of hand.players) {
    const cur = next[p.seat] ?? {
      seat: p.seat,
      handsPlayed: 0,
      vpipHands: 0,
      pfrHands: 0,
      aggressiveActions: 0,
      passiveCalls: 0,
    };
    next[p.seat] = {
      seat: p.seat,
      handsPlayed: cur.handsPlayed + 1,
      vpipHands: cur.vpipHands + (vpipSeats.has(p.seat) ? 1 : 0),
      pfrHands: cur.pfrHands + (pfrSeats.has(p.seat) ? 1 : 0),
      aggressiveActions: cur.aggressiveActions + (aggCount[p.seat] ?? 0),
      passiveCalls: cur.passiveCalls + (callCount[p.seat] ?? 0),
    };
  }

  return next;
}

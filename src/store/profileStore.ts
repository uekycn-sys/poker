import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIDifficulty, Card, GameState, MatchSettlement, MoveRecord, Seat } from '../engine';
import { soundEngine } from '../audio/soundEngine';
import { speechEngine } from '../audio/speechEngine';

export interface RankTier {
  name: string;
  badgeColor: string;
  minPoints: number;
  nextPoints: number | null;
  progress: number;
}

const RANK_TIERS: Array<{ name: string; minPoints: number; badgeColor: string }> = [
  { name: '青铜', minPoints: 0, badgeColor: '#cd7f32' },
  { name: '白银', minPoints: 200, badgeColor: '#cbd5e1' },
  { name: '黄金', minPoints: 500, badgeColor: '#facc15' },
  { name: '铂金', minPoints: 900, badgeColor: '#38bdf8' },
  { name: '钻石', minPoints: 1400, badgeColor: '#818cf8' },
  { name: '大师', minPoints: 2000, badgeColor: '#f97316' },
  { name: '牌圣', minPoints: 3000, badgeColor: '#f43f5e' },
];

export function getRankTier(rankPoints: number): RankTier {
  let idx = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rankPoints >= RANK_TIERS[i].minPoints) {
      idx = i;
      break;
    }
  }
  const current = RANK_TIERS[idx];
  const next = RANK_TIERS[idx + 1] ?? null;
  const progress = next
    ? Math.min(
        100,
        Math.max(0, Math.round(((rankPoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100)),
      )
    : 100;

  return {
    name: current.name,
    badgeColor: current.badgeColor,
    minPoints: current.minPoints,
    nextPoints: next ? next.minPoints : null,
    progress,
  };
}

export interface SavedMatchRecord {
  id: string;
  playedAt: number;
  difficulty: AIDifficulty;
  baseScore: number;
  landlordSeat: Seat;
  settlement: MatchSettlement;
  moveHistory: MoveRecord[];
  initialHands: [Card[], Card[], Card[]];
  bottomCards: Card[];
}

export type SortMode = 'rank' | 'pattern';
export type CardCounterMode = 'assist' | 'advanced' | 'blind' | 'off';

interface ProfileState {
  beans: number;
  rankPoints: number;
  totalMatches: number;
  wins: number;
  landlordMatches: number;
  landlordWins: number;
  springCount: number;
  antiSpringCount: number;
  lastAidDate: string | null;
  dailyAidCount: number;
  pendingAidAnimation: boolean;
  lastAidGrant: number;
  sfxEnabled: boolean;
  voiceEnabled: boolean;
  largeCardFont: boolean;
  sortMode: SortMode;
  cardCounterMode: CardCounterMode;
  difficulty: AIDifficulty;
  baseScore: number;
  recentMatches: SavedMatchRecord[];
  clearedPuzzles: string[];

  recordMatchResult: (state: GameState, difficulty: AIDifficulty, initialHands?: [Card[], Card[], Card[]]) => void;
  checkBankruptcyAid: () => boolean;
  dismissAidAnimation: () => void;
  addBonusBeans: (amount: number) => void;
  toggleSfx: () => void;
  toggleVoice: () => void;
  toggleLargeCardFont: () => void;
  toggleSortMode: () => void;
  setCardCounterMode: (mode: CardCounterMode) => void;
  setDifficulty: (difficulty: AIDifficulty) => void;
  setBaseScore: (baseScore: number) => void;
  markPuzzleCleared: (puzzleId: string) => void;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      beans: 10000,
      rankPoints: 100,
      totalMatches: 0,
      wins: 0,
      landlordMatches: 0,
      landlordWins: 0,
      springCount: 0,
      antiSpringCount: 0,
      lastAidDate: null,
      dailyAidCount: 0,
      pendingAidAnimation: false,
      lastAidGrant: 0,
      sfxEnabled: true,
      voiceEnabled: true,
      largeCardFont: false,
      sortMode: 'rank',
      cardCounterMode: 'assist',
      difficulty: 'intermediate',
      baseScore: 100,
      recentMatches: [],
      clearedPuzzles: [],

      recordMatchResult: (state, difficulty, initialHands) => {
        const settlement = state.settlement;
        if (!settlement || state.landlordSeat === null) return;

        const isLandlord = state.landlordSeat === 0;
        const humanWon =
          (isLandlord && settlement.winnerRole === 'landlord') ||
          (!isLandlord && settlement.winnerRole === 'farmer');

        const deltaBeans = settlement.beanDeltas[0];
        const pointDelta = humanWon ? (isLandlord ? 45 : 35) : -20;

        const savedRecord: SavedMatchRecord = {
          id: `match-${Date.now()}`,
          playedAt: Date.now(),
          difficulty,
          baseScore: state.baseScore,
          landlordSeat: state.landlordSeat,
          settlement,
          moveHistory: state.moveHistory,
          initialHands: initialHands ?? state.moveHistory[0]?.handsSnapshot ?? state.hands,
          bottomCards: state.bottomCards,
        };

        set((prev) => {
          const nextBeans = Math.max(0, prev.beans + deltaBeans);
          return {
            beans: nextBeans,
            rankPoints: Math.max(0, prev.rankPoints + pointDelta),
            totalMatches: prev.totalMatches + 1,
            wins: prev.wins + (humanWon ? 1 : 0),
            landlordMatches: prev.landlordMatches + (isLandlord ? 1 : 0),
            landlordWins: prev.landlordWins + (isLandlord && humanWon ? 1 : 0),
            springCount: prev.springCount + (settlement.isSpring ? 1 : 0),
            antiSpringCount: prev.antiSpringCount + (settlement.isAntiSpring ? 1 : 0),
            recentMatches: [savedRecord, ...prev.recentMatches].slice(0, 10),
          };
        });

        get().checkBankruptcyAid();
      },

      checkBankruptcyAid: () => {
        const current = get();
        if (current.beans >= 1000) return false;
        const today = todayKey();
        const grant = 3000;
        set({
          beans: current.beans + grant,
          lastAidDate: today,
          dailyAidCount: current.lastAidDate === today ? current.dailyAidCount + 1 : 1,
          pendingAidAnimation: true,
          lastAidGrant: grant,
        });
        soundEngine.playBeansAid();
        return true;
      },

      dismissAidAnimation: () => set({ pendingAidAnimation: false }),

      addBonusBeans: (amount) =>
        set((prev) => ({
          beans: Math.max(0, prev.beans + amount),
        })),

      toggleSfx: () =>
        set((prev) => {
          const next = !prev.sfxEnabled;
          soundEngine.setEnabled(next);
          return { sfxEnabled: next };
        }),

      toggleVoice: () =>
        set((prev) => {
          const next = !prev.voiceEnabled;
          speechEngine.setEnabled(next);
          return { voiceEnabled: next };
        }),

      toggleLargeCardFont: () => set((prev) => ({ largeCardFont: !prev.largeCardFont })),

      toggleSortMode: () =>
        set((prev) => ({ sortMode: prev.sortMode === 'rank' ? 'pattern' : 'rank' })),

      setCardCounterMode: (cardCounterMode) => set({ cardCounterMode }),

      setDifficulty: (difficulty) => set({ difficulty }),

      setBaseScore: (baseScore) => set({ baseScore }),

      markPuzzleCleared: (puzzleId) =>
        set((prev) =>
          prev.clearedPuzzles.includes(puzzleId)
            ? prev
            : { clearedPuzzles: [...prev.clearedPuzzles, puzzleId] },
        ),
    }),
    {
      name: 'happy-doudizhu-profile-v1',
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundEngine.setEnabled(state.sfxEnabled);
          speechEngine.setEnabled(state.voiceEnabled);
        }
      },
    },
  ),
);

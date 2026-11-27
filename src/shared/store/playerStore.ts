import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
        Math.max(
          0,
          Math.round(((rankPoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100),
        ),
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

export type AvatarStyleId = 'crown' | 'spade' | 'diamond' | 'phoenix';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: 'trophy' | 'flame' | 'coins' | 'crown' | 'sparkles' | 'puzzle';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_win',
    title: '初露锋芒',
    description: '在任意棋牌玩法中赢得第 1 场对局',
    icon: 'trophy',
  },
  {
    id: 'win_streak_3',
    title: '势如破竹',
    description: '在牌桌上达成 3 连胜',
    icon: 'flame',
  },
  {
    id: 'rich_player',
    title: '俱乐部贵宾',
    description: '通用金币/筹码余额达到 20,000',
    icon: 'coins',
  },
  {
    id: 'master_rank',
    title: '大师殿堂',
    description: '俱乐部段位积分达到 2,000 分',
    icon: 'crown',
  },
  {
    id: 'spring_king',
    title: '春天收割机',
    description: '在斗地主中打出春天或反春大捷',
    icon: 'sparkles',
  },
  {
    id: 'puzzle_breaker',
    title: '残局破壁者',
    description: '在残局训练营破解任意一道必胜残局',
    icon: 'puzzle',
  },
];

export interface GameStatSummary {
  matches: number;
  wins: number;
  netChips: number;
}

export interface ChipDeltaEvent {
  amount: number;
  reason?: string;
  timestamp: number;
}

export interface RecordGameResultPayload {
  gameId: string;
  won: boolean;
  chipDelta: number;
  rankPointDelta: number;
  extraAchievements?: string[];
}

export interface PlayerStoreState {
  nickname: string;
  avatarId: AvatarStyleId;
  chips: number;
  rankPoints: number;
  lastChipDelta: ChipDeltaEvent | null;
  lastAidDate: string | null;
  dailyAidCount: number;
  pendingAidAnimation: boolean;
  lastAidGrant: number;
  totalMatches: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  perGameStats: Record<string, GameStatSummary>;
  unlockedAchievements: string[];
  sfxEnabled: boolean;
  voiceEnabled: boolean;
  largeCardFont: boolean;

  setNickname: (nickname: string) => void;
  setAvatarId: (avatarId: AvatarStyleId) => void;
  recordGameResult: (payload: RecordGameResultPayload) => void;
  addChips: (amount: number, reason?: string) => void;
  checkBankruptcyAid: () => boolean;
  dismissAidAnimation: () => void;
  unlockAchievement: (id: string) => void;
  toggleSfx: () => void;
  toggleVoice: () => void;
  toggleLargeCardFont: () => void;
}

const STORAGE_KEY = 'poker-master-player-v1';
const LEGACY_PROFILE_KEY = 'happy-doudizhu-profile-v1';

interface LegacyProfileState {
  beans?: number;
  rankPoints?: number;
  totalMatches?: number;
  wins?: number;
  springCount?: number;
  antiSpringCount?: number;
  lastAidDate?: string | null;
  dailyAidCount?: number;
  sfxEnabled?: boolean;
  voiceEnabled?: boolean;
  largeCardFont?: boolean;
  clearedPuzzles?: string[];
}

function readLegacySeed(): Partial<PlayerStoreState> {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) {
      return {};
    }
    const raw = window.localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: LegacyProfileState };
    const s = parsed?.state;
    if (!s) return {};

    const unlocked: string[] = [];
    if ((s.wins ?? 0) >= 1) unlocked.push('first_win');
    if ((s.beans ?? 0) >= 20000) unlocked.push('rich_player');
    if ((s.rankPoints ?? 0) >= 2000) unlocked.push('master_rank');
    if ((s.springCount ?? 0) + (s.antiSpringCount ?? 0) >= 1) unlocked.push('spring_king');
    if ((s.clearedPuzzles?.length ?? 0) >= 1) unlocked.push('puzzle_breaker');

    const totalMatches = s.totalMatches ?? 0;
    const totalWins = s.wins ?? 0;

    return {
      chips: typeof s.beans === 'number' ? s.beans : 10000,
      rankPoints: typeof s.rankPoints === 'number' ? s.rankPoints : 100,
      lastAidDate: s.lastAidDate ?? null,
      dailyAidCount: s.dailyAidCount ?? 0,
      totalMatches,
      totalWins,
      perGameStats:
        totalMatches > 0
          ? {
              doudizhu: {
                matches: totalMatches,
                wins: totalWins,
                netChips: (s.beans ?? 10000) - 10000,
              },
            }
          : {},
      unlockedAchievements: unlocked,
      sfxEnabled: s.sfxEnabled ?? true,
      voiceEnabled: s.voiceEnabled ?? true,
      largeCardFont: s.largeCardFont ?? false,
    };
  } catch {
    return {};
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const legacySeed = readLegacySeed();

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      nickname: '皇家牌手',
      avatarId: 'crown',
      chips: legacySeed.chips ?? 10000,
      rankPoints: legacySeed.rankPoints ?? 100,
      lastChipDelta: null,
      lastAidDate: legacySeed.lastAidDate ?? null,
      dailyAidCount: legacySeed.dailyAidCount ?? 0,
      pendingAidAnimation: false,
      lastAidGrant: 0,
      totalMatches: legacySeed.totalMatches ?? 0,
      totalWins: legacySeed.totalWins ?? 0,
      currentStreak: 0,
      bestStreak: 0,
      perGameStats: legacySeed.perGameStats ?? {},
      unlockedAchievements: legacySeed.unlockedAchievements ?? [],
      sfxEnabled: legacySeed.sfxEnabled ?? true,
      voiceEnabled: legacySeed.voiceEnabled ?? true,
      largeCardFont: legacySeed.largeCardFont ?? false,

      setNickname: (nickname) => set({ nickname: nickname.trim() || '皇家牌手' }),

      setAvatarId: (avatarId) => set({ avatarId }),

      recordGameResult: ({ gameId, won, chipDelta, rankPointDelta, extraAchievements = [] }) => {
        set((prev) => {
          const nextChips = Math.max(0, prev.chips + chipDelta);
          const nextRankPoints = Math.max(0, prev.rankPoints + rankPointDelta);
          const nextStreak = won ? prev.currentStreak + 1 : 0;
          const nextBestStreak = Math.max(prev.bestStreak, nextStreak);
          const prevGame = prev.perGameStats[gameId] ?? { matches: 0, wins: 0, netChips: 0 };

          const unlockedSet = new Set(prev.unlockedAchievements);
          if (won) unlockedSet.add('first_win');
          if (nextStreak >= 3) unlockedSet.add('win_streak_3');
          if (nextChips >= 20000) unlockedSet.add('rich_player');
          if (nextRankPoints >= 2000) unlockedSet.add('master_rank');
          for (const ach of extraAchievements) {
            unlockedSet.add(ach);
          }

          return {
            chips: nextChips,
            rankPoints: nextRankPoints,
            lastChipDelta: {
              amount: chipDelta,
              reason: won ? '对局胜利结算' : '对局结算',
              timestamp: Date.now(),
            },
            totalMatches: prev.totalMatches + 1,
            totalWins: prev.totalWins + (won ? 1 : 0),
            currentStreak: nextStreak,
            bestStreak: nextBestStreak,
            perGameStats: {
              ...prev.perGameStats,
              [gameId]: {
                matches: prevGame.matches + 1,
                wins: prevGame.wins + (won ? 1 : 0),
                netChips: prevGame.netChips + chipDelta,
              },
            },
            unlockedAchievements: [...unlockedSet],
          };
        });

        get().checkBankruptcyAid();
      },

      addChips: (amount, reason) =>
        set((prev) => {
          const nextChips = Math.max(0, prev.chips + amount);
          const unlockedSet = new Set(prev.unlockedAchievements);
          if (nextChips >= 20000) unlockedSet.add('rich_player');
          return {
            chips: nextChips,
            lastChipDelta: {
              amount,
              reason,
              timestamp: Date.now(),
            },
            unlockedAchievements: [...unlockedSet],
          };
        }),

      checkBankruptcyAid: () => {
        const current = get();
        if (current.chips >= 1000) return false;
        const today = todayKey();
        const grant = 3000;
        set({
          chips: current.chips + grant,
          lastChipDelta: {
            amount: grant,
            reason: '每日破产补助',
            timestamp: Date.now(),
          },
          lastAidDate: today,
          dailyAidCount: current.lastAidDate === today ? current.dailyAidCount + 1 : 1,
          pendingAidAnimation: true,
          lastAidGrant: grant,
        });
        soundEngine.playBeansAid();
        return true;
      },

      dismissAidAnimation: () => set({ pendingAidAnimation: false }),

      unlockAchievement: (id) =>
        set((prev) =>
          prev.unlockedAchievements.includes(id)
            ? prev
            : { unlockedAchievements: [...prev.unlockedAchievements, id] },
        ),

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
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundEngine.setEnabled(state.sfxEnabled);
          speechEngine.setEnabled(state.voiceEnabled);
        }
      },
    },
  ),
);

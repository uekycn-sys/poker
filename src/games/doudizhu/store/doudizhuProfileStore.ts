import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIDifficulty, Card, GameState, MatchSettlement, MoveRecord, Seat } from '../engine';

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

interface DoudizhuProfileState {
  landlordMatches: number;
  landlordWins: number;
  springCount: number;
  antiSpringCount: number;
  sortMode: SortMode;
  cardCounterMode: CardCounterMode;
  difficulty: AIDifficulty;
  baseScore: number;
  recentMatches: SavedMatchRecord[];
  clearedPuzzles: string[];

  recordMatch: (
    state: GameState,
    difficulty: AIDifficulty,
    initialHands?: [Card[], Card[], Card[]],
  ) => void;
  toggleSortMode: () => void;
  setCardCounterMode: (mode: CardCounterMode) => void;
  setDifficulty: (difficulty: AIDifficulty) => void;
  setBaseScore: (baseScore: number) => void;
  markPuzzleCleared: (puzzleId: string) => void;
}

const STORAGE_KEY = 'poker-master-doudizhu-v1';
const LEGACY_KEY = 'happy-doudizhu-profile-v1';

interface LegacyDoudizhuSeed {
  landlordMatches?: number;
  landlordWins?: number;
  springCount?: number;
  antiSpringCount?: number;
  sortMode?: SortMode;
  cardCounterMode?: CardCounterMode;
  difficulty?: AIDifficulty;
  baseScore?: number;
  recentMatches?: SavedMatchRecord[];
  clearedPuzzles?: string[];
}

function readLegacyDoudizhuSeed(): LegacyDoudizhuSeed {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return {};
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: LegacyDoudizhuSeed };
    return parsed?.state ?? {};
  } catch {
    return {};
  }
}

const legacy = readLegacyDoudizhuSeed();

export const useDoudizhuProfileStore = create<DoudizhuProfileState>()(
  persist(
    (set) => ({
      landlordMatches: legacy.landlordMatches ?? 0,
      landlordWins: legacy.landlordWins ?? 0,
      springCount: legacy.springCount ?? 0,
      antiSpringCount: legacy.antiSpringCount ?? 0,
      sortMode: legacy.sortMode ?? 'rank',
      cardCounterMode: legacy.cardCounterMode ?? 'assist',
      difficulty: legacy.difficulty ?? 'intermediate',
      baseScore: legacy.baseScore ?? 100,
      recentMatches: legacy.recentMatches ?? [],
      clearedPuzzles: legacy.clearedPuzzles ?? [],

      recordMatch: (state, difficulty, initialHands) => {
        const settlement = state.settlement;
        if (!settlement || state.landlordSeat === null) return;

        const isLandlord = state.landlordSeat === 0;
        const humanWon =
          (isLandlord && settlement.winnerRole === 'landlord') ||
          (!isLandlord && settlement.winnerRole === 'farmer');

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

        set((prev) => ({
          landlordMatches: prev.landlordMatches + (isLandlord ? 1 : 0),
          landlordWins: prev.landlordWins + (isLandlord && humanWon ? 1 : 0),
          springCount: prev.springCount + (settlement.isSpring ? 1 : 0),
          antiSpringCount: prev.antiSpringCount + (settlement.isAntiSpring ? 1 : 0),
          recentMatches: [savedRecord, ...prev.recentMatches].slice(0, 10),
        }));
      },

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
      name: STORAGE_KEY,
    },
  ),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HandReviewReport } from '../ai/coach';
import { BettingStreet, HandState, StreetSnapshot } from '../engine/types';

export interface SavedHoldemHand {
  id: string;
  playedAt: number;
  smallBlind: number;
  bigBlind: number;
  heroNetChips: number;
  review: HandReviewReport;
  streetSnapshots: Partial<Record<BettingStreet, StreetSnapshot>>;
  finalState: HandState;
}

interface HoldemProfileState {
  selectedStake: number;
  hudEnabled: boolean;
  outsQuizEnabled: boolean;
  trainingPoints: number;
  outsQuizAttempts: number;
  outsQuizCorrect: number;
  outsQuizStreak: number;
  recentHands: SavedHoldemHand[];

  setSelectedStake: (bigBlind: number) => void;
  toggleHud: () => void;
  setHudEnabled: (enabled: boolean) => void;
  toggleOutsQuiz: () => void;
  setOutsQuizEnabled: (enabled: boolean) => void;
  recordOutsQuizResult: (exact: boolean, pointsEarned: number) => number;
  saveCompletedHand: (hand: SavedHoldemHand) => void;
}

const STORAGE_KEY = 'poker-master-holdem-v1';

export const useHoldemProfileStore = create<HoldemProfileState>()(
  persist(
    (set, get) => ({
      selectedStake: 100,
      hudEnabled: true,
      outsQuizEnabled: false,
      trainingPoints: 0,
      outsQuizAttempts: 0,
      outsQuizCorrect: 0,
      outsQuizStreak: 0,
      recentHands: [],

      setSelectedStake: (selectedStake) => set({ selectedStake }),
      toggleHud: () => set((s) => ({ hudEnabled: !s.hudEnabled })),
      setHudEnabled: (hudEnabled) => set({ hudEnabled }),
      toggleOutsQuiz: () => set((s) => ({ outsQuizEnabled: !s.outsQuizEnabled })),
      setOutsQuizEnabled: (outsQuizEnabled) => set({ outsQuizEnabled }),

      recordOutsQuizResult: (exact, pointsEarned) => {
        const nextCorrect = get().outsQuizCorrect + (exact ? 1 : 0);
        set((s) => ({
          trainingPoints: s.trainingPoints + pointsEarned,
          outsQuizAttempts: s.outsQuizAttempts + 1,
          outsQuizCorrect: s.outsQuizCorrect + (exact ? 1 : 0),
          outsQuizStreak: exact ? s.outsQuizStreak + 1 : 0,
        }));
        return nextCorrect;
      },

      saveCompletedHand: (hand) =>
        set((s) => ({
          recentHands: [hand, ...s.recentHands].slice(0, 12),
        })),
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);

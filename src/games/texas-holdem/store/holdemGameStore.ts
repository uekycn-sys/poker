import { create } from 'zustand';
import { soundEngine } from '../../../shared/audio/soundEngine';
import { TableFxEvent } from '../../../shared/effects/TableEffects';
import { usePlayerStore } from '../../../shared/store/playerStore';
import { requestAiDecision, requestCoachAnalysis } from '../ai/aiClient';
import {
  buildHandReviewReport,
  CoachAnalysis,
  DecisionReviewItem,
  evaluateHeroDecision,
  HandReviewReport,
} from '../ai/coach';
import { OutsAnalysis } from '../ai/equity';
import {
  accumulateHandHudStats,
  AI_PERSONAS,
  AI_PERSONAS_BY_SEAT,
  createInitialHudStats,
  PlayerHudStats,
} from '../ai/personas';
import {
  applyAction,
  createHand,
  restoreFromStreetSnapshot,
} from '../engine/rules';
import {
  BettingStreet,
  HandState,
  PlayerAction,
  StreetSnapshot,
} from '../engine/types';
import { SavedHoldemHand, useHoldemProfileStore } from './holdemProfileStore';

export type HoldemScreen = 'hub' | 'table' | 'replay';

export interface OutsQuizState {
  active: boolean;
  street: 'flop' | 'turn';
  outsAnalysis: OutsAnalysis;
  startedAt: number;
  result?: {
    userAnswer: number | null;
    exact: boolean;
    close: boolean;
    pointsEarned: number;
    timedOut: boolean;
  };
}

interface HoldemGameStoreState {
  screen: HoldemScreen;
  handCount: number;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  tableStacks: Record<number, number>;
  hudStats: Record<number, PlayerHudStats>;
  handState: HandState | null;
  handStartHeroStack: number;
  coachAnalysis: CoachAnalysis | null;
  coachLoading: boolean;
  heroDecisionReviews: DecisionReviewItem[];
  streetEquities: Partial<Record<BettingStreet, number>>;
  activeReview: HandReviewReport | null;
  showReviewModal: boolean;
  showMatrixModal: boolean;
  allInSpotlight: boolean;
  tableFx: TableFxEvent | null;
  outsQuiz: OutsQuizState | null;
  quizzedStreetsThisHand: string[];
  isFastForwarding: boolean;
  isBranchedReplay: boolean;
  selectedReplayHandId: string | null;

  openHub: () => void;
  openReplayScreen: (handId?: string) => void;
  selectReplayHand: (handId: string) => void;
  startTable: (bigBlind?: number) => void;
  startNextHand: () => void;
  submitHeroAction: (action: PlayerAction) => void;
  submitOutsQuizAnswer: (answer: number | null, timedOut?: boolean) => void;
  dismissOutsQuiz: () => void;
  fastForwardHand: () => void;
  openReviewModal: () => void;
  closeReviewModal: () => void;
  setShowMatrixModal: (show: boolean) => void;
  clearTableFx: () => void;
  branchFromStreet: (
    snapshots: Partial<Record<BettingStreet, StreetSnapshot>>,
    street: BettingStreet,
    sourceHand?: SavedHoldemHand,
  ) => void;
  resetSession: () => void;
}

let turnToken = 0;
let aiTimer: ReturnType<typeof setTimeout> | null = null;
let spotlightTimer: ReturnType<typeof setTimeout> | null = null;
let fxCounter = 1;

function clearPendingTimers() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  if (spotlightTimer) {
    clearTimeout(spotlightTimer);
    spotlightTimer = null;
  }
}

function buildSeatConfigs(
  stacks: Record<number, number>,
  heroName: string,
) {
  return [
    { seat: 0, name: heroName, isHuman: true, stack: stacks[0] ?? 10000 },
    ...AI_PERSONAS.map((ai) => ({
      seat: ai.seat,
      name: ai.name,
      isHuman: false,
      stack: stacks[ai.seat] ?? 10000,
    })),
  ];
}

function playActionSfx(
  action: PlayerAction,
  amountAdded: number,
  bigBlind: number,
  isAllIn: boolean,
) {
  if (isAllIn || action.type === 'all_in') {
    soundEngine.playChipStack('large');
    soundEngine.playHeartbeat(3);
    return;
  }
  switch (action.type) {
    case 'fold':
      soundEngine.playFold();
      break;
    case 'check':
      soundEngine.playCheck();
      break;
    case 'call':
      soundEngine.playChipStack(amountAdded >= bigBlind * 4 ? 'medium' : 'small');
      break;
    case 'raise':
      soundEngine.playChipStack(amountAdded >= bigBlind * 6 ? 'large' : 'medium');
      break;
  }
}

export const useHoldemGameStore = create<HoldemGameStoreState>((set, get) => {
  const triggerSpotlight = () => {
    set({ allInSpotlight: true });
    if (spotlightTimer) clearTimeout(spotlightTimer);
    spotlightTimer = setTimeout(() => {
      set({ allInSpotlight: false });
    }, 2400);
  };

  const finalizeHand = (finalState: HandState) => {
    const state = get();
    const hero = finalState.players.find((p) => p.seat === 0)!;
    const heroWonAmount = finalState.showdown?.totalWonBySeat[0] ?? 0;
    const heroNet = hero.stack - state.handStartHeroStack;

    const updatedStacks: Record<number, number> = { ...state.tableStacks };
    for (const p of finalState.players) {
      updatedStacks[p.seat] = p.stack;
    }

    const nextHudStats = accumulateHandHudStats(state.hudStats, finalState);
    const review = buildHandReviewReport(
      finalState,
      state.heroDecisionReviews,
      state.streetEquities,
    );

    const savedHand: SavedHoldemHand = {
      id: `holdem-${Date.now()}-${finalState.handId}`,
      playedAt: Date.now(),
      smallBlind: finalState.smallBlind,
      bigBlind: finalState.bigBlind,
      heroNetChips: heroNet,
      review,
      streetSnapshots: finalState.streetSnapshots,
      finalState,
    };

    useHoldemProfileStore.getState().saveCompletedHand(savedHand);

    // Sync results to global club store unless this is a branched training replay
    if (!state.isBranchedReplay) {
      const rankDelta = heroNet > 0 ? 35 : heroNet === 0 ? 5 : -10;
      const extraAch: string[] = [];
      if (heroWonAmount > 0) {
        extraAch.push('holdem_first_pot');
      }
      usePlayerStore.getState().recordGameResult({
        gameId: 'texas-holdem',
        won: heroNet > 0,
        chipDelta: heroNet,
        rankPointDelta: rankDelta,
        extraAchievements: extraAch,
      });
    }

    if (finalState.showdown && !finalState.showdown.endedByFold) {
      soundEngine.playShowdownReveal();
    }
    if (heroNet > 0) {
      soundEngine.playVictory();
    }

    const heroWonShowdown = finalState.showdown?.winnerSeats.includes(0) ?? false;
    const heroEval = finalState.showdown?.evalsBySeat[0];
    let fx: TableFxEvent | null = null;
    if (heroWonShowdown && heroEval && heroEval.category >= 6) {
      fx = {
        id: fxCounter++,
        kind: 'JACKPOT',
        label: heroEval.categoryName,
        subLabel: `赢得底池 +${heroWonAmount.toLocaleString()}`,
      };
    } else if (heroNet > 0) {
      fx = {
        id: fxCounter++,
        kind: 'VICTORY',
        label: `收池 +${heroWonAmount.toLocaleString()}`,
        subLabel: heroEval ? heroEval.description : '对手全员弃牌',
      };
    }

    set({
      handState: finalState,
      tableStacks: updatedStacks,
      hudStats: nextHudStats,
      coachAnalysis: null,
      coachLoading: false,
      activeReview: review,
      isFastForwarding: false,
      tableFx: fx,
    });
  };

  const prepareHeroTurn = async (state: HandState, myToken: number) => {
    set({ coachLoading: true });
    try {
      const analysis = await requestCoachAnalysis(
        state,
        0,
        AI_PERSONAS_BY_SEAT,
        1200,
      );
      if (turnToken !== myToken) return;

      const street = state.street === 'showdown' ? 'river' : state.street;
      const prevEquities = get().streetEquities;
      const nextEquities = {
        ...prevEquities,
        [street]: analysis.heroEquityPct,
      };

      const profile = useHoldemProfileStore.getState();
      const alreadyQuizzed = get().quizzedStreetsThisHand;
      const shouldLaunchQuiz =
        profile.outsQuizEnabled &&
        (street === 'flop' || street === 'turn') &&
        analysis.outs.totalOuts >= 4 &&
        !alreadyQuizzed.includes(street);

      set({
        coachAnalysis: analysis,
        coachLoading: false,
        streetEquities: nextEquities,
        outsQuiz: shouldLaunchQuiz
          ? {
              active: true,
              street,
              outsAnalysis: analysis.outs,
              startedAt: Date.now(),
            }
          : get().outsQuiz,
        quizzedStreetsThisHand: shouldLaunchQuiz
          ? [...alreadyQuizzed, street]
          : alreadyQuizzed,
      });
    } catch {
      if (turnToken === myToken) {
        set({ coachLoading: false });
      }
    }
  };

  const driveTurn = (myToken: number) => {
    if (turnToken !== myToken) return;
    const current = get().handState;
    if (!current) return;

    if (current.isHandOver || current.activeSeat === null) {
      finalizeHand(current);
      return;
    }

    const activeSeat = current.activeSeat;
    if (activeSeat === 0) {
      void prepareHeroTurn(current, myToken);
      return;
    }

    const heroFolded = current.players.find((p) => p.seat === 0)?.folded ?? false;
    const delayMs = get().isFastForwarding ? 60 : heroFolded ? 180 : 520;

    aiTimer = setTimeout(() => {
      void (async () => {
        if (turnToken !== myToken) return;
        const latest = get().handState;
        if (!latest || latest.isHandOver || latest.activeSeat !== activeSeat) return;

        const persona = AI_PERSONAS_BY_SEAT[activeSeat] ?? AI_PERSONAS[0];
        const decision = await requestAiDecision(latest, activeSeat, persona, 1000);
        if (turnToken !== myToken) return;

        const nextState = applyAction(latest, activeSeat, decision.action);
        const lastAction = nextState.actions[nextState.actions.length - 1];
        if (lastAction) {
          playActionSfx(
            lastAction.action,
            lastAction.amountAdded,
            nextState.bigBlind,
            lastAction.isAllIn,
          );
          if (lastAction.isAllIn) {
            triggerSpotlight();
          }
        }

        set({ handState: nextState });
        driveTurn(myToken);
      })();
    }, delayMs);
  };

  return {
    screen: 'hub',
    handCount: 0,
    smallBlind: 50,
    bigBlind: 100,
    dealerSeat: 0,
    tableStacks: {},
    hudStats: createInitialHudStats([0, 1, 2, 3, 4, 5]),
    handState: null,
    handStartHeroStack: 0,
    coachAnalysis: null,
    coachLoading: false,
    heroDecisionReviews: [],
    streetEquities: {},
    activeReview: null,
    showReviewModal: false,
    showMatrixModal: false,
    allInSpotlight: false,
    tableFx: null,
    outsQuiz: null,
    quizzedStreetsThisHand: [],
    isFastForwarding: false,
    isBranchedReplay: false,
    selectedReplayHandId: null,

    openHub: () => {
      turnToken++;
      clearPendingTimers();
      set({ screen: 'hub', showReviewModal: false, outsQuiz: null });
    },

    openReplayScreen: (handId) => {
      turnToken++;
      clearPendingTimers();
      const recent = useHoldemProfileStore.getState().recentHands;
      const targetId = handId ?? recent[0]?.id ?? null;
      set({
        screen: 'replay',
        selectedReplayHandId: targetId,
        showReviewModal: false,
      });
    },

    selectReplayHand: (handId) => set({ selectedReplayHandId: handId }),

    startTable: (bigBlindArg) => {
      turnToken++;
      clearPendingTimers();
      const myToken = turnToken;

      const bb = bigBlindArg ?? useHoldemProfileStore.getState().selectedStake ?? 100;
      const sb = Math.max(1, Math.floor(bb / 2));
      useHoldemProfileStore.getState().setSelectedStake(bb);

      const playerStore = usePlayerStore.getState();
      if (playerStore.chips < bb * 10) {
        playerStore.checkBankruptcyAid();
      }
      const globalChips = usePlayerStore.getState().chips;
      const targetStack = bb * 100;
      const heroStack = Math.max(bb * 20, Math.min(globalChips, targetStack));

      const stacks: Record<number, number> = { 0: heroStack };
      for (const ai of AI_PERSONAS) {
        stacks[ai.seat] = targetStack;
      }

      const hand = createHand({
        handId: 1,
        players: buildSeatConfigs(stacks, playerStore.nickname),
        dealerSeat: 0,
        smallBlind: sb,
        bigBlind: bb,
      });

      soundEngine.playShuffle();

      set({
        screen: 'table',
        handCount: 1,
        smallBlind: sb,
        bigBlind: bb,
        dealerSeat: 0,
        tableStacks: stacks,
        hudStats: createInitialHudStats([0, 1, 2, 3, 4, 5]),
        handState: hand,
        handStartHeroStack: heroStack,
        coachAnalysis: null,
        coachLoading: false,
        heroDecisionReviews: [],
        streetEquities: {},
        activeReview: null,
        showReviewModal: false,
        showMatrixModal: false,
        allInSpotlight: false,
        tableFx: null,
        outsQuiz: null,
        quizzedStreetsThisHand: [],
        isFastForwarding: false,
        isBranchedReplay: false,
      });

      driveTurn(myToken);
    },

    startNextHand: () => {
      turnToken++;
      clearPendingTimers();
      const myToken = turnToken;
      const state = get();
      const bb = state.bigBlind;
      const sb = state.smallBlind;
      const targetStack = bb * 100;

      const playerStore = usePlayerStore.getState();
      if (playerStore.chips < bb * 10) {
        playerStore.checkBankruptcyAid();
      }

      const currentHeroStack = state.tableStacks[0] ?? 0;
      const heroStack =
        currentHeroStack < bb * 5
          ? Math.max(bb * 20, Math.min(usePlayerStore.getState().chips, targetStack))
          : currentHeroStack;

      const nextStacks: Record<number, number> = { 0: heroStack };
      for (const ai of AI_PERSONAS) {
        const s = state.tableStacks[ai.seat] ?? targetStack;
        nextStacks[ai.seat] = s < bb * 5 ? targetStack : s;
      }

      const nextDealer = (state.dealerSeat + 1) % 6;
      const nextHandNum = state.handCount + 1;
      const hand = createHand({
        handId: nextHandNum,
        players: buildSeatConfigs(nextStacks, playerStore.nickname),
        dealerSeat: nextDealer,
        smallBlind: sb,
        bigBlind: bb,
      });

      soundEngine.playShuffle();

      set({
        handCount: nextHandNum,
        dealerSeat: nextDealer,
        tableStacks: nextStacks,
        handState: hand,
        handStartHeroStack: heroStack,
        coachAnalysis: null,
        coachLoading: false,
        heroDecisionReviews: [],
        streetEquities: {},
        activeReview: null,
        showReviewModal: false,
        allInSpotlight: false,
        tableFx: null,
        outsQuiz: null,
        quizzedStreetsThisHand: [],
        isFastForwarding: false,
        isBranchedReplay: false,
      });

      driveTurn(myToken);
    },

    submitHeroAction: (action) => {
      const state = get();
      const current = state.handState;
      if (!current || current.isHandOver || current.activeSeat !== 0) return;

      turnToken++;
      clearPendingTimers();
      const myToken = turnToken;

      let nextReviews = state.heroDecisionReviews;
      if (state.coachAnalysis) {
        const item = evaluateHeroDecision(
          current,
          action,
          state.coachAnalysis,
          AI_PERSONAS_BY_SEAT,
        );
        nextReviews = [...nextReviews, item];
      }

      const nextState = applyAction(current, 0, action);
      const lastAction = nextState.actions[nextState.actions.length - 1];
      if (lastAction) {
        playActionSfx(
          lastAction.action,
          lastAction.amountAdded,
          nextState.bigBlind,
          lastAction.isAllIn,
        );
        if (lastAction.isAllIn) {
          triggerSpotlight();
        }
      }

      set({
        handState: nextState,
        heroDecisionReviews: nextReviews,
        coachAnalysis: null,
        outsQuiz: null,
      });

      driveTurn(myToken);
    },

    submitOutsQuizAnswer: (answer, timedOut = false) => {
      const quiz = get().outsQuiz;
      if (!quiz || !quiz.active) return;

      const actual = quiz.outsAnalysis.totalOuts;
      const exact = answer !== null && answer === actual;
      const close = answer !== null && !exact && Math.abs(answer - actual) <= 1;
      const pointsEarned = exact ? 50 : close ? 15 : 0;

      if (exact || close) {
        soundEngine.playQuizSuccess();
      } else {
        soundEngine.playQuizFail();
      }

      const totalCorrect = useHoldemProfileStore
        .getState()
        .recordOutsQuizResult(exact, pointsEarned);
      if (totalCorrect >= 3) {
        usePlayerStore.getState().unlockAchievement('holdem_outs_master');
      }

      set({
        outsQuiz: {
          ...quiz,
          result: {
            userAnswer: answer,
            exact,
            close,
            pointsEarned,
            timedOut,
          },
        },
      });
    },

    dismissOutsQuiz: () => {
      set({ outsQuiz: null });
    },

    fastForwardHand: () => {
      set({ isFastForwarding: true });
    },

    openReviewModal: () => set({ showReviewModal: true }),
    closeReviewModal: () => set({ showReviewModal: false }),
    setShowMatrixModal: (showMatrixModal) => set({ showMatrixModal }),
    clearTableFx: () => set({ tableFx: null }),

    branchFromStreet: (snapshots, street, sourceHand) => {
      const snap = snapshots[street];
      if (!snap) return;

      turnToken++;
      clearPendingTimers();
      const myToken = turnToken;

      const restored = restoreFromStreetSnapshot(snap);
      const streetOrder: BettingStreet[] = ['preflop', 'flop', 'turn', 'river'];
      const targetIdx = streetOrder.indexOf(street);
      const sourceReviews = sourceHand?.review.decisions ?? get().heroDecisionReviews;
      const keptReviews = sourceReviews.filter(
        (d) => streetOrder.indexOf(d.street) < targetIdx,
      );

      const stacks: Record<number, number> = {};
      for (const p of restored.players) {
        stacks[p.seat] = p.stack + p.totalCommitted;
      }

      const heroOriginalStart =
        restored.players.find((p) => p.seat === 0)?.totalCommitted ?? 0;
      const heroCurrentStack = restored.players.find((p) => p.seat === 0)?.stack ?? 0;

      soundEngine.playShuffle();

      set({
        screen: 'table',
        smallBlind: restored.smallBlind,
        bigBlind: restored.bigBlind,
        dealerSeat: restored.dealerSeat,
        handCount: restored.handId,
        tableStacks: stacks,
        handState: restored,
        handStartHeroStack: heroCurrentStack + heroOriginalStart,
        coachAnalysis: null,
        coachLoading: false,
        heroDecisionReviews: keptReviews,
        streetEquities: {},
        activeReview: null,
        showReviewModal: false,
        showMatrixModal: false,
        allInSpotlight: false,
        tableFx: {
          id: fxCounter++,
          kind: 'STRAIGHT',
          label: `从【${street === 'preflop' ? '翻前' : street === 'flop' ? '翻牌' : street === 'turn' ? '转牌' : '河牌'}】重新开打`,
          subLabel: '训练重演模式 · 本局不扣除俱乐部资产',
        },
        outsQuiz: null,
        quizzedStreetsThisHand: [],
        isFastForwarding: false,
        isBranchedReplay: true,
      });

      driveTurn(myToken);
    },

    resetSession: () => {
      turnToken++;
      clearPendingTimers();
      set({
        handState: null,
        coachAnalysis: null,
        coachLoading: false,
        outsQuiz: null,
        showReviewModal: false,
        showMatrixModal: false,
        allInSpotlight: false,
        tableFx: null,
      });
    },
  };
});

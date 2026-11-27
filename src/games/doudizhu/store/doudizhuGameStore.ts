import { create } from 'zustand';
import {
  AIDifficulty,
  BidAction,
  Card,
  CoachAdvice,
  DoubleChoice,
  EndgamePuzzle,
  GameState,
  HandPattern,
  RANK_LABELS,
  Rank,
  Seat,
  WinRateEvaluation,
  activateMingpai,
  applyBidAction,
  applyDoubleChoice,
  applyPassTurn,
  applyPlayCards,
  buildPuzzleGameState,
  computeExternalRemainingCounts,
  createInitialGameState,
  extractSmartSelection,
  findBeatingPlays,
  matchPatternToBeat,
  requestAIBid,
  requestAIDouble,
  requestAIMove,
  requestCoachAdvice,
  requestWinRate,
  startNewMatch,
} from '../engine';
import { soundEngine } from '../../../shared/audio/soundEngine';
import { FxKind, TableFxEvent } from '../../../shared/effects/TableEffects';
import { secureRandomInt, secureShuffle } from '../../../shared/random';
import { usePlayerStore } from '../../../shared/store/playerStore';
import { doudizhuSpeech } from '../audio/doudizhuSpeech';
import { SavedMatchRecord, useDoudizhuProfileStore } from './doudizhuProfileStore';

export type DoudizhuScreen = 'hub' | 'table' | 'puzzles' | 'replay';
export type MatchMode = 'standard' | 'puzzle' | 'replay-resume';

export interface BlindQuizQuestion {
  prompt: string;
  targetRanks: [Rank, Rank];
  correctText: string;
  options: string[];
  rewardBeans: number;
}

export interface BlindQuizFeedback {
  selected: string;
  isCorrect: boolean;
  correctText: string;
}

const DEFAULT_WIN_RATE: WinRateEvaluation = {
  landlordWinRate: 50,
  farmerWinRate: 50,
  perspectiveWinRate: 50,
  advantage: 0,
};

const PLAY_TURN_SECONDS = 45;
const BID_TURN_SECONDS = 30;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let fxCounter = 1;
let bubbleTimerIds: Array<ReturnType<typeof setTimeout>> = [];

function clearBubbleTimers() {
  for (const t of bubbleTimerIds) clearTimeout(t);
  bubbleTimerIds = [];
}

function generateBlindQuiz(state: GameState): BlindQuizQuestion {
  const ext = computeExternalRemainingCounts(state.hands[0], state.moveHistory);
  const pairs: Array<[Rank, Rank]> = [
    [Rank.TWO, Rank.ACE],
    [Rank.ACE, Rank.KING],
    [Rank.KING, Rank.QUEEN],
  ];
  const chosen = pairs[state.moveHistory.length % pairs.length];
  const [r1, r2] = chosen;
  const c1 = ext[r1];
  const c2 = ext[r2];
  const l1 = RANK_LABELS[r1];
  const l2 = RANK_LABELS[r2];
  const correctText = `${c1} 张 ${l1}，${c2} 张 ${l2}`;

  const optionSet = new Set<string>([correctText]);
  const deltas: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, -1],
    [-1, 1],
  ];
  for (const [d1, d2] of deltas) {
    if (optionSet.size >= 4) break;
    const alt1 = Math.max(0, Math.min(4, c1 + d1));
    const alt2 = Math.max(0, Math.min(4, c2 + d2));
    optionSet.add(`${alt1} 张 ${l1}，${alt2} 张 ${l2}`);
  }
  const options = secureShuffle([...optionSet]);

  return {
    prompt: `盲记抽测：目前外面还剩几张 ${l1} 和几张 ${l2}？`,
    targetRanks: [r1, r2],
    correctText,
    options,
    rewardBeans: 500,
  };
}

interface DoudizhuGameStoreState {
  screen: DoudizhuScreen;
  matchMode: MatchMode;
  activePuzzle: EndgamePuzzle | null;
  puzzleRewardGranted: number | null;
  replayMatch: SavedMatchRecord | null;
  sessionToken: number;
  gameState: GameState;
  initialPlayHands: [Card[], Card[], Card[]] | null;
  selectedCardIds: string[];
  hints: HandPattern[];
  hintIndex: number;
  smartSelectionNotice: string | null;
  seatBubbles: [string | null, string | null, string | null];
  tablePlays: [HandPattern | null, HandPattern | null, HandPattern | null];
  aiThinkingSeat: Seat | null;
  activeFx: TableFxEvent | null;
  liveWinRate: WinRateEvaluation;
  coachPanelOpen: boolean;
  coachAdvice: CoachAdvice | null;
  coachLoading: boolean;
  turnSecondsLeft: number;
  blindQuizTriggered: boolean;
  activeBlindQuiz: BlindQuizQuestion | null;
  blindQuizFeedback: BlindQuizFeedback | null;

  startMatch: (difficulty?: AIDifficulty, baseScore?: number) => void;
  startPuzzle: (puzzle: EndgamePuzzle) => void;
  resetActivePuzzle: () => void;
  openPuzzlesScreen: () => void;
  openReplayScreen: (record?: SavedMatchRecord) => void;
  resumeFromReplaySnapshot: (record: SavedMatchRecord, moveIndex: number) => void;
  returnToHub: () => void;
  resetSession: () => void;
  humanBid: (action: BidAction) => void;
  humanMingpai: () => void;
  humanDouble: (choice: DoubleChoice) => void;
  toggleCardSelection: (cardId: string) => void;
  applySwipeSelection: (orderedSwipedIds: string[]) => void;
  clearSelection: () => void;
  cycleHint: () => void;
  humanPlaySelected: () => void;
  humanPass: () => void;
  tickTurnTimer: () => void;
  toggleCoachPanel: () => void;
  requestLiveCoach: () => void;
  selectCoachCards: () => void;
  clearActiveFx: () => void;
  runAITurnIfNeeded: () => void;
  triggerManualBlindQuiz: () => void;
  answerBlindQuiz: (option: string) => void;
  dismissBlindQuiz: () => void;
}

export const useDoudizhuGameStore = create<DoudizhuGameStoreState>((set, get) => {
  const showBubble = (seat: Seat, text: string, token: number) => {
    set((prev) => {
      const next: [string | null, string | null, string | null] = [...prev.seatBubbles] as [
        string | null,
        string | null,
        string | null,
      ];
      next[seat] = text;
      return { seatBubbles: next };
    });
    const timer = setTimeout(() => {
      if (get().sessionToken !== token) return;
      set((prev) => {
        const next: [string | null, string | null, string | null] = [...prev.seatBubbles] as [
          string | null,
          string | null,
          string | null,
        ];
        if (next[seat] === text) next[seat] = null;
        return { seatBubbles: next };
      });
    }, 1800);
    bubbleTimerIds.push(timer);
  };

  const triggerPatternFeedback = (seat: Seat, pattern: HandPattern, remainingCount: number) => {
    doudizhuSpeech.announcePattern(pattern);
    if (pattern.type === 'ROCKET') {
      soundEngine.playRocket();
      set({ activeFx: { id: fxCounter++, kind: 'ROCKET', label: '王炸 · 天崩地裂 ×2' } });
    } else if (pattern.type === 'BOMB') {
      soundEngine.playBomb();
      set({ activeFx: { id: fxCounter++, kind: 'BOMB', label: '炸弹 · 倍数 ×2' } });
    } else if (
      pattern.type === 'STRAIGHT' ||
      pattern.type === 'PAIR_STRAIGHT' ||
      pattern.type === 'AIRPLANE' ||
      pattern.type === 'AIRPLANE_WITH_SINGLES' ||
      pattern.type === 'AIRPLANE_WITH_PAIRS'
    ) {
      soundEngine.playCardSlap(true);
      soundEngine.playComboSweep();
      const fxKind: FxKind =
        pattern.type === 'STRAIGHT'
          ? 'STRAIGHT'
          : pattern.type === 'PAIR_STRAIGHT'
            ? 'PAIR_STRAIGHT'
            : 'AIRPLANE';
      const label =
        fxKind === 'STRAIGHT' ? '顺子连击' : fxKind === 'PAIR_STRAIGHT' ? '连对疾风' : '飞机起飞';
      set({ activeFx: { id: fxCounter++, kind: fxKind, label } });
    } else {
      soundEngine.playCardSlap(false);
    }

    if (remainingCount === 1 || remainingCount === 2) {
      const token = get().sessionToken;
      setTimeout(() => {
        if (get().sessionToken !== token) return;
        doudizhuSpeech.announceAlarm(remainingCount);
      }, 420);
    }

    void seat;
  };

  const refreshWinRate = async (nextState: GameState, token: number) => {
    if (nextState.landlordSeat === null) return;
    const wr = await requestWinRate(nextState, 0);
    if (get().sessionToken !== token) return;
    set({ liveWinRate: wr });
  };

  const maybeTriggerBlindQuiz = (nextState: GameState) => {
    const { matchMode, blindQuizTriggered, activeBlindQuiz } = get();
    const { cardCounterMode } = useDoudizhuProfileStore.getState();
    if (
      matchMode === 'standard' &&
      cardCounterMode === 'blind' &&
      !blindQuizTriggered &&
      !activeBlindQuiz &&
      nextState.phase === 'PLAYING' &&
      nextState.currentTurn === 0 &&
      nextState.moveHistory.length >= 10
    ) {
      set({
        blindQuizTriggered: true,
        activeBlindQuiz: generateBlindQuiz(nextState),
        blindQuizFeedback: null,
      });
    }
  };

  const finalizeIfFinished = (nextState: GameState, token: number) => {
    if (nextState.phase !== 'FINISHED' || !nextState.settlement) return;

    const isLandlord = nextState.landlordSeat === 0;
    const humanWon =
      (isLandlord && nextState.settlement.winnerRole === 'landlord') ||
      (!isLandlord && nextState.settlement.winnerRole === 'farmer');

    const { matchMode, activePuzzle } = get();
    const ddProfile = useDoudizhuProfileStore.getState();
    const player = usePlayerStore.getState();

    if (matchMode === 'puzzle' && activePuzzle) {
      if (humanWon) {
        const alreadyCleared = ddProfile.clearedPuzzles.includes(activePuzzle.id);
        ddProfile.markPuzzleCleared(activePuzzle.id);
        player.unlockAchievement('puzzle_breaker');
        if (!alreadyCleared) {
          player.addChips(activePuzzle.rewardBeans, `残局 #${activePuzzle.number} 首通奖励`);
          set({ puzzleRewardGranted: activePuzzle.rewardBeans });
        }
      }
    } else {
      ddProfile.recordMatch(
        nextState,
        ddProfile.difficulty,
        get().initialPlayHands ?? undefined,
      );

      const deltaChips = nextState.settlement.beanDeltas[0];
      const rankPointDelta = humanWon ? (isLandlord ? 45 : 35) : -20;
      const extraAchievements: string[] = [];
      if (humanWon && (nextState.settlement.isSpring || nextState.settlement.isAntiSpring)) {
        extraAchievements.push('spring_king');
      }

      player.recordGameResult({
        gameId: 'doudizhu',
        won: humanWon,
        chipDelta: deltaChips,
        rankPointDelta,
        extraAchievements,
      });
    }

    if (nextState.settlement.isSpring || nextState.settlement.isAntiSpring) {
      const isAnti = nextState.settlement.isAntiSpring;
      set({
        activeFx: {
          id: fxCounter++,
          kind: isAnti ? 'ANTI_SPRING' : 'SPRING',
          label: isAnti ? '反春大捷 · 倍数 ×2' : '春天横扫 · 倍数 ×2',
        },
      });
      setTimeout(() => {
        if (get().sessionToken !== token) return;
        doudizhuSpeech.announceSpring(isAnti);
      }, 350);
    }

    setTimeout(() => {
      if (get().sessionToken !== token) return;
      if (humanWon) soundEngine.playVictory();
      else soundEngine.playDefeat();
    }, 300);
  };

  const commitState = (nextState: GameState, token: number) => {
    const captureInitial =
      nextState.phase === 'PLAYING' && get().initialPlayHands === null
        ? ([
            [...nextState.hands[0]],
            [...nextState.hands[1]],
            [...nextState.hands[2]],
          ] as [Card[], Card[], Card[]])
        : get().initialPlayHands;

    set({
      gameState: nextState,
      initialPlayHands: captureInitial,
      selectedCardIds: [],
      hints: [],
      hintIndex: 0,
      coachAdvice: null,
      turnSecondsLeft: nextState.phase === 'PLAYING' ? PLAY_TURN_SECONDS : BID_TURN_SECONDS,
    });

    if (nextState.phase === 'PLAYING' || nextState.phase === 'FINISHED') {
      void refreshWinRate(nextState, token);
    }
    maybeTriggerBlindQuiz(nextState);
    finalizeIfFinished(nextState, token);
  };

  return {
    screen: 'hub',
    matchMode: 'standard',
    activePuzzle: null,
    puzzleRewardGranted: null,
    replayMatch: null,
    sessionToken: 1,
    gameState: createInitialGameState(100),
    initialPlayHands: null,
    selectedCardIds: [],
    hints: [],
    hintIndex: 0,
    smartSelectionNotice: null,
    seatBubbles: [null, null, null],
    tablePlays: [null, null, null],
    aiThinkingSeat: null,
    activeFx: null,
    liveWinRate: DEFAULT_WIN_RATE,
    coachPanelOpen: false,
    coachAdvice: null,
    coachLoading: false,
    turnSecondsLeft: PLAY_TURN_SECONDS,
    blindQuizTriggered: false,
    activeBlindQuiz: null,
    blindQuizFeedback: null,

    startMatch: (difficultyOverride, baseScoreOverride) => {
      const ddProfile = useDoudizhuProfileStore.getState();
      const player = usePlayerStore.getState();
      if (difficultyOverride) ddProfile.setDifficulty(difficultyOverride);
      if (baseScoreOverride) ddProfile.setBaseScore(baseScoreOverride);
      const baseScore = baseScoreOverride ?? ddProfile.baseScore;
      player.checkBankruptcyAid();

      clearBubbleTimers();
      const token = get().sessionToken + 1;
      const starter = secureRandomInt(3) as Seat;
      const fresh = startNewMatch(baseScore, starter);

      soundEngine.playDeal();
      set({
        screen: 'table',
        matchMode: 'standard',
        activePuzzle: null,
        puzzleRewardGranted: null,
        sessionToken: token,
        gameState: fresh,
        initialPlayHands: null,
        selectedCardIds: [],
        hints: [],
        hintIndex: 0,
        smartSelectionNotice: null,
        seatBubbles: [null, null, null],
        tablePlays: [null, null, null],
        aiThinkingSeat: null,
        activeFx: null,
        liveWinRate: DEFAULT_WIN_RATE,
        coachAdvice: null,
        coachLoading: false,
        turnSecondsLeft: BID_TURN_SECONDS,
        blindQuizTriggered: false,
        activeBlindQuiz: null,
        blindQuizFeedback: null,
      });

      get().runAITurnIfNeeded();
    },

    startPuzzle: (puzzle) => {
      clearBubbleTimers();
      const token = get().sessionToken + 1;
      const puzzleState = buildPuzzleGameState(puzzle);
      const initialTablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] = [
        puzzleState.lastPlay?.seat === 0 ? puzzleState.lastPlay.pattern : null,
        puzzleState.lastPlay?.seat === 1 ? puzzleState.lastPlay.pattern : null,
        puzzleState.lastPlay?.seat === 2 ? puzzleState.lastPlay.pattern : null,
      ];

      soundEngine.playDeal();
      set({
        screen: 'table',
        matchMode: 'puzzle',
        activePuzzle: puzzle,
        puzzleRewardGranted: null,
        sessionToken: token,
        gameState: puzzleState,
        initialPlayHands: [
          [...puzzleState.hands[0]],
          [...puzzleState.hands[1]],
          [...puzzleState.hands[2]],
        ],
        selectedCardIds: [],
        hints: [],
        hintIndex: 0,
        smartSelectionNotice: null,
        seatBubbles: [null, null, null],
        tablePlays: initialTablePlays,
        aiThinkingSeat: null,
        activeFx: null,
        liveWinRate: DEFAULT_WIN_RATE,
        coachPanelOpen: false,
        coachAdvice: null,
        coachLoading: false,
        turnSecondsLeft: PLAY_TURN_SECONDS,
        blindQuizTriggered: true,
        activeBlindQuiz: null,
        blindQuizFeedback: null,
      });

      void refreshWinRate(puzzleState, token);
    },

    resetActivePuzzle: () => {
      const puzzle = get().activePuzzle;
      if (puzzle) {
        get().startPuzzle(puzzle);
      }
    },

    openPuzzlesScreen: () => {
      clearBubbleTimers();
      set((prev) => ({
        screen: 'puzzles',
        sessionToken: prev.sessionToken + 1,
        aiThinkingSeat: null,
        activeFx: null,
      }));
    },

    openReplayScreen: (record) => {
      clearBubbleTimers();
      const ddProfile = useDoudizhuProfileStore.getState();
      const target = record ?? ddProfile.recentMatches[0] ?? null;
      set((prev) => ({
        screen: 'replay',
        replayMatch: target,
        sessionToken: prev.sessionToken + 1,
        aiThinkingSeat: null,
        activeFx: null,
      }));
    },

    resumeFromReplaySnapshot: (record, moveIndex) => {
      if (record.moveHistory.length === 0) return;
      clearBubbleTimers();
      const token = get().sessionToken + 1;
      const clampedIdx = Math.max(0, Math.min(record.moveHistory.length - 1, moveIndex));
      const targetMove = record.moveHistory[clampedIdx];
      const priorMoves = record.moveHistory.slice(0, clampedIdx);

      const playCounts: [number, number, number] = [0, 0, 0];
      let bombCount = 0;
      let rocketCount = 0;
      for (const m of priorMoves) {
        if (!m.isPass) {
          playCounts[m.seat] += 1;
          if (m.pattern?.type === 'BOMB') bombCount += 1;
          if (m.pattern?.type === 'ROCKET') rocketCount += 1;
        }
      }

      const prevMove = priorMoves.length > 0 ? priorMoves[priorMoves.length - 1] : null;
      const passCount = targetMove.lastPlayBefore === null ? 0 : prevMove?.isPass ? 1 : 0;

      const tablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] = [
        null,
        null,
        null,
      ];
      if (targetMove.lastPlayBefore) {
        tablePlays[targetMove.lastPlayBefore.seat] = targetMove.lastPlayBefore.pattern;
      }

      const reconstructed: GameState = {
        ...createInitialGameState(record.baseScore),
        phase: 'PLAYING',
        hands: [
          [...targetMove.handsSnapshot[0]],
          [...targetMove.handsSnapshot[1]],
          [...targetMove.handsSnapshot[2]],
        ],
        bottomCards: record.bottomCards,
        landlordSeat: record.landlordSeat,
        currentTurn: targetMove.seat,
        starterSeat: record.landlordSeat,
        doubleChoices: [1, 1, 1],
        lastPlay: targetMove.lastPlayBefore,
        passCount,
        playCounts,
        bombCount,
        rocketCount,
        moveHistory: priorMoves,
      };

      soundEngine.playDeal();
      set({
        screen: 'table',
        matchMode: 'replay-resume',
        activePuzzle: null,
        puzzleRewardGranted: null,
        sessionToken: token,
        gameState: reconstructed,
        initialPlayHands: [
          [...record.initialHands[0]],
          [...record.initialHands[1]],
          [...record.initialHands[2]],
        ],
        selectedCardIds: [],
        hints: [],
        hintIndex: 0,
        smartSelectionNotice: null,
        seatBubbles: [null, null, null],
        tablePlays,
        aiThinkingSeat: null,
        activeFx: null,
        liveWinRate: DEFAULT_WIN_RATE,
        coachPanelOpen: false,
        coachAdvice: null,
        coachLoading: false,
        turnSecondsLeft: PLAY_TURN_SECONDS,
        blindQuizTriggered: true,
        activeBlindQuiz: null,
        blindQuizFeedback: null,
      });

      void refreshWinRate(reconstructed, token);
      get().runAITurnIfNeeded();
    },

    returnToHub: () => {
      clearBubbleTimers();
      set((prev) => ({
        screen: 'hub',
        sessionToken: prev.sessionToken + 1,
        aiThinkingSeat: null,
        activeFx: null,
        activeBlindQuiz: null,
        blindQuizFeedback: null,
      }));
    },

    resetSession: () => {
      clearBubbleTimers();
      set((prev) => ({
        screen: 'hub',
        sessionToken: prev.sessionToken + 1,
        aiThinkingSeat: null,
        activeFx: null,
        activeBlindQuiz: null,
        blindQuizFeedback: null,
      }));
    },

    humanBid: (action) => {
      const { gameState, sessionToken } = get();
      if (gameState.phase !== 'BIDDING' || gameState.currentTurn !== 0) return;

      const isFirstCall = gameState.firstCallerSeat === null;
      doudizhuSpeech.announceBid(action, isFirstCall);
      soundEngine.playSelect();

      const label =
        action === 'CALL' ? '叫地主' : action === 'GRAB' ? '抢地主' : isFirstCall ? '不叫' : '不抢';
      const prevRedeal = gameState.redealCount;
      const next = applyBidAction(gameState, 0, action);

      if (next.redealCount > prevRedeal) {
        soundEngine.playDeal();
        set({
          tablePlays: [null, null, null],
          seatBubbles: [null, null, null],
        });
        showBubble(0, '全不叫 · 重新发牌', sessionToken);
      } else {
        showBubble(0, label, sessionToken);
      }

      commitState(next, sessionToken);
      get().runAITurnIfNeeded();
    },

    humanMingpai: () => {
      const { gameState, sessionToken } = get();
      try {
        const next = activateMingpai(gameState, 0);
        doudizhuSpeech.announceMingpai();
        soundEngine.playComboSweep();
        showBubble(0, '明牌 ×4', sessionToken);
        set({ gameState: next });
      } catch {
        // Ignore
      }
    },

    humanDouble: (choice) => {
      const { gameState, sessionToken } = get();
      if (gameState.phase !== 'DOUBLING' || gameState.doubleChoices[0] !== null) return;
      doudizhuSpeech.announceDouble(choice);
      soundEngine.playSelect();
      showBubble(0, choice === 4 ? '超级加倍' : choice === 2 ? '加倍' : '不加倍', sessionToken);

      const next = applyDoubleChoice(gameState, 0, choice);
      commitState(next, sessionToken);
      get().runAITurnIfNeeded();
    },

    toggleCardSelection: (cardId) => {
      soundEngine.playSelect();
      set((prev) => {
        const exists = prev.selectedCardIds.includes(cardId);
        return {
          selectedCardIds: exists
            ? prev.selectedCardIds.filter((id) => id !== cardId)
            : [...prev.selectedCardIds, cardId],
          smartSelectionNotice: null,
        };
      });
    },

    applySwipeSelection: (orderedSwipedIds) => {
      if (orderedSwipedIds.length === 0) return;
      if (orderedSwipedIds.length === 1) {
        get().toggleCardSelection(orderedSwipedIds[0]);
        return;
      }

      const { gameState, selectedCardIds, sessionToken } = get();
      const hand = gameState.hands[0];
      const swipedCards = orderedSwipedIds
        .map((id) => hand.find((c) => c.id === id))
        .filter((c): c is Card => Boolean(c));

      if (swipedCards.length >= 5) {
        const prevPattern = gameState.lastPlay?.pattern ?? null;
        const smart = extractSmartSelection(swipedCards, prevPattern);
        if (smart && smart.length >= 5) {
          soundEngine.playComboSweep();
          set({
            selectedCardIds: smart.map((c) => c.id),
            smartSelectionNotice: '已智能提炼顺子/连对',
          });
          setTimeout(() => {
            if (get().sessionToken === sessionToken) {
              set({ smartSelectionNotice: null });
            }
          }, 1800);
          return;
        }
      }

      soundEngine.playSelect();
      const allAlreadySelected = orderedSwipedIds.every((id) => selectedCardIds.includes(id));
      const nextSet = new Set(selectedCardIds);
      if (allAlreadySelected) {
        for (const id of orderedSwipedIds) nextSet.delete(id);
      } else {
        for (const id of orderedSwipedIds) nextSet.add(id);
      }
      set({ selectedCardIds: [...nextSet], smartSelectionNotice: null });
    },

    clearSelection: () => set({ selectedCardIds: [], smartSelectionNotice: null }),

    cycleHint: () => {
      const { gameState, hints, hintIndex } = get();
      if (gameState.phase !== 'PLAYING' || gameState.currentTurn !== 0) return;

      const list =
        hints.length > 0
          ? hints
          : findBeatingPlays(gameState.hands[0], gameState.lastPlay?.pattern ?? null);
      if (list.length === 0) {
        get().humanPass();
        return;
      }

      const idx = hintIndex % list.length;
      const chosen = list[idx];
      soundEngine.playSelect();
      set({
        hints: list,
        hintIndex: (idx + 1) % list.length,
        selectedCardIds: chosen.cards.map((c) => c.id),
      });
    },

    humanPlaySelected: () => {
      const { gameState, selectedCardIds, sessionToken } = get();
      if (gameState.phase !== 'PLAYING' || gameState.currentTurn !== 0) return;

      const selectedCards = gameState.hands[0].filter((c) => selectedCardIds.includes(c.id));
      if (selectedCards.length === 0) return;

      const matched = matchPatternToBeat(selectedCards, gameState.lastPlay?.pattern ?? null);
      if (!matched) return;

      const next = applyPlayCards(gameState, 0, selectedCards);
      const nextTablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] =
        gameState.lastPlay === null
          ? [matched, null, null]
          : [matched, get().tablePlays[1], get().tablePlays[2]];

      set({ tablePlays: nextTablePlays });
      triggerPatternFeedback(0, matched, next.hands[0].length);
      commitState(next, sessionToken);
      get().runAITurnIfNeeded();
    },

    humanPass: () => {
      const { gameState, sessionToken } = get();
      if (gameState.phase !== 'PLAYING' || gameState.currentTurn !== 0 || gameState.lastPlay === null)
        return;

      soundEngine.playPass();
      doudizhuSpeech.announcePass();
      showBubble(0, '不要', sessionToken);

      const next = applyPassTurn(gameState, 0);
      const nextTablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] =
        next.lastPlay === null
          ? [null, null, null]
          : [null, get().tablePlays[1], get().tablePlays[2]];
      set({ tablePlays: nextTablePlays });

      commitState(next, sessionToken);
      get().runAITurnIfNeeded();
    },

    tickTurnTimer: () => {
      const { screen, matchMode, gameState, turnSecondsLeft, activeBlindQuiz } = get();
      if (screen !== 'table' || matchMode === 'puzzle' || activeBlindQuiz !== null) return;
      if (
        gameState.phase !== 'PLAYING' &&
        gameState.phase !== 'BIDDING' &&
        gameState.phase !== 'DOUBLING'
      ) {
        return;
      }
      if (gameState.currentTurn !== 0) return;

      if (turnSecondsLeft > 1) {
        const nextSec = turnSecondsLeft - 1;
        if (nextSec <= 5) soundEngine.playTick();
        set({ turnSecondsLeft: nextSec });
        return;
      }

      if (gameState.phase === 'BIDDING') {
        get().humanBid('PASS');
      } else if (gameState.phase === 'DOUBLING') {
        get().humanDouble(1);
      } else if (gameState.phase === 'PLAYING') {
        if (gameState.lastPlay !== null) {
          get().humanPass();
        } else {
          const plays = findBeatingPlays(gameState.hands[0], null);
          if (plays.length > 0) {
            set({ selectedCardIds: plays[0].cards.map((c) => c.id) });
            get().humanPlaySelected();
          }
        }
      }
    },

    toggleCoachPanel: () => {
      const open = !get().coachPanelOpen;
      set({ coachPanelOpen: open });
      if (open && get().gameState.phase === 'PLAYING' && get().gameState.currentTurn === 0) {
        get().requestLiveCoach();
      }
    },

    requestLiveCoach: () => {
      const { gameState, sessionToken } = get();
      if (gameState.phase !== 'PLAYING' || gameState.currentTurn !== 0) {
        set({ coachPanelOpen: true });
        return;
      }
      set({ coachPanelOpen: true, coachLoading: true });
      void requestCoachAdvice(gameState, 0).then((advice) => {
        if (get().sessionToken !== sessionToken) return;
        set({
          coachAdvice: advice,
          coachLoading: false,
          selectedCardIds: advice.isPass ? [] : advice.cards.map((c) => c.id),
        });
      });
    },

    selectCoachCards: () => {
      const { coachAdvice } = get();
      if (!coachAdvice) return;
      soundEngine.playSelect();
      set({ selectedCardIds: coachAdvice.isPass ? [] : coachAdvice.cards.map((c) => c.id) });
    },

    clearActiveFx: () => set({ activeFx: null }),

    triggerManualBlindQuiz: () => {
      const { gameState } = get();
      if (gameState.phase !== 'PLAYING') return;
      set({
        blindQuizTriggered: true,
        activeBlindQuiz: generateBlindQuiz(gameState),
        blindQuizFeedback: null,
      });
    },

    answerBlindQuiz: (option) => {
      const { activeBlindQuiz, blindQuizFeedback } = get();
      if (!activeBlindQuiz || blindQuizFeedback) return;
      const isCorrect = option === activeBlindQuiz.correctText;
      if (isCorrect) {
        usePlayerStore.getState().addChips(activeBlindQuiz.rewardBeans, '盲记抽测奖励');
        soundEngine.playBeansAid();
      } else {
        soundEngine.playPass();
      }
      set({
        blindQuizFeedback: {
          selected: option,
          isCorrect,
          correctText: activeBlindQuiz.correctText,
        },
      });
    },

    dismissBlindQuiz: () => set({ activeBlindQuiz: null, blindQuizFeedback: null }),

    runAITurnIfNeeded: () => {
      const { screen, gameState, sessionToken, matchMode } = get();
      if (screen !== 'table') return;
      if (
        gameState.phase !== 'BIDDING' &&
        gameState.phase !== 'DOUBLING' &&
        gameState.phase !== 'PLAYING'
      ) {
        set({ aiThinkingSeat: null });
        return;
      }

      const seat = gameState.currentTurn;
      if (seat === 0) {
        set({ aiThinkingSeat: null });
        if (get().coachPanelOpen && gameState.phase === 'PLAYING') {
          get().requestLiveCoach();
        }
        return;
      }

      set({ aiThinkingSeat: seat });
      const difficulty: AIDifficulty =
        matchMode === 'puzzle' ? 'master' : useDoudizhuProfileStore.getState().difficulty;
      const delayMs = matchMode === 'puzzle' ? 500 : 650 + Math.floor(Math.random() * 450);

      void (async () => {
        if (gameState.phase === 'BIDDING') {
          const [bid] = await Promise.all([requestAIBid(gameState, seat, difficulty), sleep(delayMs)]);
          if (get().sessionToken !== sessionToken) return;

          const isFirstCall = gameState.firstCallerSeat === null;
          doudizhuSpeech.announceBid(bid, isFirstCall);
          soundEngine.playSelect();

          const label =
            bid === 'CALL' ? '叫地主' : bid === 'GRAB' ? '抢地主' : isFirstCall ? '不叫' : '不抢';
          const prevRedeal = gameState.redealCount;
          const next = applyBidAction(gameState, seat, bid);

          if (next.redealCount > prevRedeal) {
            soundEngine.playDeal();
            set({ tablePlays: [null, null, null], seatBubbles: [null, null, null] });
            showBubble(seat, '全不叫 · 重新发牌', sessionToken);
          } else {
            showBubble(seat, label, sessionToken);
          }
          commitState(next, sessionToken);
          get().runAITurnIfNeeded();
          return;
        }

        if (gameState.phase === 'DOUBLING') {
          const [choice] = await Promise.all([
            requestAIDouble(gameState, seat, difficulty),
            sleep(550),
          ]);
          if (get().sessionToken !== sessionToken) return;
          doudizhuSpeech.announceDouble(choice);
          soundEngine.playSelect();
          showBubble(
            seat,
            choice === 4 ? '超级加倍' : choice === 2 ? '加倍' : '不加倍',
            sessionToken,
          );
          const next = applyDoubleChoice(gameState, seat, choice);
          commitState(next, sessionToken);
          get().runAITurnIfNeeded();
          return;
        }

        const [decision] = await Promise.all([
          requestAIMove(gameState, seat, difficulty),
          sleep(delayMs),
        ]);
        if (get().sessionToken !== sessionToken) return;

        if (decision.isPass) {
          soundEngine.playPass();
          doudizhuSpeech.announcePass();
          showBubble(seat, '不要', sessionToken);
          const next = applyPassTurn(gameState, seat);
          const nextTablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] =
            next.lastPlay === null
              ? [null, null, null]
              : ([
                  get().tablePlays[0],
                  seat === 1 ? null : get().tablePlays[1],
                  seat === 2 ? null : get().tablePlays[2],
                ] as [HandPattern | null, HandPattern | null, HandPattern | null]);
          set({ tablePlays: nextTablePlays });
          commitState(next, sessionToken);
        } else {
          const next = applyPlayCards(gameState, seat, decision.cards);
          const nextTablePlays: [HandPattern | null, HandPattern | null, HandPattern | null] =
            gameState.lastPlay === null
              ? [null, seat === 1 ? decision.pattern : null, seat === 2 ? decision.pattern : null]
              : ([
                  get().tablePlays[0],
                  seat === 1 ? decision.pattern : get().tablePlays[1],
                  seat === 2 ? decision.pattern : get().tablePlays[2],
                ] as [HandPattern | null, HandPattern | null, HandPattern | null]);
          set({ tablePlays: nextTablePlays });
          if (decision.pattern) {
            triggerPatternFeedback(seat, decision.pattern, next.hands[seat].length);
          }
          commitState(next, sessionToken);
        }

        get().runAITurnIfNeeded();
      })();
    },
  };
});

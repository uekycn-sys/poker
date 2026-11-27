import { BidAction, DoubleChoice, GameState, Seat } from './types';
import { AIDifficulty, AIMoveDecision, chooseBestMove, decideBidAction, decideDoubleChoice } from './ai';
import {
  BlunderReport,
  CoachAdvice,
  WinRateEvaluation,
  analyzeCoachRecommendation,
  analyzeMatchBlunders,
  evaluateWinRate,
} from './coach';
import type { AIWorkerRequest, AIWorkerResponse } from './ai.worker';

let nextRequestId = 1;
let workerInstance: Worker | null = null;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }
>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.type === 'ERROR') {
        entry.reject(new Error(msg.error));
      } else {
        entry.resolve(msg.result);
      }
    };
    workerInstance.onerror = (err) => {
      for (const [, entry] of pending) {
        entry.reject(err);
      }
      pending.clear();
    };
  }
  return workerInstance;
}

function callWorker<T>(buildReq: (id: number) => AIWorkerRequest, fallback: () => T): Promise<T> {
  const worker = getWorker();
  if (!worker) {
    return Promise.resolve(fallback());
  }
  const id = nextRequestId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (val) => resolve(val as T),
      reject,
    });
    worker.postMessage(buildReq(id));
  });
}

export function requestAIMove(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
): Promise<AIMoveDecision> {
  return callWorker(
    (id) => ({ id, type: 'CHOOSE_MOVE', state, seat, difficulty }),
    () => chooseBestMove(state, seat, difficulty),
  );
}

export function requestAIBid(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
): Promise<BidAction> {
  return callWorker(
    (id) => ({ id, type: 'DECIDE_BID', state, seat, difficulty }),
    () => decideBidAction(state, seat, difficulty),
  );
}

export function requestAIDouble(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
): Promise<DoubleChoice> {
  return callWorker(
    (id) => ({ id, type: 'DECIDE_DOUBLE', state, seat, difficulty }),
    () => decideDoubleChoice(state, seat, difficulty),
  );
}

export function requestWinRate(
  state: GameState,
  perspectiveSeat: Seat = 0,
): Promise<WinRateEvaluation> {
  return callWorker(
    (id) => ({ id, type: 'EVALUATE_WIN_RATE', state, perspectiveSeat }),
    () => evaluateWinRate(state, perspectiveSeat),
  );
}

export function requestCoachAdvice(state: GameState, seat: Seat = 0): Promise<CoachAdvice> {
  return callWorker(
    (id) => ({ id, type: 'COACH_ANALYZE', state, seat }),
    () => analyzeCoachRecommendation(state, seat),
  );
}

export function requestBlunders(
  state: GameState,
  targetSeat: Seat = 0,
  maxBlunders = 3,
): Promise<BlunderReport[]> {
  return callWorker(
    (id) => ({ id, type: 'ANALYZE_BLUNDERS', state, targetSeat, maxBlunders }),
    () => analyzeMatchBlunders(state, targetSeat, maxBlunders),
  );
}

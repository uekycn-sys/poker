import { BidAction, DoubleChoice, GameState, Seat } from './types';
import {
  AIDifficulty,
  AIMoveDecision,
  ChooseMoveOptions,
  chooseBestMove,
  decideBidAction,
  decideDoubleChoice,
} from './ai';
import {
  BlunderReport,
  CoachAdvice,
  WinRateEvaluation,
  analyzeCoachRecommendation,
  analyzeMatchBlunders,
  evaluateWinRate,
} from './coach';
import {
  createResilientWorkerClient,
  type WorkerRequestOptions,
} from '../../../shared/workers/resilientWorker';
import type { AIWorkerRequest, AIWorkerResponse } from './ai.worker';

export type DoudizhuAIRequestOptions = WorkerRequestOptions;

const workerClient = createResilientWorkerClient<AIWorkerRequest, AIWorkerResponse>(
  () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
);

export function cancelDoudizhuAIRequests(): number {
  return workerClient.cancelPendingRequests({ terminateBusyWorker: true });
}

export function resetDoudizhuAIWorker(): void {
  workerClient.resetWorker();
}

export function requestAIMove(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
  options?: ChooseMoveOptions,
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<AIMoveDecision> {
  return workerClient.call(
    (id) => ({ id, type: 'CHOOSE_MOVE', state, seat, difficulty, options }),
    () => chooseBestMove(state, seat, difficulty, Math.random, options),
    requestOptions,
  );
}

export function requestAIBid(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<BidAction> {
  return workerClient.call(
    (id) => ({ id, type: 'DECIDE_BID', state, seat, difficulty }),
    () => decideBidAction(state, seat, difficulty),
    requestOptions,
  );
}

export function requestAIDouble(
  state: GameState,
  seat: Seat,
  difficulty: AIDifficulty = 'master',
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<DoubleChoice> {
  return workerClient.call(
    (id) => ({ id, type: 'DECIDE_DOUBLE', state, seat, difficulty }),
    () => decideDoubleChoice(state, seat, difficulty),
    requestOptions,
  );
}

export function requestWinRate(
  state: GameState,
  perspectiveSeat: Seat = 0,
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<WinRateEvaluation> {
  return workerClient.call(
    (id) => ({ id, type: 'EVALUATE_WIN_RATE', state, perspectiveSeat }),
    () => evaluateWinRate(state, perspectiveSeat),
    { supersedingKey: 'doudizhu-win-rate', ...requestOptions },
  );
}

export function requestCoachAdvice(
  state: GameState,
  seat: Seat = 0,
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<CoachAdvice> {
  return workerClient.call(
    (id) => ({ id, type: 'COACH_ANALYZE', state, seat }),
    () => analyzeCoachRecommendation(state, seat),
    { supersedingKey: 'doudizhu-coach', ...requestOptions },
  );
}

export function requestBlunders(
  state: GameState,
  targetSeat: Seat = 0,
  maxBlunders = 3,
  requestOptions?: DoudizhuAIRequestOptions,
): Promise<BlunderReport[]> {
  return workerClient.call(
    (id) => ({ id, type: 'ANALYZE_BLUNDERS', state, targetSeat, maxBlunders }),
    () => analyzeMatchBlunders(state, targetSeat, maxBlunders),
    { supersedingKey: 'doudizhu-blunders', ...requestOptions },
  );
}

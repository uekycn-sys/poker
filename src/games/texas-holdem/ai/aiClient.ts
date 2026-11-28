import { HandState, HoldemCard } from '../engine/types';
import { CoachAnalysis, analyzeCoachSpot } from './coach';
import { AiDecision, decideAiAction } from './decision';
import { EquityResult, calculateEquity } from './equity';
import { AiPersona } from './personas';
import {
  createResilientWorkerClient,
  type WorkerRequestOptions,
} from '../../../shared/workers/resilientWorker';
import type { HoldemWorkerRequest, HoldemWorkerResponse } from './ai.worker';

export type HoldemAIRequestOptions = WorkerRequestOptions;

const workerClient = createResilientWorkerClient<HoldemWorkerRequest, HoldemWorkerResponse>(
  () =>
    new Worker(new URL('./ai.worker.ts', import.meta.url), {
      type: 'module',
    }),
);

export function cancelHoldemAIRequests(): number {
  return workerClient.cancelPendingRequests({ terminateBusyWorker: true });
}

export function resetHoldemAIWorker(): void {
  workerClient.resetWorker();
}

export function requestAiDecision(
  state: HandState,
  seat: number,
  persona: AiPersona,
  iterations = 1000,
  requestOptions?: HoldemAIRequestOptions,
): Promise<AiDecision> {
  return workerClient.call(
    (id) => ({ id, type: 'DECIDE_AI', state, seat, persona, iterations }),
    () => decideAiAction(state, seat, persona, { iterations }),
    requestOptions,
  );
}

export function requestCoachAnalysis(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
  iterations = 1200,
  requestOptions?: HoldemAIRequestOptions,
): Promise<CoachAnalysis> {
  return workerClient.call(
    (id) => ({ id, type: 'COACH_ANALYZE', state, heroSeat, personasBySeat, iterations }),
    () => analyzeCoachSpot(state, heroSeat, personasBySeat, iterations),
    { supersedingKey: 'holdem-coach', ...requestOptions },
  );
}

export function requestEquity(
  heroCards: readonly HoldemCard[],
  boardCards: readonly HoldemCard[],
  numOpponents: number,
  iterations = 1200,
  requestOptions?: HoldemAIRequestOptions,
): Promise<EquityResult> {
  return workerClient.call(
    (id) => ({
      id,
      type: 'CALC_EQUITY',
      heroCards: [...heroCards],
      boardCards: [...boardCards],
      numOpponents,
      iterations,
    }),
    () => calculateEquity(heroCards, boardCards, numOpponents, iterations),
    requestOptions,
  );
}

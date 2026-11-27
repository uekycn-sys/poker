import { HandState, HoldemCard } from '../engine/types';
import { CoachAnalysis, analyzeCoachSpot } from './coach';
import { AiDecision, decideAiAction } from './decision';
import { EquityResult, calculateEquity } from './equity';
import { AiPersona } from './personas';
import type { HoldemWorkerRequest, HoldemWorkerResponse } from './ai.worker';

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
    workerInstance = new Worker(new URL('./ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerInstance.onmessage = (event: MessageEvent<HoldemWorkerResponse>) => {
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

function callWorker<T>(
  buildReq: (id: number) => HoldemWorkerRequest,
  fallback: () => T,
): Promise<T> {
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

export function requestAiDecision(
  state: HandState,
  seat: number,
  persona: AiPersona,
  iterations = 1000,
): Promise<AiDecision> {
  return callWorker(
    (id) => ({ id, type: 'DECIDE_AI', state, seat, persona, iterations }),
    () => decideAiAction(state, seat, persona, { iterations }),
  );
}

export function requestCoachAnalysis(
  state: HandState,
  heroSeat: number,
  personasBySeat: Record<number, AiPersona>,
  iterations = 1200,
): Promise<CoachAnalysis> {
  return callWorker(
    (id) => ({ id, type: 'COACH_ANALYZE', state, heroSeat, personasBySeat, iterations }),
    () => analyzeCoachSpot(state, heroSeat, personasBySeat, iterations),
  );
}

export function requestEquity(
  heroCards: readonly HoldemCard[],
  boardCards: readonly HoldemCard[],
  numOpponents: number,
  iterations = 1200,
): Promise<EquityResult> {
  return callWorker(
    (id) => ({
      id,
      type: 'CALC_EQUITY',
      heroCards: [...heroCards],
      boardCards: [...boardCards],
      numOpponents,
      iterations,
    }),
    () => calculateEquity(heroCards, boardCards, numOpponents, iterations),
  );
}

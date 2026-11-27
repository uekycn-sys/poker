import { HandState } from '../engine/types';
import { CoachAnalysis, analyzeCoachSpot } from './coach';
import { AiDecision, decideAiAction } from './decision';
import { EquityResult, calculateEquity } from './equity';
import { AiPersona } from './personas';

export type HoldemWorkerRequest =
  | {
      id: number;
      type: 'DECIDE_AI';
      state: HandState;
      seat: number;
      persona: AiPersona;
      iterations?: number;
    }
  | {
      id: number;
      type: 'COACH_ANALYZE';
      state: HandState;
      heroSeat: number;
      personasBySeat: Record<number, AiPersona>;
      iterations?: number;
    }
  | {
      id: number;
      type: 'CALC_EQUITY';
      heroCards: HandState['players'][number]['holeCards'];
      boardCards: HandState['communityCards'];
      numOpponents: number;
      iterations?: number;
    };

export type HoldemWorkerResponse =
  | { id: number; type: 'DECIDE_AI'; result: AiDecision }
  | { id: number; type: 'COACH_ANALYZE'; result: CoachAnalysis }
  | { id: number; type: 'CALC_EQUITY'; result: EquityResult }
  | { id: number; type: 'ERROR'; error: string };

self.onmessage = (event: MessageEvent<HoldemWorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'DECIDE_AI': {
        const result = decideAiAction(req.state, req.seat, req.persona, {
          iterations: req.iterations ?? 1000,
        });
        self.postMessage({ id: req.id, type: req.type, result } satisfies HoldemWorkerResponse);
        break;
      }
      case 'COACH_ANALYZE': {
        const result = analyzeCoachSpot(
          req.state,
          req.heroSeat,
          req.personasBySeat,
          req.iterations ?? 1200,
        );
        self.postMessage({ id: req.id, type: req.type, result } satisfies HoldemWorkerResponse);
        break;
      }
      case 'CALC_EQUITY': {
        const result = calculateEquity(
          req.heroCards,
          req.boardCards,
          req.numOpponents,
          req.iterations ?? 1200,
        );
        self.postMessage({ id: req.id, type: req.type, result } satisfies HoldemWorkerResponse);
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    } satisfies HoldemWorkerResponse);
  }
};

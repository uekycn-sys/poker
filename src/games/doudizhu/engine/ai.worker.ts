import { BidAction, DoubleChoice, GameState, Seat } from './types';
import { AIDifficulty, AIMoveDecision, ChooseMoveOptions, chooseBestMove, decideBidAction, decideDoubleChoice } from './ai';
import {
  BlunderReport,
  CoachAdvice,
  WinRateEvaluation,
  analyzeCoachRecommendation,
  analyzeMatchBlunders,
  evaluateWinRate,
} from './coach';

export type AIWorkerRequest =
  | { id: number; type: 'CHOOSE_MOVE'; state: GameState; seat: Seat; difficulty: AIDifficulty; options?: ChooseMoveOptions }
  | { id: number; type: 'DECIDE_BID'; state: GameState; seat: Seat; difficulty: AIDifficulty }
  | { id: number; type: 'DECIDE_DOUBLE'; state: GameState; seat: Seat; difficulty: AIDifficulty }
  | { id: number; type: 'EVALUATE_WIN_RATE'; state: GameState; perspectiveSeat: Seat }
  | { id: number; type: 'COACH_ANALYZE'; state: GameState; seat: Seat }
  | { id: number; type: 'ANALYZE_BLUNDERS'; state: GameState; targetSeat: Seat; maxBlunders: number };

export type AIWorkerResponse =
  | { id: number; type: 'CHOOSE_MOVE'; result: AIMoveDecision }
  | { id: number; type: 'DECIDE_BID'; result: BidAction }
  | { id: number; type: 'DECIDE_DOUBLE'; result: DoubleChoice }
  | { id: number; type: 'EVALUATE_WIN_RATE'; result: WinRateEvaluation }
  | { id: number; type: 'COACH_ANALYZE'; result: CoachAdvice }
  | { id: number; type: 'ANALYZE_BLUNDERS'; result: BlunderReport[] }
  | { id: number; type: 'ERROR'; error: string };

self.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'CHOOSE_MOVE': {
        const result = chooseBestMove(req.state, req.seat, req.difficulty, Math.random, req.options);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
      case 'DECIDE_BID': {
        const result = decideBidAction(req.state, req.seat, req.difficulty);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
      case 'DECIDE_DOUBLE': {
        const result = decideDoubleChoice(req.state, req.seat, req.difficulty);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
      case 'EVALUATE_WIN_RATE': {
        const result = evaluateWinRate(req.state, req.perspectiveSeat);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
      case 'COACH_ANALYZE': {
        const result = analyzeCoachRecommendation(req.state, req.seat);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
      case 'ANALYZE_BLUNDERS': {
        const result = analyzeMatchBlunders(req.state, req.targetSeat, req.maxBlunders);
        self.postMessage({ id: req.id, type: req.type, result } satisfies AIWorkerResponse);
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    } satisfies AIWorkerResponse);
  }
};

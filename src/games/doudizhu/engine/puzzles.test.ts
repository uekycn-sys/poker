import { describe, expect, it } from 'vitest';
import {
  ENDGAME_PUZZLES,
  Rank,
  applyPassTurn,
  applyPlayCards,
  buildPuzzleGameState,
  generateCandidateMoves,
  matchPatternToBeat,
  parseCards,
  solveEndgameAlphaBeta,
} from './index';

function selectMatchingCardsFromHand(hand: ReturnType<typeof parseCards>, notation: string) {
  const wanted = parseCards(notation);
  const pool = [...hand];
  return wanted.map((w) => {
    const idx = pool.findIndex((c) => c.rank === w.rank);
    if (idx === -1) {
      throw new Error(`Hand missing rank ${w.rank} for notation "${notation}"`);
    }
    const [picked] = pool.splice(idx, 1);
    return picked;
  });
}

describe('10 Classic Endgame Puzzles Verification', () => {
  it('defines 10 unique puzzles with valid non-overlapping decks', () => {
    expect(ENDGAME_PUZZLES).toHaveLength(10);
    const ids = new Set(ENDGAME_PUZZLES.map((p) => p.id));
    expect(ids.size).toBe(10);

    for (const puzzle of ENDGAME_PUZZLES) {
      const state = buildPuzzleGameState(puzzle);
      const allCards = [
        ...state.hands[0],
        ...state.hands[1],
        ...state.hands[2],
        ...(state.lastPlay?.pattern.cards ?? []),
      ];
      const cardIds = new Set(allCards.map((c) => c.id));
      expect(cardIds.size).toBe(allCards.length);
    }
  });

  it('proves every puzzle has a forced win and verifies its documented winning first move', () => {
    let nonTrivialCount = 0;

    for (const puzzle of ENDGAME_PUZZLES) {
      const state = buildPuzzleGameState(puzzle);
      const rootSolve = solveEndgameAlphaBeta(state, 0, 60000, 800, 9);
      expect(rootSolve, `${puzzle.id} (${puzzle.title}) should be winnable`).not.toBeNull();
      expect(rootSolve!.solvedOutcome, `${puzzle.id} root outcome`).toBe('WIN');

      let afterFirstMove;
      if (puzzle.verifiedFirstMove === 'PASS') {
        expect(state.lastPlay, `${puzzle.id} PASS requires active lastPlay`).not.toBeNull();
        afterFirstMove = applyPassTurn(state, 0);
      } else {
        const cards = selectMatchingCardsFromHand(state.hands[0], puzzle.verifiedFirstMove);
        const matched = matchPatternToBeat(cards, state.lastPlay?.pattern ?? null);
        expect(matched, `${puzzle.id} verifiedFirstMove must be legal`).not.toBeNull();
        afterFirstMove = applyPlayCards(state, 0, cards);
      }

      if (afterFirstMove.phase === 'FINISHED') {
        expect(afterFirstMove.settlement?.winnerRole).toBe(
          puzzle.landlordSeat === 0 ? 'landlord' : 'farmer',
        );
      } else {
        // From next player's perspective: if next player is opponent, opponent must be in LOSS;
        // if next player is teammate (farmer), teammate must be in WIN!
        const nextTurn = afterFirstMove.currentTurn;
        const nextIsTeammate =
          puzzle.landlordSeat !== 0 && nextTurn !== puzzle.landlordSeat;
        const nextSolve = solveEndgameAlphaBeta(afterFirstMove, nextTurn, 60000, 800, 9);
        expect(nextSolve, `${puzzle.id} post-move should resolve`).not.toBeNull();
        expect(
          nextSolve!.solvedOutcome,
          `${puzzle.id} (${puzzle.title}) verifiedFirstMove "${puzzle.verifiedFirstMove}" must force win`,
        ).toBe(nextIsTeammate ? 'WIN' : 'LOSS');
      }

      // Check whether at least one losing alternative exists (non-trivial puzzle)
      const candidates = generateCandidateMoves(state.hands[0], state.lastPlay?.pattern ?? null);
      let hasLosingMove = false;
      for (const cand of candidates) {
        if (cand.cards.length === state.hands[0].length) continue;
        const altState = applyPlayCards(state, 0, cand.cards);
        const nextTurn = altState.currentTurn;
        const nextIsTeammate = puzzle.landlordSeat !== 0 && nextTurn !== puzzle.landlordSeat;
        const altSolve = solveEndgameAlphaBeta(altState, nextTurn, 30000, 300, 9);
        if (altSolve && altSolve.solvedOutcome === (nextIsTeammate ? 'LOSS' : 'WIN')) {
          hasLosingMove = true;
          break;
        }
      }
      if (!hasLosingMove && state.lastPlay !== null && puzzle.verifiedFirstMove !== 'PASS') {
        const altPass = applyPassTurn(state, 0);
        const nextTurn = altPass.currentTurn;
        const nextIsTeammate = puzzle.landlordSeat !== 0 && nextTurn !== puzzle.landlordSeat;
        const altSolve = solveEndgameAlphaBeta(altPass, nextTurn, 30000, 300, 9);
        if (altSolve && altSolve.solvedOutcome === (nextIsTeammate ? 'LOSS' : 'WIN')) {
          hasLosingMove = true;
        }
      }
      if (hasLosingMove) nonTrivialCount++;

      void Rank;
    }

    expect(nonTrivialCount).toBeGreaterThanOrEqual(8);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, parseCards } from '../engine';
import { useDoudizhuGameStore } from './doudizhuGameStore';

describe('useDoudizhuGameStore interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDoudizhuGameStore.getState().resetSession();
  });

  afterEach(() => {
    useDoudizhuGameStore.getState().resetSession();
    vi.useRealTimers();
  });

  it('activates 2x mingpai before landlord plays their first card', () => {
    const base = createInitialGameState(100);
    const playingState = {
      ...base,
      phase: 'PLAYING' as const,
      landlordSeat: 0 as const,
      currentTurn: 0 as const,
      hands: [
        parseCards('2 A K'),
        parseCards('Q J 10'),
        parseCards('9 8 7'),
      ] as [ReturnType<typeof parseCards>, ReturnType<typeof parseCards>, ReturnType<typeof parseCards>],
      playCounts: [0, 0, 0] as [number, number, number],
    };

    useDoudizhuGameStore.setState({
      screen: 'table',
      matchMode: 'standard',
      gameState: playingState,
    });

    useDoudizhuGameStore.getState().humanMingpai();
    const updated = useDoudizhuGameStore.getState();
    expect(updated.gameState.mingpaiSeats).toContain(0);
    expect(updated.gameState.mingpaiMultiplier).toBe(2);
    expect(updated.seatBubbles[0]).toBe('明牌 ×2');
  });

  it('auto-plays with intermediate AI when autoPlay is enabled and cancels on manual interaction', async () => {
    const base = createInitialGameState(100);
    const playingState = {
      ...base,
      phase: 'PLAYING' as const,
      landlordSeat: 0 as const,
      currentTurn: 0 as const,
      hands: [
        parseCards('3 4'),
        parseCards('K Q'),
        parseCards('A 2'),
      ] as [ReturnType<typeof parseCards>, ReturnType<typeof parseCards>, ReturnType<typeof parseCards>],
      playCounts: [0, 0, 0] as [number, number, number],
    };

    useDoudizhuGameStore.setState({
      screen: 'table',
      matchMode: 'standard',
      gameState: playingState,
      autoPlay: false,
      aiThinkingSeat: null,
    });

    // Enable autoPlay on human turn
    useDoudizhuGameStore.getState().toggleAutoPlay();
    expect(useDoudizhuGameStore.getState().autoPlay).toBe(true);

    // Clicking a card manually cancels autoPlay before the 500ms timer executes
    useDoudizhuGameStore.getState().toggleCardSelection(playingState.hands[0][0].id);
    expect(useDoudizhuGameStore.getState().autoPlay).toBe(false);
    expect(useDoudizhuGameStore.getState().selectedCardIds).toEqual([playingState.hands[0][0].id]);

    // Advance timer past 500ms; cancelled autoPlay must NOT play cards
    await vi.advanceTimersByTimeAsync(600);
    expect(useDoudizhuGameStore.getState().gameState.hands[0]).toHaveLength(2);
    expect(useDoudizhuGameStore.getState().gameState.currentTurn).toBe(0);

    // Re-enable autoPlay and let it execute after 500ms
    useDoudizhuGameStore.getState().toggleAutoPlay();
    await vi.advanceTimersByTimeAsync(600);
    expect(useDoudizhuGameStore.getState().gameState.hands[0].length).toBeLessThan(2);
  });
});

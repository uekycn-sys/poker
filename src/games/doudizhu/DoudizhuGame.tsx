import React, { useEffect } from 'react';
import { GameEntryProps } from '../types';
import { useDoudizhuGameStore } from './store/doudizhuGameStore';
import { DoudizhuHub } from './components/DoudizhuHub';
import { GameTable } from './components/GameTable';
import { PuzzleLobby } from './components/PuzzleLobby';
import { ReplayScreen } from './components/ReplayScreen';

export const DoudizhuGame: React.FC<GameEntryProps> = ({ onExitToLobby, launchOptions }) => {
  const screen = useDoudizhuGameStore((s) => s.screen);
  const startMatch = useDoudizhuGameStore((s) => s.startMatch);
  const openPuzzlesScreen = useDoudizhuGameStore((s) => s.openPuzzlesScreen);
  const openReplayScreen = useDoudizhuGameStore((s) => s.openReplayScreen);
  const returnToHub = useDoudizhuGameStore((s) => s.returnToHub);
  const resetSession = useDoudizhuGameStore((s) => s.resetSession);

  useEffect(() => {
    const view = launchOptions?.initialView;
    const stake = launchOptions?.initialStake;

    if (view === 'table') {
      startMatch(undefined, stake);
    } else if (view === 'puzzles') {
      openPuzzlesScreen();
    } else if (view === 'replay') {
      openReplayScreen();
    } else {
      returnToHub();
    }

    return () => {
      resetSession();
    };
  }, [
    launchOptions?.initialView,
    launchOptions?.initialStake,
    startMatch,
    openPuzzlesScreen,
    openReplayScreen,
    returnToHub,
    resetSession,
  ]);

  return (
    <>
      {screen === 'hub' && <DoudizhuHub onExitToLobby={onExitToLobby} />}
      {screen === 'table' && <GameTable onExitToLobby={onExitToLobby} />}
      {screen === 'puzzles' && <PuzzleLobby onExitToLobby={onExitToLobby} />}
      {screen === 'replay' && <ReplayScreen onExitToLobby={onExitToLobby} />}
    </>
  );
};

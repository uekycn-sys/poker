import React, { useEffect } from 'react';
import { GameEntryProps } from '../types';
import { HoldemHub } from './components/HoldemHub';
import { HoldemReplayScreen } from './components/HandReviewModal';
import { HoldemTable } from './components/HoldemTable';
import { useHoldemGameStore } from './store/holdemGameStore';
import { useHoldemProfileStore } from './store/holdemProfileStore';

export const TexasHoldemGame: React.FC<GameEntryProps> = ({
  onExitToLobby,
  launchOptions,
}) => {
  const screen = useHoldemGameStore((s) => s.screen);
  const selectedReplayHandId = useHoldemGameStore((s) => s.selectedReplayHandId);
  const openHub = useHoldemGameStore((s) => s.openHub);
  const startTable = useHoldemGameStore((s) => s.startTable);
  const openReplayScreen = useHoldemGameStore((s) => s.openReplayScreen);
  const selectReplayHand = useHoldemGameStore((s) => s.selectReplayHand);
  const branchFromStreet = useHoldemGameStore((s) => s.branchFromStreet);
  const resetSession = useHoldemGameStore((s) => s.resetSession);

  const recentHands = useHoldemProfileStore((s) => s.recentHands);
  const setOutsQuizEnabled = useHoldemProfileStore((s) => s.setOutsQuizEnabled);

  useEffect(() => {
    const view = launchOptions?.initialView;
    const stake = launchOptions?.initialStake;

    if (view === 'table') {
      startTable(stake);
    } else if (view === 'quiz') {
      setOutsQuizEnabled(true);
      startTable(stake);
    } else if (view === 'replay') {
      openReplayScreen();
    } else {
      openHub();
    }

    return () => {
      resetSession();
    };
  }, [
    launchOptions?.initialView,
    launchOptions?.initialStake,
    startTable,
    openReplayScreen,
    openHub,
    resetSession,
    setOutsQuizEnabled,
  ]);

  return (
    <>
      {screen === 'hub' && <HoldemHub onExitToLobby={onExitToLobby} />}
      {screen === 'table' && <HoldemTable onExitToLobby={onExitToLobby} />}
      {screen === 'replay' && (
        <HoldemReplayScreen
          hands={recentHands}
          selectedHandId={selectedReplayHandId}
          onSelectHand={selectReplayHand}
          onBranchFromStreet={branchFromStreet}
          onBack={openHub}
        />
      )}
    </>
  );
};

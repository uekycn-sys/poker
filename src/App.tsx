import { useEffect } from 'react';
import { soundEngine } from './audio/soundEngine';
import { speechEngine } from './audio/speechEngine';
import { useProfileStore } from './store/profileStore';
import { useGameStore } from './store/gameStore';
import { LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/table/GameTable';
import { BankruptcyAidModal } from './components/table/BankruptcyAidModal';
import { PuzzleLobby } from './components/puzzles/PuzzleLobby';
import { ReplayScreen } from './components/replay/ReplayScreen';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const sfxEnabled = useProfileStore((s) => s.sfxEnabled);
  const voiceEnabled = useProfileStore((s) => s.voiceEnabled);

  useEffect(() => {
    soundEngine.setEnabled(sfxEnabled);
    speechEngine.setEnabled(voiceEnabled);
  }, [sfxEnabled, voiceEnabled]);

  return (
    <>
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'table' && <GameTable />}
      {screen === 'puzzles' && <PuzzleLobby />}
      {screen === 'replay' && <ReplayScreen />}
      <BankruptcyAidModal />
    </>
  );
}

export default App;

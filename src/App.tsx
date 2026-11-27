import { useCallback, useEffect, useState } from 'react';
import {
  BankruptcyAidModal,
  soundEngine,
  speechEngine,
  usePlayerStore,
} from './shared';
import { GameLaunchOptions, getGameById } from './games';
import { Lobby } from './pages/Lobby';

function parseHashGameId(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = /^#\/game\/([a-z0-9-]+)$/i.exec(hash);
  if (!match) return null;
  const game = getGameById(match[1]);
  return game && game.status === 'available' && game.component ? game.id : null;
}

export function App() {
  const sfxEnabled = usePlayerStore((s) => s.sfxEnabled);
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);

  const [activeGameId, setActiveGameId] = useState<string | null>(() => parseHashGameId());
  const [launchOptions, setLaunchOptions] = useState<GameLaunchOptions | undefined>(undefined);

  useEffect(() => {
    soundEngine.setEnabled(sfxEnabled);
    speechEngine.setEnabled(voiceEnabled);
  }, [sfxEnabled, voiceEnabled]);

  useEffect(() => {
    const onHashChange = () => {
      setActiveGameId(parseHashGameId());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleLaunchGame = useCallback((gameId: string, options?: GameLaunchOptions) => {
    const target = getGameById(gameId);
    if (!target || target.status !== 'available' || !target.component) return;
    setLaunchOptions(options);
    setActiveGameId(gameId);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/game/${gameId}`;
    }
  }, []);

  const handleExitToLobby = useCallback(() => {
    setLaunchOptions(undefined);
    setActiveGameId(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    }
  }, []);

  const activeGame = getGameById(activeGameId);
  const ActiveComponent =
    activeGame && activeGame.status === 'available' ? activeGame.component : undefined;

  return (
    <>
      {ActiveComponent ? (
        <ActiveComponent onExitToLobby={handleExitToLobby} launchOptions={launchOptions} />
      ) : (
        <Lobby onLaunchGame={handleLaunchGame} />
      )}
      <BankruptcyAidModal />
    </>
  );
}

export default App;

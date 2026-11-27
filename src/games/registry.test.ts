import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, getAvailableGames, getGameById, getUpcomingGames } from './registry';
import { getRankTier, usePlayerStore } from '../shared/store/playerStore';

describe('Poker Master Suite Registry', () => {
  it('registers only implemented doudizhu and texas-holdem games with valid metadata', () => {
    expect(GAME_REGISTRY).toHaveLength(2);

    const doudizhu = getGameById('doudizhu');
    expect(doudizhu).toBeDefined();
    expect(doudizhu?.status).toBe('available');
    expect(doudizhu?.component).toBeDefined();
    expect(doudizhu?.stakes.length).toBeGreaterThan(0);

    const holdem = getGameById('texas-holdem');
    expect(holdem).toBeDefined();
    expect(holdem?.status).toBe('available');
    expect(holdem?.component).toBeDefined();
    expect(holdem?.stakes.length).toBeGreaterThan(0);

    const available = getAvailableGames();
    expect(available.map((g) => g.id)).toEqual(['doudizhu', 'texas-holdem']);

    const upcoming = getUpcomingGames();
    expect(upcoming).toHaveLength(0);

    for (const game of GAME_REGISTRY) {
      expect(game.trainingPitch.length).toBeGreaterThan(0);
      expect(game.stakes.length).toBeGreaterThan(0);
    }
  });
});

describe('Global Player Store', () => {
  it('computes rank tiers, records game results, unlocks achievements, and triggers bankruptcy aid', () => {
    const bronze = getRankTier(100);
    expect(bronze.name).toBe('青铜');

    const master = getRankTier(2100);
    expect(master.name).toBe('大师');

    usePlayerStore.setState({
      chips: 1500,
      rankPoints: 100,
      totalMatches: 0,
      totalWins: 0,
      currentStreak: 0,
      bestStreak: 0,
      perGameStats: {},
      unlockedAchievements: [],
      pendingAidAnimation: false,
      lastAidGrant: 0,
    });

    usePlayerStore.getState().recordGameResult({
      gameId: 'doudizhu',
      won: true,
      chipDelta: 300,
      rankPointDelta: 45,
      extraAchievements: ['spring_king'],
    });

    let state = usePlayerStore.getState();
    expect(state.chips).toBe(1800);
    expect(state.totalMatches).toBe(1);
    expect(state.totalWins).toBe(1);
    expect(state.perGameStats.doudizhu).toEqual({ matches: 1, wins: 1, netChips: 300 });
    expect(state.unlockedAchievements).toEqual(
      expect.arrayContaining(['first_win', 'spring_king']),
    );

    // Drop chips below 1000 to trigger automatic bankruptcy aid (+3000)
    usePlayerStore.getState().recordGameResult({
      gameId: 'doudizhu',
      won: false,
      chipDelta: -1000,
      rankPointDelta: -20,
    });

    state = usePlayerStore.getState();
    expect(state.pendingAidAnimation).toBe(true);
    expect(state.lastAidGrant).toBe(3000);
    expect(state.chips).toBe(3800);
  });
});

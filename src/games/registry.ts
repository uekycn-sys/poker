import { GameModuleMeta } from './types';
import { doudizhuMeta } from './doudizhu';
import { texasHoldemMeta } from './texas-holdem';

/**
 * Central game registry for Poker Master Suite.
 */
export const GAME_REGISTRY: GameModuleMeta[] = [
  doudizhuMeta,
  texasHoldemMeta,
];

export function getGameById(id: string | null | undefined): GameModuleMeta | undefined {
  if (!id) return undefined;
  return GAME_REGISTRY.find((g) => g.id === id);
}

export function getAvailableGames(): GameModuleMeta[] {
  return GAME_REGISTRY.filter((g) => g.status === 'available');
}

export function getUpcomingGames(): GameModuleMeta[] {
  return GAME_REGISTRY.filter((g) => g.status === 'coming_soon');
}

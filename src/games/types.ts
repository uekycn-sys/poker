import type React from 'react';

export interface GameStakeConfig {
  id: string;
  name: string;
  baseBet: number;
  minChips: number;
  tag?: string;
}

export interface GameLaunchOptions {
  initialStake?: number;
  initialView?: string;
}

export interface GameEntryProps {
  onExitToLobby: () => void;
  launchOptions?: GameLaunchOptions;
}

export interface GameModuleMeta {
  /** Unique route/registry identifier, e.g. 'doudizhu', 'texas-holdem', 'guandan', 'blackjack'. */
  id: string;
  /** Primary Chinese display title. */
  name: string;
  /** English subtitle / club nameplate. */
  englishName: string;
  /** Short subtitle shown on cards. */
  subtitle: string;
  /** Detailed overview of rules & training mode. */
  description: string;
  /** Feature badges displayed on the lobby card. */
  tags: string[];
  /** Core card-training selling point highlighted in the lobby. */
  trainingPitch: string;
  /** Skill difficulty label. */
  difficulty: '入门' | '进阶' | '硬核' | '大师';
  /** 1-5 star difficulty rating. */
  difficultyStars: 1 | 2 | 3 | 4 | 5;
  /** Seat/player count text, e.g. '3人局' / '2-6人局'. */
  playerCount: string;
  /** Deck specification, e.g. '1副牌 · 54张' / '2副牌 · 108张'. */
  deckInfo: string;
  /** Available stake tiers for quick-entry from the lobby. */
  stakes: GameStakeConfig[];
  /** Launch readiness status. */
  status: 'available' | 'coming_soon';
  /** Visual accent theme for the club card. */
  accent: 'gold' | 'emerald' | 'crimson' | 'sapphire';
  /** Optional quick-action sub-views (e.g. Puzzles, Replay). */
  quickLinks?: Array<{ id: string; label: string; view: string }>;
  /** Root React component mounted when launching this game module. */
  component?: React.ComponentType<GameEntryProps>;
}

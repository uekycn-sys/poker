import { GameModuleMeta } from '../types';
import { DoudizhuGame } from './DoudizhuGame';

export const doudizhuMeta: GameModuleMeta = {
  id: 'doudizhu',
  name: '欢乐斗地主',
  englishName: 'DOUDIZHU MASTER',
  subtitle: '经典三人叫抢 · AI 实时教练与残局算杀',
  description:
    '集成手牌拆解、守门员顶牌配合、三档记牌盲测、实时胜率条、10 道 Alpha-Beta 必胜残局以及上帝视角失误复盘。',
  tags: ['AI 实时教练', '10 道算杀残局', '盲记抽测', '上帝视角复盘'],
  trainingPitch: '手牌拆解 · 顶牌配合 · 残局 Alpha-Beta 算杀',
  difficulty: '进阶',
  difficultyStars: 4,
  playerCount: '3 人局',
  deckInfo: '1 副牌 · 54 张',
  stakes: [
    { id: 'novice', name: '新手场', baseBet: 50, minChips: 0, tag: '热身推荐' },
    { id: 'advanced', name: '进阶场', baseBet: 100, minChips: 1000, tag: '标准积分' },
    { id: 'master', name: '大师场', baseBet: 200, minChips: 3000, tag: '高倍冲击' },
  ],
  status: 'available',
  accent: 'gold',
  quickLinks: [
    { id: 'puzzles', label: '残局闯关', view: 'puzzles' },
    { id: 'replay', label: '牌谱复盘', view: 'replay' },
  ],
  component: DoudizhuGame,
};

export { DoudizhuGame };

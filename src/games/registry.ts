import { GameModuleMeta } from './types';
import { doudizhuMeta } from './doudizhu';

/**
 * Central plugin registry for Poker Master Suite.
 * To launch a new game (e.g. Texas Hold'em, Guandan, Blackjack):
 * 1. Implement `src/games/<game-id>/index.ts` exporting a `GameModuleMeta` with `status: 'available'` and `component`.
 * 2. Replace or append the entry in `GAME_REGISTRY` below.
 */
export const GAME_REGISTRY: GameModuleMeta[] = [
  doudizhuMeta,
  {
    id: 'texas-holdem',
    name: '德州扑克',
    englishName: 'TEXAS HOLD’EM GTO',
    subtitle: '翻前范围 · 底池赔率 · SPR 控池训练',
    description:
      '对标职业牌手训练室：支持翻前 GTO 起手范围提示、实时 Outs 与底池赔率计算、筹码 SPR 控池与诈唬平衡复盘。',
    tags: ['GTO 范围教练', 'Outs / 赔率计算', '多街复盘'],
    trainingPitch: '翻前范围 · 底池赔率 · SPR 控池与诈唬频率',
    difficulty: '硬核',
    difficultyStars: 5,
    playerCount: '2-6 人桌',
    deckInfo: '1 副牌 · 52 张（无大小王）',
    stakes: [
      { id: 'micro', name: '微额桌', baseBet: 20, minChips: 500, tag: '10/20 盲注' },
      { id: 'mid', name: '中额桌', baseBet: 100, minChips: 2000, tag: '50/100 盲注' },
      { id: 'high', name: '豪客桌', baseBet: 400, minChips: 10000, tag: '200/400 盲注' },
    ],
    status: 'coming_soon',
    accent: 'crimson',
  },
  {
    id: 'guandan',
    name: '大师掼蛋',
    englishName: 'GUANDAN PRO',
    subtitle: '两副牌 108 张 · 逢人配百搭组牌引擎',
    description:
      '支持红桃级牌“逢人配”百搭角标渲染与智能拆牌、同花顺优先级评估、双人配合喂牌与抗贡/进贡决策推演。',
    tags: ['两副牌支持', '逢人配百搭', '同花顺推演'],
    trainingPitch: '逢人配百搭组牌 · 同花顺拆解 · 队友喂牌配合',
    difficulty: '大师',
    difficultyStars: 5,
    playerCount: '4 人两队',
    deckInfo: '2 副牌 · 108 张（含百搭）',
    stakes: [
      { id: 'club', name: '俱乐部级', baseBet: 100, minChips: 1000 },
      { id: 'pro', name: '大师级', baseBet: 300, minChips: 5000 },
    ],
    status: 'coming_soon',
    accent: 'emerald',
  },
  {
    id: 'blackjack',
    name: '21 点大师桌',
    englishName: 'BLACKJACK 21',
    subtitle: '基本策略决策 · Hi-Lo 真数算牌训练',
    description:
      '采用多副牌鞋盒模拟真实赌场发牌分布，内置基本策略（Hit / Stand / Double / Split）即时纠偏与 Hi-Lo 真数算牌训练器。',
    tags: ['基本策略表', 'Hi-Lo 真数算牌', '多副牌鞋盒'],
    trainingPitch: '基本策略零失误 · Hi-Lo 真数算牌 · 凯利注码管理',
    difficulty: '入门',
    difficultyStars: 3,
    playerCount: '1 对庄家',
    deckInfo: '6 副牌鞋盒 · 312 张',
    stakes: [
      { id: 'casual', name: '练习桌', baseBet: 50, minChips: 0 },
      { id: 'vip', name: 'VIP 桌', baseBet: 500, minChips: 3000 },
    ],
    status: 'coming_soon',
    accent: 'sapphire',
  },
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

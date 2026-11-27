import { GameModuleMeta } from '../types';
import { TexasHoldemGame } from './TexasHoldemGame';

export const texasHoldemMeta: GameModuleMeta = {
  id: 'texas-holdem',
  name: '德州扑克 · GTO 大师训练营',
  englishName: 'TEXAS HOLD’EM GTO',
  subtitle: '6人桌无限注 · 翻前范围矩阵 · 底池赔率与 EV 复盘',
  description:
    '对标职业牌手训练室：完整 6-Max NLH 规则与多边池精准结算，内置 5 种鲜明风格 AI、13×13 翻前范围热力图、实时胜率与 Outs 盲测及四条街 EV 复盘重打。',
  tags: ['GTO 范围矩阵', '5 风格 HUD AI', 'Outs 8秒盲测', 'EV 复盘重打'],
  trainingPitch: '翻前范围 · 底池赔率 · Outs 盲测 · 对手剥削与 EV 复盘',
  difficulty: '硬核',
  difficultyStars: 5,
  playerCount: '6 人桌',
  deckInfo: '1 副牌 · 52 张（无大小王）',
  stakes: [
    { id: 'micro', name: '微额桌', baseBet: 20, minChips: 500, tag: '10/20 盲注' },
    { id: 'mid', name: '中额桌', baseBet: 100, minChips: 2000, tag: '50/100 盲注' },
    { id: 'high', name: '豪客桌', baseBet: 400, minChips: 10000, tag: '200/400 盲注' },
  ],
  status: 'available',
  accent: 'crimson',
  quickLinks: [
    { id: 'quiz', label: 'Outs 盲测', view: 'quiz' },
    { id: 'replay', label: 'EV 复盘', view: 'replay' },
  ],
  component: TexasHoldemGame,
};

export { TexasHoldemGame };

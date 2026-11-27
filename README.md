# Poker Master Suite · 多玩法棋牌大师俱乐部

一个纯前端、零后端依赖、插件化架构的多玩法棋牌训练与对战大厅（**Poker Master Suite**）。以深色高端俱乐部（暗祖母绿绒布 + 烫金卡片）为视觉基调，内置通用扑克牌渲染引擎、Web Audio 合成音效、Canvas 粒子特效、跨玩法资产与成就系统，以及可插拔的玩法注册表。

> 在线体验（GitHub Pages）：https://uekycn-sys.github.io/poker/

---

## 核心特性

### 1. 插件化多玩法棋牌大厅（`src/pages/Lobby.tsx`）
- **VIP 玩家资产栏**：SVG 俱乐部徽章头像（支持切换）、段位系统（青铜 → 白银 → 黄金 → 铂金 → 钻石 → 大师 → 牌圣）、通用金币/筹码余额（低于 1,000 自动触发每日 +3,000 破产补助动画）、总胜率与历史最高连胜统计。
- **跨玩法荣誉成就墙**：初露锋芒、势如破竹、俱乐部贵宾、大师殿堂、春天收割机、残局破壁者，自动持久化至 `localStorage`。
- **卡片式玩法矩阵**：直接读取 `src/games/registry.ts`，支持底注场次一键切换、一键入座开打、玩法专区与快捷子视图跳转（如残局闯关、上帝视角复盘）。

### 2. 已上线玩法：《欢乐斗地主 · 大师训练营》
- **完整规则与算番引擎**：支持 15 种合法牌型识别、叫/抢地主（含三家全不叫自动重新发牌）、明牌 ×4、加倍 / 超级加倍、炸弹 / 王炸、春天 / 反春精确结算。
- **三档 AI 与 Web Worker 异步算路**：休闲 / 进阶 / 大师 AI，集成手牌拆解器（`decomposer`）、守门员顶牌配合，所有重计算运行在 `ai.worker.ts` 中不阻塞 UI。
- **AI 实时教练与胜率条**：牌桌左侧 Chess.com 风格动态胜率条，随时开启 AI 教练获取最优出牌建议、战术标签与胜率预测。
- **三档记牌训练 & 盲记抽测**：全记牌 / 大牌模式 / 盲记抽测（关键回合弹出抽测，答对奖励 +500 通用金币）/ 关闭。
- **10 道 Alpha-Beta 算杀残局**：经过博弈树搜索严格验证的经典必胜残局（双王拆打、诱敌出炸、让牌控场等）。
- **上帝视角牌谱复盘**：自动保存最近 10 局实战牌谱，三家明牌回放、AI 自动诊断 1~3 处关键失误（Blunders），支持**从任意一手重新开打**。

---

## 目录结构

```text
src/
├── App.tsx                       # Hash 路由 (#/ 与 #/game/<id>) 与全局破产补助弹窗
├── index.css                     # 暗祖母绿俱乐部背景、烫金卡片样式与牌桌动画
├── pages/
│   └── Lobby.tsx                 # 商业级棋牌大厅首页
├── shared/                       # 零玩法耦合的通用基础设施层
│   ├── audio/
│   │   ├── soundEngine.ts        # Web Audio API 合成音效（选牌、甩牌、筹码、炸弹、王炸、胜负）
│   │   └── speechEngine.ts       # Web Speech API 通用语音播报器
│   ├── cards/
│   │   ├── types.ts              # 通用牌面数据结构（支持 deckIndex 多副牌与 isWild 百搭扩展）
│   │   └── PlayingCard.tsx       # SVG 扑克牌渲染组件（唯一 defs ID、多副牌角标、百搭/推荐徽章）
│   ├── components/
│   │   ├── BankruptcyAidModal.tsx# 全局破产补助动画弹窗
│   │   ├── ChipAnimation.tsx     # 金币/筹码余额浮动胶囊与粒子飞溅动画
│   │   ├── PlayerAvatar.tsx      # VIP 俱乐部 SVG 头像徽章
│   │   └── ReplayTimeline.tsx    # 通用复盘时间轴控制组件（支持失误红点标记）
│   ├── effects/
│   │   └── TableEffects.tsx      # Canvas 全屏粒子特效层（炸弹、王炸闪电、顺子、春天、All-In）
│   └── store/
│       └── playerStore.ts        # 全局资产、段位、成就与跨玩法统计 Zustand + localStorage Store
└── games/                        # 插件化玩法目录
    ├── types.ts                  # 统一玩法注册接口 GameModuleMeta / GameEntryProps
    ├── registry.ts               # 玩法中心注册表（上线新玩法只需在此注册）
    ├── registry.test.ts          # 注册表与全局玩家 Store 单元测试
    └── doudizhu/                 # 《欢乐斗地主》独立玩法模块
        ├── DoudizhuGame.tsx      # 玩法入口（处理 initialView / initialStake 与资源清理）
        ├── index.ts              # 导出 doudizhuMeta 与 DoudizhuGame
        ├── audio/                # 斗地主专属中文喊话规则
        ├── store/                # 斗地主对局状态与专属档案 Store
        ├── components/           # 牌桌、手牌滑动连选、玩家席位、记牌器、残局与复盘界面
        └── engine/               # 纯 TypeScript 规则引擎、AI、教练、残局与 Vitest 单元测试
```

---

## 新玩法接入指南

得益于 `GameModuleMeta` 插件契约，接入德州扑克、掼蛋、21 点等新玩法只需两步：

1. 在 `src/games/<your-game>/` 下实现玩法模块并导出符合 `GameModuleMeta` 的元数据对象（`status: 'available'` 及入口组件 `component`）：

```ts
import { GameModuleMeta } from '../types';
import { YourGameEntry } from './YourGameEntry';

export const yourGameMeta: GameModuleMeta = {
  id: 'texas-holdem',
  name: '德州扑克',
  englishName: 'TEXAS HOLD’EM GTO',
  subtitle: '翻前范围 · 底池赔率 · SPR 控池训练',
  description: '...',
  tags: ['GTO 范围教练', '底池赔率'],
  trainingPitch: '翻前范围 · 底池赔率 · SPR 控池与诈唬频率',
  difficulty: '硬核',
  difficultyStars: 5,
  playerCount: '2-6 人桌',
  deckInfo: '1 副牌 · 52 张',
  stakes: [{ id: 'micro', name: '微额桌', baseBet: 20, minChips: 500 }],
  status: 'available',
  accent: 'crimson',
  component: YourGameEntry,
};
```

2. 在 `src/games/registry.ts` 的 `GAME_REGISTRY` 中注册即可自动出现在大厅卡片矩阵与 Hash 路由 `#/game/<id>` 中；牌桌可直接复用 `src/shared/` 下的 `PlayingCard`、`soundEngine`、`TableEffects`、`ChipBalancePill`、`ReplayTimeline` 与 `usePlayerStore`。

---

## 玩法路线图

- [x] **欢乐斗地主**（`doudizhu`）：AI 实时教练、盲记抽测、10 道 Alpha-Beta 算杀残局、上帝视角复盘
- [ ] **德州扑克**（`texas-holdem`）：翻前 GTO 范围提示、Outs 与底池赔率、多街复盘
- [ ] **大师掼蛋**（`guandan`）：两副牌 108 张、逢人配百搭角标组牌引擎、同花顺拆解
- [ ] **21 点大师桌**（`blackjack`）：多副牌鞋盒、基本策略纠偏、Hi-Lo 真数算牌训练

---

## 本地开发与测试

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 运行全部 Vitest 单元测试（含 30 局全 AI 压测与 10 道残局算杀验证）
npm test

# TypeScript 类型检查 + Vite 生产打包
npm run build
```

## 技术栈
- **UI & 动效**：React 19 + TypeScript 5.7 + Tailwind CSS v4 + Framer Motion + Lucide Icons
- **状态管理**：Zustand（`persist` 中间件持久化至 `localStorage`）
- **算路与工程化**：Web Worker + Vite 7 + Vitest 3 + GitHub Actions 自动部署至 GitHub Pages

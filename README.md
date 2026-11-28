# Poker Master Suite · 多玩法棋牌大师俱乐部

一个纯前端、零后端依赖、插件化架构的多玩法棋牌训练与对战大厅（**Poker Master Suite**）。以深色高端俱乐部（暗祖母绿绒布 + 烫金卡片）为视觉基调，内置通用扑克牌渲染引擎、Web Audio 合成音效、Canvas 粒子特效、跨玩法资产与成就系统，以及可插拔的玩法注册表。

> 在线体验（GitHub Pages）：https://uekycn-sys.github.io/poker/

---

## 核心特性

### 1. 插件化多玩法棋牌大厅（`src/pages/Lobby.tsx`）
- **VIP 玩家资产栏**：SVG 俱乐部徽章头像（支持切换）、段位系统（青铜 → 白银 → 黄金 → 铂金 → 钻石 → 大师 → 牌圣）、通用金币/筹码余额（低于 1,000 自动触发每日 +3,000 破产补助动画）、总胜率与历史最高连胜统计。
- **跨玩法荣誉成就墙**：初露锋芒、势如破竹、俱乐部贵宾、大师殿堂、春天收割机、残局破壁者、德州初捷、算牌神童，自动持久化至 `localStorage`。
- **卡片式玩法矩阵**：直接读取 `src/games/registry.ts`，支持底注/盲注场次一键切换、一键入座开打、玩法专区与快捷子视图跳转（如残局闯关、Outs 盲测、牌谱/EV 复盘）。

### 2. 已上线玩法：《欢乐斗地主 · 大师训练营》（`src/games/doudizhu/`）
- **完整规则与算番引擎**：支持 15 种合法牌型识别、叫/抢地主（含三家全不叫自动重新发牌）、叫牌明牌 ×4 与**地主首手前明牌 ×2**、加倍 / 超级加倍、炸弹 / 王炸、春天 / 反春精确结算。
- **三档 AI 与高可用 Web Worker**：休闲 / 进阶 / 大师 AI，集成手牌拆解器（`decomposer`）、贝叶斯采样推理（`determinizer`）与守门员顶牌配合；所有重计算运行在 `ai.worker.ts` 中，支持**过期请求取消、3 秒超时自动降级同步计算与 Worker 自动重建**。
- **实用牌桌交互增强**：支持顶部 HUD 一键**“托管”**（轮到玩家时延迟 500ms 由进阶 AI 自动代打，点击任意手牌或按钮即刻取消）、手牌滑动连选与智能顺子/连对提炼、**牌桌空白区双击或右键快速清空选牌**。
- **AI 实时教练与胜率条**：牌桌左侧 Chess.com 风格动态胜率条，随时开启 AI 教练获取最优出牌建议、战术标签与胜率预测。
- **三档记牌训练 & 盲记抽测**：全记牌 / 大牌模式 / 盲记抽测（关键回合弹出抽测，答对奖励 +500 通用金币）/ 关闭。
- **10 道 Alpha-Beta 算杀残局**：经过博弈树搜索严格验证的经典必胜残局（双王拆打、诱敌出炸、让牌控场等）。
- **上帝视角牌谱复盘**：自动保存最近 10 局实战牌谱，三家明牌回放、AI 自动诊断 1~3 处关键失误（Blunders），支持**从任意一手重新开打**。

### 3. 已上线玩法：《德州扑克 · GTO 大师训练营》（`src/games/texas-holdem/`）
- **完整 6-Max 无限注德州引擎**：覆盖盲注轮转、最小加注步长、重开加注（Reopen）判定、All-In 与多边池（`sidePots.ts`）精准拆分结算；提供微额桌（10/20）、中额桌（50/100）、豪客桌（200/400）三档场次，支持**筹码 / 大盲倍数 (BB)** 一键切换显示。
- **5 位可剥削 AI 对手与 HUD 统计**：内置紧凶鲨鱼（TAG）、松凶海盗（LAG）、铁壁跟注站等 5 种风格鲜明 AI，牌桌头像实时累计 VPIP（入池率）与 PFR（翻前加注率），结合牌面湿润度（`boardTexture.ts`）与范围模型（`rangeModel.ts`）动态博弈。
- **职业 GTO 教练 HUD & 13×13 翻前范围矩阵**：异步蒙特卡洛胜率与底池赔率测算（运行在 `ai.worker.ts`，支持防竞态取消与超时降级），可随时展开 `PreflopRangeMatrix` 查看 UTG~BB 全位置率先开池与面对加注策略热力图。
- **8 秒 Outs 盲测训练**：翻牌/转牌击中听牌时锁定数学面板并弹出倒计时抽测，训练瞬间心算补牌数，累积训练积分并解锁成就。
- **四条街 EV 复盘与分支重打**：自动记录手牌与每条街快照（`streetSnapshots`），局后评估英雄决策与 EV 损失，支持**从翻前 / 翻牌 / 转牌 / 河牌任意节点切入重演**（分支训练不扣除俱乐部资产）。
- **沉浸式赌场视听**：实时行动播报条（`ActionTicker`）、All-In 聚光灯遮罩、心跳音效与摊牌大奖特效。

### 4. 多端适配、适老模式与桌面快捷键
- **移动端横屏自适应**：基于 `useStageViewport` 与响应式样式断点（`short-h` / `forced-l`），同时支持真横屏紧凑布局与手机竖屏自动旋转横屏舞台，搭配安全区适配及 `LandscapeHintOverlay` / `FullscreenButton` 一键原生全屏横屏。
- **适老大字清晰模式**：全局开关 `largeCardFont`（`data-elder-mode="true"`），一键放大牌面角标点数与花色并优化按钮字距与对比度，大厅与所有牌桌通用。
- **桌面端键盘快捷键**（输入框或下拉菜单聚焦时自动禁用）：
  - **斗地主牌桌**：`Space` 出牌（当前选牌合法时确认）、`Esc` 清空选牌、`H` 提示、`P` 不要（可过牌时）
  - **德州扑克牌桌**：`F` 弃牌、`C` 过牌 / 跟注、`R` 确认当前加注额度（或 All-In）、`M` 打开 / 关闭 13×13 GTO 范围矩阵

---

## 目录结构

```text
src/
├── App.tsx                       # Hash 路由 (#/ 与 #/game/<id>)、全局大字模式与横屏/补助弹窗
├── index.css                     # 暗祖母绿/红绒布俱乐部主题、响应式牌面尺寸与动画
├── pages/
│   └── Lobby.tsx                 # 商业级棋牌大厅首页
├── shared/                       # 零玩法耦合的通用基础设施层
│   ├── audio/
│   │   ├── soundEngine.ts        # Web Audio API 合成音效（选牌、甩牌、筹码、心跳、炸弹、胜负）
│   │   └── speechEngine.ts       # Web Speech API 通用语音播报器
│   ├── cards/
│   │   ├── types.ts              # 通用牌面数据结构（支持 deckIndex 多副牌与 isWild 百搭扩展）
│   │   └── PlayingCard.tsx       # SVG 扑克牌渲染组件（唯一 defs ID、大字模式、推荐/选中徽章）
│   ├── components/
│   │   ├── BankruptcyAidModal.tsx# 全局破产补助动画弹窗
│   │   ├── ChipAnimation.tsx     # 金币/筹码余额浮动胶囊与筹码堆动画
│   │   ├── FullscreenButton.tsx  # 一键全屏横屏按钮
│   │   ├── LandscapeHintOverlay.tsx # 竖屏旋转场景下的原生全屏横屏引导浮层
│   │   ├── PlayerAvatar.tsx      # VIP 俱乐部 SVG 头像徽章
│   │   └── ReplayTimeline.tsx    # 通用复盘时间轴控制组件（支持失误红点标记）
│   ├── effects/
│   │   └── TableEffects.tsx      # Canvas 全屏粒子特效层（炸弹、王炸闪电、顺子、春天、大奖）
│   ├── hooks/
│   │   ├── keyboard.ts           # 输入框焦点判断（桌面快捷键防误触）
│   │   └── useStageViewport.ts   # 舞台视口尺寸、短屏横屏与强制横屏状态同步
│   ├── workers/
│   │   └── resilientWorker.ts    # 通用抗竞态 Web Worker 客户端（取消、超时降级、自动重建）
│   └── store/
│       └── playerStore.ts        # 全局资产、段位、成就、大字/音效偏好 Zustand + localStorage Store
└── games/                        # 插件化玩法目录
    ├── types.ts                  # 统一玩法注册接口 GameModuleMeta / GameEntryProps
    ├── registry.ts               # 玩法中心注册表（上线新玩法只需在此注册）
    ├── registry.test.ts          # 注册表与全局玩家 Store 单元测试
    ├── doudizhu/                 # 《欢乐斗地主》独立玩法模块
    │   ├── DoudizhuGame.tsx      # 玩法入口（处理 initialView / initialStake 与资源清理）
    │   ├── index.ts              # 导出 doudizhuMeta 与 DoudizhuGame
    │   ├── audio/                # 斗地主专属中文喊话规则
    │   ├── store/                # 斗地主对局状态（含托管、AI 会话隔离）与档案 Store
    │   ├── components/           # 牌桌、手牌滑动连选、玩家席位、记牌器、残局与复盘界面
    │   └── engine/               # 规则引擎、AI、贝叶斯采样、教练、Worker 客户端、残局与单测
    └── texas-holdem/             # 《德州扑克 · GTO 大师训练营》独立玩法模块
        ├── TexasHoldemGame.tsx   # 玩法入口（处理 initialView / initialStake 与资源清理）
        ├── index.ts              # 导出 texasHoldemMeta 与 TexasHoldemGame
        ├── ai/                   # GTO 范围、牌面结构、蒙特卡洛胜率、教练、5 风格 AI 与 Worker 客户端
        ├── components/           # 6 人椭圆牌桌、加注控制栏、GTO HUD、13×13 矩阵、Outs 盲测与 EV 复盘
        ├── engine/               # NLH 规则引擎、7 牌牌力评估、边池拆分器与 Vitest 单元测试
        ├── store/                # 德州对局状态、街道快照分支重演与训练档案 Store
        └── utils/                # 筹码 / BB 格式化工具
```

---

## 新玩法接入指南

得益于 `GameModuleMeta` 插件契约，接入掼蛋、21 点等新玩法只需两步：

1. 在 `src/games/<your-game>/` 下实现玩法模块并导出符合 `GameModuleMeta` 的元数据对象（`status: 'available'` 及入口组件 `component`）：

```ts
import { GameModuleMeta } from '../types';
import { YourGameEntry } from './YourGameEntry';

export const yourGameMeta: GameModuleMeta = {
  id: 'guandan',
  name: '大师掼蛋',
  englishName: 'GUANDAN MASTER',
  subtitle: '两副牌 108 张 · 逢人配百搭与同花顺拆解',
  description: '...',
  tags: ['逢人配', '同花顺拆解'],
  trainingPitch: '逢人配组牌 · 控牌配合 · 冲 A 策略',
  difficulty: '进阶',
  difficultyStars: 4,
  playerCount: '4 人局',
  deckInfo: '2 副牌 · 108 张',
  stakes: [{ id: 'novice', name: '新手桌', baseBet: 50, minChips: 0 }],
  status: 'available',
  accent: 'gold',
  component: YourGameEntry,
};
```

2. 在 `src/games/registry.ts` 的 `GAME_REGISTRY` 中注册即可自动出现在大厅卡片矩阵与 Hash 路由 `#/game/<id>` 中；牌桌可直接复用 `src/shared/` 下的 `PlayingCard`、`soundEngine`、`TableEffects`、`ChipBalancePill`、`ReplayTimeline`、`createResilientWorkerClient` 与 `usePlayerStore`。

---

## 玩法路线图

- [x] **欢乐斗地主**（`doudizhu`）：AI 实时教练、托管代打、盲记抽测、10 道 Alpha-Beta 算杀残局、上帝视角复盘
- [x] **德州扑克**（`texas-holdem`）：6-Max 边池结算、13×13 GTO 范围矩阵、8 秒 Outs 盲测、四条街 EV 复盘重打
- [ ] **大师掼蛋**（`guandan`）：两副牌 108 张、逢人配百搭角标组牌引擎、同花顺拆解
- [ ] **21 点大师桌**（`blackjack`）：多副牌鞋盒、基本策略纠偏、Hi-Lo 真数算牌训练

---

## 本地开发与测试

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 运行全部 Vitest 单元测试（含斗地主 30 局全 AI 压测、10 道残局验证、德州规则与 Worker 容错测试）
npm test

# TypeScript 类型检查 + Vite 生产打包
npm run build
```

## 技术栈
- **UI & 动效**：React 19 + TypeScript 5.7 + Tailwind CSS v4 + Framer Motion + Lucide Icons
- **状态管理**：Zustand（`persist` 中间件持久化至 `localStorage`）
- **算路与工程化**：Web Worker（超时降级 + 防竞态重建） + Vite 7 + Vitest 3 + GitHub Actions 自动部署至 GitHub Pages

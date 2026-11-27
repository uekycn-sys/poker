import { Card, GameState, Rank, Seat } from './types';
import { makeCard, parseCards, sortCardsByRank } from './deck';
import { analyzeHand } from './rules';
import { createInitialGameState } from './gameLoop';

export interface EndgamePuzzle {
  id: string;
  number: number;
  title: string;
  difficultyStars: 1 | 2 | 3 | 4 | 5;
  tag: string;
  description: string;
  solutionExplanation: string;
  rewardBeans: number;
  landlordSeat: Seat;
  hands: [string, string, string];
  initialLastPlay?: { seat: Seat; cards: string } | null;
  initialPassCount?: number;
  verifiedFirstMove: string;
}

export const ENDGAME_PUZZLES: EndgamePuzzle[] = [
  {
    id: 'puzzle-01',
    number: 1,
    title: '先手控权',
    difficultyStars: 1,
    tag: '绝对牌权',
    description: '你（地主）手握 2 和对 5，农民手中有对 6。如何出牌确保两手清光？',
    solutionExplanation: '先出单张 2 抢占绝对牌权逼迫两家过牌，再从容打出对 5 获胜；若先出对 5 会被下下家对 6 截胡。',
    rewardBeans: 500,
    landlordSeat: 0,
    hands: ['2 5 5', 'K 4', '6 6'],
    verifiedFirstMove: '2',
  },
  {
    id: 'puzzle-02',
    number: 2,
    title: '双王拆打',
    difficultyStars: 2,
    tag: '双王拆打',
    description: '王炸在手却有两张散牌 3、4，盲目炸出就会输掉牌局！',
    solutionExplanation: '切忌直接王炸！先出单张 3 诱导农民交出大牌，再用小王、大王分别回收牌权，最后稳走单张 4。',
    rewardBeans: 600,
    landlordSeat: 0,
    hands: ['BJ SJ 3 4', '2 2 5', 'A K'],
    verifiedFirstMove: '3',
  },
  {
    id: 'puzzle-03',
    number: 3,
    title: '巧拉长顺',
    difficultyStars: 2,
    tag: '顺子长度',
    description: '你手握 345678 与 2，下家藏着 56789。顺子该打五张还是六张？',
    solutionExplanation: '打出 6 连顺 345678！若只出 5 张顺子，下家会用 56789 压制并顺走 K；拉长到 6 张即可让两家全部要不起，随后出 2 获胜。',
    rewardBeans: 600,
    landlordSeat: 0,
    hands: ['3 4 5 6 7 8 2', '5 6 7 8 9 K', '9 9 Q'],
    verifiedFirstMove: '3 4 5 6 7 8',
  },
  {
    id: 'puzzle-04',
    number: 4,
    title: '诱敌出炸',
    difficultyStars: 3,
    tag: '诱炸反制',
    description: '下家暗藏四张 6 炸弹，直接王炸清不光散牌，如何请君入瓮？',
    solutionExplanation: '先出对 10 逼迫下家炸出四张 6（或让两家被迫交牌），手里留着王炸反制炸弹并收尾单 9。',
    rewardBeans: 800,
    landlordSeat: 0,
    hands: ['BJ SJ 10 10 9', '6 6 6 6 5', 'J J 4'],
    verifiedFirstMove: '10 10',
  },
  {
    id: 'puzzle-05',
    number: 5,
    title: '送牌放行',
    difficultyStars: 3,
    tag: '农民协同',
    description: '你是地主上家（农民），队友只剩最后一张 8，地主握有 2 与对 Q。',
    solutionExplanation: '千万别顶大牌 K 或 A！主动送出最小单张 4，让下家队友顺过 8 直接获胜。',
    rewardBeans: 800,
    landlordSeat: 2,
    hands: ['4 K A', '8', '2 Q Q'],
    verifiedFirstMove: '4',
  },
  {
    id: 'puzzle-06',
    number: 6,
    title: '三带精拆',
    difficultyStars: 3,
    tag: '牌型选择',
    description: '下家捏着 999+3，上家拿着 A 与对 K，如何一手击穿防线？',
    solutionExplanation: '打三带二 777+44！若打三带一 777+4 会被下家 999+3 反压；打出三带二后两家无人能管，最后单 Q 稳稳收尾。',
    rewardBeans: 800,
    landlordSeat: 0,
    hands: ['7 7 7 4 4 Q', '9 9 9 3', 'A K K'],
    verifiedFirstMove: '7 7 7 4 4',
  },
  {
    id: 'puzzle-07',
    number: 7,
    title: '让牌不内耗',
    difficultyStars: 4,
    tag: '让牌控场',
    description: '队友刚打出单张 A（地主已过牌），你手握 2、3、4，队友剩对 6，地主剩小王和对 7。',
    solutionExplanation: '果断选择“不要”！此时队友牌权在手，若用 2 抢队友的 A 会导致随后无法清光 3、4 而被地主小王反杀。',
    rewardBeans: 1000,
    landlordSeat: 2,
    hands: ['2 3 4', '6 6', 'SJ 7 7'],
    initialLastPlay: { seat: 1, cards: 'A' },
    initialPassCount: 1,
    verifiedFirstMove: 'PASS',
  },
  {
    id: 'puzzle-08',
    number: 8,
    title: '抛砖引玉',
    difficultyStars: 4,
    tag: '诱大抢控',
    description: '地主握有大王、单 Q 与对 J，下家有 K 与对 10，上家藏着 2 与对 7。',
    solutionExplanation: '先出单张 Q 抛砖引玉！若先出对 J 或大王，收尾单 Q 会被 K 或 2 截杀；先出 Q 逼出大牌后用大王反控，再用对 J 一举清光。',
    rewardBeans: 1000,
    landlordSeat: 0,
    hands: ['BJ Q J J', 'K 10 10', '2 7 7'],
    verifiedFirstMove: 'Q',
  },
  {
    id: 'puzzle-09',
    number: 9,
    title: '飞机压境',
    difficultyStars: 5,
    tag: '飞机带翅',
    description: '手握 888999 与 3、5、2，两家农民分别藏有三张 10 与对子大牌。',
    solutionExplanation: '不要裸飞 888999！必须一次性带走 3 和 5 两张小单（飞机带翅膀），再凭绝对控制牌 2 锁定胜局。',
    rewardBeans: 1200,
    landlordSeat: 0,
    hands: ['8 8 8 9 9 9 3 5 2', '10 10 10 4 4 K', 'J J Q Q A'],
    verifiedFirstMove: '8 8 8 9 9 9 3 5',
  },
  {
    id: 'puzzle-10',
    number: 10,
    title: '牌圣算杀',
    difficultyStars: 5,
    tag: '终极算杀',
    description: '经典对攻残局：地主双王配对 A 对 6 与单 3，农民手握对 2、对 10、对 K 与对 Q。',
    solutionExplanation: '先出对 6 试探并消耗农民大对子防线（或逼出对 2 后用王炸接管），切忌开局浪费王炸导致单 3 与对 6 双双卡死。',
    rewardBeans: 1500,
    landlordSeat: 0,
    hands: ['BJ SJ A A 6 6 3', '2 2 10 10 9 9', 'K K Q Q 5'],
    verifiedFirstMove: '6 6',
  },
];

function assignUniqueCards(
  notations: [string, string, string],
  lastPlayStr?: string,
): { hands: [Card[], Card[], Card[]]; lastPlayCards: Card[] | null } {
  const rankUsage = new Map<Rank, number>();

  const allocate = (text: string): Card[] => {
    const parsed = parseCards(text);
    return parsed.map((c) => {
      const used = rankUsage.get(c.rank) ?? 0;
      if (c.rank >= Rank.SMALL_JOKER && used >= 1) {
        throw new Error(`Duplicate joker across puzzle hands: ${c.rank}`);
      }
      if (used >= 4) {
        throw new Error(`Exceeded 4 cards of rank ${c.rank} across puzzle hands`);
      }
      rankUsage.set(c.rank, used + 1);
      return makeCard(c.rank, undefined, used);
    });
  };

  const hands: [Card[], Card[], Card[]] = [
    sortCardsByRank(allocate(notations[0])),
    sortCardsByRank(allocate(notations[1])),
    sortCardsByRank(allocate(notations[2])),
  ];
  const lastPlayCards = lastPlayStr ? allocate(lastPlayStr) : null;
  return { hands, lastPlayCards };
}

/** Construct a ready-to-play `GameState` for an `EndgamePuzzle`. */
export function buildPuzzleGameState(puzzle: EndgamePuzzle): GameState {
  const { hands, lastPlayCards } = assignUniqueCards(
    puzzle.hands,
    puzzle.initialLastPlay?.cards,
  );
  const base = createInitialGameState(100);
  const lastPlay =
    puzzle.initialLastPlay && lastPlayCards
      ? {
          seat: puzzle.initialLastPlay.seat,
          pattern: analyzeHand(lastPlayCards),
        }
      : null;

  return {
    ...base,
    phase: 'PLAYING',
    hands,
    bottomCards: [],
    landlordSeat: puzzle.landlordSeat,
    currentTurn: 0,
    starterSeat: 0,
    doubleChoices: [1, 1, 1],
    lastPlay,
    passCount: puzzle.initialPassCount ?? 0,
  };
}

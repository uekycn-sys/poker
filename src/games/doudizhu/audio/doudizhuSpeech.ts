import { speechEngine } from '../../../shared/audio/speechEngine';
import { BidAction, DoubleChoice, HandPattern, Rank } from '../engine';

const SPOKEN_RANK_MAP: Record<Rank, string> = {
  [Rank.THREE]: '三',
  [Rank.FOUR]: '四',
  [Rank.FIVE]: '五',
  [Rank.SIX]: '六',
  [Rank.SEVEN]: '七',
  [Rank.EIGHT]: '八',
  [Rank.NINE]: '九',
  [Rank.TEN]: '十',
  [Rank.JACK]: '勾',
  [Rank.QUEEN]: '圈',
  [Rank.KING]: '凯',
  [Rank.ACE]: '尖',
  [Rank.TWO]: '二',
  [Rank.SMALL_JOKER]: '小王',
  [Rank.BIG_JOKER]: '大王',
};

const PASS_PHRASES = ['不要', '过', '要不起'] as const;

export function getSpokenRank(rank: Rank, context: 'single' | 'combo' = 'single'): string {
  if (rank === Rank.KING && context === 'single') {
    return '老凯';
  }
  return SPOKEN_RANK_MAP[rank] ?? '';
}

export function getPatternAnnouncement(pattern: HandPattern): string {
  switch (pattern.type) {
    case 'SINGLE':
      return getSpokenRank(pattern.mainRank, 'single');
    case 'PAIR':
      return `对${getSpokenRank(pattern.mainRank, 'combo')}`;
    case 'TRIPLE':
      return `三个${getSpokenRank(pattern.mainRank, 'combo')}`;
    case 'TRIPLE_WITH_SINGLE':
      return '三带一';
    case 'TRIPLE_WITH_PAIR':
      return '三带一对';
    case 'STRAIGHT':
      return '顺子';
    case 'PAIR_STRAIGHT':
      return '连对';
    case 'AIRPLANE':
      return '飞机';
    case 'AIRPLANE_WITH_SINGLES':
    case 'AIRPLANE_WITH_PAIRS':
      return '飞机带翅膀';
    case 'FOUR_WITH_TWO_SINGLES':
      return '四带二';
    case 'FOUR_WITH_TWO_PAIRS':
      return '四带两对';
    case 'BOMB':
      return '炸弹';
    case 'ROCKET':
      return '王炸';
    default:
      return '';
  }
}

class DoudizhuSpeech {
  private passCounter = 0;

  public announceBid(action: BidAction, isFirstCall: boolean): void {
    if (action === 'CALL') {
      speechEngine.speak('叫地主');
    } else if (action === 'GRAB') {
      speechEngine.speak('抢地主');
    } else {
      speechEngine.speak(isFirstCall ? '不叫' : '不抢');
    }
  }

  public announceDouble(choice: DoubleChoice): void {
    if (choice === 4) speechEngine.speak('超级加倍');
    else if (choice === 2) speechEngine.speak('加倍');
    else speechEngine.speak('不加倍');
  }

  public announceMingpai(): void {
    speechEngine.speak('明牌');
  }

  public announcePass(): void {
    const phrase = PASS_PHRASES[this.passCounter % PASS_PHRASES.length];
    this.passCounter += 1;
    speechEngine.speak(phrase);
  }

  public announceAlarm(remaining: number): void {
    if (remaining === 1) speechEngine.speak('我只剩一张牌了', { queue: true });
    else if (remaining === 2) speechEngine.speak('我只剩两张牌了', { queue: true });
  }

  public announceSpring(isAntiSpring: boolean): void {
    speechEngine.speak(isAntiSpring ? '反春！' : '春天！', { queue: true });
  }

  public announcePattern(pattern: HandPattern): void {
    const text = getPatternAnnouncement(pattern);
    if (text) {
      speechEngine.speak(text);
    }
  }
}

export const doudizhuSpeech = new DoudizhuSpeech();

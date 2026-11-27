import { speechEngine } from '../../../shared/audio/speechEngine';
import { BidAction, DoubleChoice, HandPattern, RANK_LABELS, Rank } from '../engine';

function spokenRank(rank: Rank): string {
  if (rank === Rank.ACE) return '尖';
  return RANK_LABELS[rank];
}

class DoudizhuSpeech {
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
    speechEngine.speak('不要');
  }

  public announceAlarm(remaining: number): void {
    if (remaining === 1) speechEngine.speak('我只剩一张牌了');
    else if (remaining === 2) speechEngine.speak('我只剩两张牌了');
  }

  public announceSpring(isAntiSpring: boolean): void {
    speechEngine.speak(isAntiSpring ? '反春！' : '春天！');
  }

  public announcePattern(pattern: HandPattern): void {
    const label = spokenRank(pattern.mainRank);
    switch (pattern.type) {
      case 'SINGLE':
        speechEngine.speak(label);
        break;
      case 'PAIR':
        speechEngine.speak(`对${label}`);
        break;
      case 'TRIPLE':
        speechEngine.speak(`三个${label}`);
        break;
      case 'TRIPLE_WITH_SINGLE':
        speechEngine.speak('三带一');
        break;
      case 'TRIPLE_WITH_PAIR':
        speechEngine.speak('三带二');
        break;
      case 'STRAIGHT':
        speechEngine.speak('顺子');
        break;
      case 'PAIR_STRAIGHT':
        speechEngine.speak('连对');
        break;
      case 'AIRPLANE':
      case 'AIRPLANE_WITH_SINGLES':
      case 'AIRPLANE_WITH_PAIRS':
        speechEngine.speak('飞机');
        break;
      case 'FOUR_WITH_TWO_SINGLES':
      case 'FOUR_WITH_TWO_PAIRS':
        speechEngine.speak('四带二');
        break;
      case 'BOMB':
        speechEngine.speak('炸弹');
        break;
      case 'ROCKET':
        speechEngine.speak('王炸');
        break;
      default:
        break;
    }
  }
}

export const doudizhuSpeech = new DoudizhuSpeech();

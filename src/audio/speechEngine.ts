import { BidAction, DoubleChoice, HandPattern, RANK_LABELS, Rank } from '../engine';

class SpeechEngine {
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public speak(text: string): void {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 1.12;
      utter.pitch = 1.02;
      utter.volume = 0.88;
      synth.speak(utter);
    } catch {
      // Ignore speech synthesis errors in restricted environments
    }
  }

  public announceBid(action: BidAction, isFirstCall: boolean): void {
    if (action === 'CALL') {
      this.speak('叫地主');
    } else if (action === 'GRAB') {
      this.speak('抢地主');
    } else {
      this.speak(isFirstCall ? '不叫' : '不抢');
    }
  }

  public announceDouble(choice: DoubleChoice): void {
    if (choice === 4) this.speak('超级加倍');
    else if (choice === 2) this.speak('加倍');
    else this.speak('不加倍');
  }

  public announceMingpai(): void {
    this.speak('明牌');
  }

  public announcePass(): void {
    this.speak('不要');
  }

  public announceAlarm(remaining: number): void {
    if (remaining === 1) this.speak('我只剩一张牌了');
    else if (remaining === 2) this.speak('我只剩两张牌了');
  }

  public announceSpring(isAntiSpring: boolean): void {
    this.speak(isAntiSpring ? '反春！' : '春天！');
  }

  public announcePattern(pattern: HandPattern): void {
    const label = spokenRank(pattern.mainRank);
    switch (pattern.type) {
      case 'SINGLE':
        this.speak(label);
        break;
      case 'PAIR':
        this.speak(`对${label}`);
        break;
      case 'TRIPLE':
        this.speak(`三个${label}`);
        break;
      case 'TRIPLE_WITH_SINGLE':
        this.speak('三带一');
        break;
      case 'TRIPLE_WITH_PAIR':
        this.speak('三带二');
        break;
      case 'STRAIGHT':
        this.speak('顺子');
        break;
      case 'PAIR_STRAIGHT':
        this.speak('连对');
        break;
      case 'AIRPLANE':
      case 'AIRPLANE_WITH_SINGLES':
      case 'AIRPLANE_WITH_PAIRS':
        this.speak('飞机');
        break;
      case 'FOUR_WITH_TWO_SINGLES':
      case 'FOUR_WITH_TWO_PAIRS':
        this.speak('四带二');
        break;
      case 'BOMB':
        this.speak('炸弹');
        break;
      case 'ROCKET':
        this.speak('王炸');
        break;
      default:
        break;
    }
  }
}

function spokenRank(rank: Rank): string {
  if (rank === Rank.ACE) return '尖';
  return RANK_LABELS[rank];
}

export const speechEngine = new SpeechEngine();

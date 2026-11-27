import { describe, expect, it } from 'vitest';
import { HandPattern, HandType, Rank } from '../engine';
import { getPatternAnnouncement, getSpokenRank } from './doudizhuSpeech';

function makePattern(type: HandType, mainRank: Rank = Rank.THREE): HandPattern {
  return {
    type,
    mainRank,
    length: 1,
    chainLength: 1,
    cards: [],
  };
}

describe('doudizhuSpeech natural Chinese poker announcements', () => {
  it('speaks all ranks in authentic Chinese poker terms without ASCII letters', () => {
    const allRanks: Rank[] = [
      Rank.THREE,
      Rank.FOUR,
      Rank.FIVE,
      Rank.SIX,
      Rank.SEVEN,
      Rank.EIGHT,
      Rank.NINE,
      Rank.TEN,
      Rank.JACK,
      Rank.QUEEN,
      Rank.KING,
      Rank.ACE,
      Rank.TWO,
      Rank.SMALL_JOKER,
      Rank.BIG_JOKER,
    ];

    for (const rank of allRanks) {
      const singleText = getPatternAnnouncement(makePattern('SINGLE', rank));
      expect(singleText.length).toBeGreaterThan(0);
      expect(singleText).not.toMatch(/[A-Za-z]/);

      if (rank !== Rank.SMALL_JOKER && rank !== Rank.BIG_JOKER) {
        const pairText = getPatternAnnouncement(makePattern('PAIR', rank));
        const tripleText = getPatternAnnouncement(makePattern('TRIPLE', rank));
        expect(pairText).not.toMatch(/[A-Za-z]/);
        expect(tripleText).not.toMatch(/[A-Za-z]/);
      }
    }
  });

  it('uses authentic callouts for J, Q, K, A, and composite patterns', () => {
    expect(getSpokenRank(Rank.JACK, 'single')).toBe('勾');
    expect(getPatternAnnouncement(makePattern('PAIR', Rank.JACK))).toBe('对勾');
    expect(getPatternAnnouncement(makePattern('TRIPLE', Rank.JACK))).toBe('三个勾');

    expect(getSpokenRank(Rank.QUEEN, 'single')).toBe('圈');
    expect(getPatternAnnouncement(makePattern('PAIR', Rank.QUEEN))).toBe('对圈');
    expect(getPatternAnnouncement(makePattern('TRIPLE', Rank.QUEEN))).toBe('三个圈');

    expect(getSpokenRank(Rank.KING, 'single')).toBe('老凯');
    expect(getPatternAnnouncement(makePattern('PAIR', Rank.KING))).toBe('对凯');
    expect(getPatternAnnouncement(makePattern('TRIPLE', Rank.KING))).toBe('三个凯');

    expect(getSpokenRank(Rank.ACE, 'single')).toBe('尖');
    expect(getPatternAnnouncement(makePattern('PAIR', Rank.ACE))).toBe('对尖');
    expect(getPatternAnnouncement(makePattern('TRIPLE', Rank.ACE))).toBe('三个尖');

    expect(getPatternAnnouncement(makePattern('TRIPLE_WITH_SINGLE'))).toBe('三带一');
    expect(getPatternAnnouncement(makePattern('TRIPLE_WITH_PAIR'))).toBe('三带一对');
    expect(getPatternAnnouncement(makePattern('AIRPLANE'))).toBe('飞机');
    expect(getPatternAnnouncement(makePattern('AIRPLANE_WITH_SINGLES'))).toBe('飞机带翅膀');
    expect(getPatternAnnouncement(makePattern('AIRPLANE_WITH_PAIRS'))).toBe('飞机带翅膀');
    expect(getPatternAnnouncement(makePattern('FOUR_WITH_TWO_SINGLES'))).toBe('四带二');
    expect(getPatternAnnouncement(makePattern('FOUR_WITH_TWO_PAIRS'))).toBe('四带两对');
    expect(getPatternAnnouncement(makePattern('BOMB'))).toBe('炸弹');
    expect(getPatternAnnouncement(makePattern('ROCKET'))).toBe('王炸');
  });
});

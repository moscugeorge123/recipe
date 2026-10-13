import {
  planDayShift,
  shouldCommitDaySwipe,
} from '@/tortie/data/plan-day-shift';

describe('planDayShift', () => {
  test('Monday + right → previous week Sunday via goDate', () => {
    expect(planDayShift(0, 0, 40)).toEqual({
      kind: 'goDate',
      wk: -1,
      day: 6,
    });
  });

  test('Sunday + left → next week Monday via goDate', () => {
    expect(planDayShift(0, 6, -40)).toEqual({
      kind: 'goDate',
      wk: 1,
      day: 0,
    });
  });

  test('Wednesday + left → same week, day + 1', () => {
    expect(planDayShift(2, 2, -30)).toEqual({ kind: 'setDay', day: 3 });
  });

  test('Wednesday + right → same week, day - 1', () => {
    expect(planDayShift(2, 2, 30)).toEqual({ kind: 'setDay', day: 1 });
  });

  test('direction 0 is a no-op', () => {
    expect(planDayShift(0, 3, 0)).toEqual({ kind: 'noop' });
  });
});

describe('shouldCommitDaySwipe', () => {
  test('commits on large translation', () => {
    expect(shouldCommitDaySwipe(49, 0)).toBe(true);
  });

  test('commits on medium translation with high velocity', () => {
    expect(shouldCommitDaySwipe(21, 801)).toBe(true);
  });

  test('rejects mostly-vertical pans', () => {
    expect(shouldCommitDaySwipe(30, 900, 40)).toBe(false);
  });
});

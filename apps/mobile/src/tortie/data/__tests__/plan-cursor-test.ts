jest.mock('@/tortie/nav-store', () => ({
  useNav: {
    getState: () => ({
      set: jest.fn(),
    }),
  },
}));

import { planDayShift } from '@/tortie/data/plan-day-shift';
import { planLogicalCursor, rememberPlanDay, syncPlanToToday, usePlan } from '@/tortie/data/plan';

/** Reset visible + logical cursor without waiting on leftover timeouts. */
function resetPlan(day = 2, wk = 0) {
  jest.clearAllTimers();
  usePlan.setState({
    wk,
    day,
    targetWk: null,
    targetDay: null,
    wkOut: false,
    wkDir: 1,
    dayOut: false,
    dayDir: 1,
    calM: 0,
    calFade: false,
    addedWeek: null,
    pick: null,
  });
}

/** Apply one committed day swipe from the logical cursor (same as UI). */
function swipeLeft() {
  const state = usePlan.getState();
  const { wk, day } = planLogicalCursor(state);
  const next = planDayShift(wk, day, -50);
  if (next.kind === 'setDay') state.setDay(next.day);
  else if (next.kind === 'goDate') state.goDate(next.wk, next.day);
}

function swipeRight() {
  const state = usePlan.getState();
  const { wk, day } = planLogicalCursor(state);
  const next = planDayShift(wk, day, 50);
  if (next.kind === 'setDay') state.setDay(next.day);
  else if (next.kind === 'goDate') state.goDate(next.wk, next.day);
}

describe('usePlan logical cursor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetPlan(2, 0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('two logical left-shifts from day 2 land on day 4 before visible day updates', () => {
    swipeLeft();
    swipeLeft();

    const mid = usePlan.getState();
    expect(planLogicalCursor(mid)).toEqual({ wk: 0, day: 4 });
    expect(mid.day).toBe(2);
    expect(mid.targetDay).toBe(4);

    jest.advanceTimersByTime(150);

    const done = usePlan.getState();
    expect(done.day).toBe(4);
    expect(done.targetDay).toBeNull();
    expect(done.dayOut).toBe(false);
  });

  test('left then right returns to the start day', () => {
    swipeLeft();
    swipeRight();

    expect(planLogicalCursor(usePlan.getState())).toEqual({ wk: 0, day: 2 });

    jest.advanceTimersByTime(150);

    const done = usePlan.getState();
    expect(done.day).toBe(2);
    expect(done.targetDay).toBeNull();
  });

  test('Sunday left then left again lands on next week Tuesday', () => {
    resetPlan(6, 0);

    swipeLeft(); // → wk 1, Monday
    expect(planLogicalCursor(usePlan.getState())).toEqual({ wk: 1, day: 0 });

    swipeLeft(); // → wk 1, Tuesday (must not stick on Monday)
    expect(planLogicalCursor(usePlan.getState())).toEqual({ wk: 1, day: 1 });

    jest.advanceTimersByTime(160);

    const done = usePlan.getState();
    expect(done.wk).toBe(1);
    expect(done.day).toBe(1);
    expect(done.targetWk).toBeNull();
    expect(done.targetDay).toBeNull();
  });

  test('setDay scheduled before setWeek cannot overwrite the week change', () => {
    usePlan.getState().setDay(4);
    expect(usePlan.getState().targetDay).toBe(4);
    expect(usePlan.getState().day).toBe(2);

    usePlan.getState().setWeek(1);
    expect(planLogicalCursor(usePlan.getState())).toEqual({ wk: 1, day: 4 });

    // Day timeout was 150ms; week is 160ms. Past day delay must not clobber week.
    jest.advanceTimersByTime(150);
    const afterDayWouldHaveFired = usePlan.getState();
    expect(afterDayWouldHaveFired.wk).toBe(0);
    expect(afterDayWouldHaveFired.day).toBe(2);
    expect(afterDayWouldHaveFired.targetWk).toBe(1);

    jest.advanceTimersByTime(10);
    const done = usePlan.getState();
    expect(done.wk).toBe(1);
    expect(done.day).toBe(4);
    expect(done.targetWk).toBeNull();
    expect(done.targetDay).toBeNull();
  });

  test('tapping the already-logical day is a no-op', () => {
    usePlan.getState().setDay(3);
    expect(usePlan.getState().targetDay).toBe(3);

    usePlan.getState().setDay(3);
    expect(usePlan.getState().targetDay).toBe(3);
    expect(usePlan.getState().dayDir).toBe(1);

    jest.advanceTimersByTime(150);
    expect(usePlan.getState().day).toBe(3);
  });

  test('a new local day selects today on the current week', () => {
    resetPlan(2, 0);
    rememberPlanDay('2026-10-07');
    expect(syncPlanToToday(new Date(2026, 9, 8, 15))).toBe(true);
    jest.advanceTimersByTime(150);
    expect(planLogicalCursor(usePlan.getState())).toEqual({ wk: 0, day: 3 });
    expect(usePlan.getState().day).toBe(3);
  });

  test('the same local day leaves a chosen day alone', () => {
    resetPlan(1, 0);
    rememberPlanDay('2026-10-08');
    expect(syncPlanToToday(new Date(2026, 9, 8, 15))).toBe(false);
    expect(usePlan.getState().day).toBe(1);
  });

  test('a new day on another week does not move the cursor', () => {
    resetPlan(1, 1);
    rememberPlanDay('2026-10-07');
    expect(syncPlanToToday(new Date(2026, 9, 8, 15))).toBe(true);
    jest.advanceTimersByTime(150);
    expect(usePlan.getState().wk).toBe(1);
    expect(usePlan.getState().day).toBe(1);
  });
});

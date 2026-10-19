import { useCook } from '@/tortie/cook-store';
import { stopFrom } from '@/tortie/timer-alarm';
import {
  applyTimerActions,
  isAlerting,
  type StepTimer,
} from '@/tortie/timer-clock';

jest.mock('@/tortie/alarm-player', () => ({
  startAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));

const START = 1_700_000_000_000;

function timer(overrides: Partial<StepTimer> = {}): StepTimer {
  return {
    rem: 60,
    total: 60,
    run: true,
    title: 'Simmer',
    recipeTitle: 'Soup',
    endsAt: START + 60_000,
    ...overrides,
  };
}

describe('Stop from the alarm notification', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCook.setState({ timers: {}, visibleKey: null });
  });

  test('stops a timer that only reaches zero in the same tick (JS was paused in the background)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(START + 90_000);
    useCook.setState({ timers: { 'soup:1': timer() } });
    stopFrom({
      kind: 'cook-timer',
      key: 'soup:1',
      endsAt: String(START + 60_000),
    });
    const t = useCook.getState().timers['soup:1']!;
    expect(isAlerting(t)).toBe(false);
    expect(t).toMatchObject({ rem: 0, run: false, seen: true });
  });

  test('leaves a later run of the same timer alone', () => {
    jest.spyOn(Date, 'now').mockReturnValue(START + 200_000);
    useCook.setState({
      timers: { 'soup:1': timer({ endsAt: START + 180_000 }) },
    });
    stopFrom({
      kind: 'cook-timer',
      key: 'soup:1',
      endsAt: String(START + 60_000),
    });
    expect(isAlerting(useCook.getState().timers['soup:1']!)).toBe(true);
  });
});

describe('replaying notification card presses', () => {
  test('pause then resume keeps the seconds left at the pause', () => {
    const timers = {
      'soup:1': timer({ rem: 600, total: 600, endsAt: START + 600_000 }),
    };
    const next = applyTimerActions(
      timers,
      [
        { type: 'pause', key: 'soup:1', at: START + 100_400 },
        { type: 'resume', key: 'soup:1', at: START + 300_000 },
      ],
      START + 310_000,
    );
    // 499.6 s left at the pause rounds up to 500, as the native card shows.
    expect(next['soup:1']).toMatchObject({
      run: true,
      rem: 500,
      endsAt: START + 300_000 + 500_000,
    });
  });

  test('a pause on its own leaves the timer paused', () => {
    const next = applyTimerActions(
      { 'soup:1': timer() },
      [{ type: 'pause', key: 'soup:1', at: START + 15_000 }],
      START + 40_000,
    );
    expect(next['soup:1']).toMatchObject({ run: false, rem: 45, endsAt: null });
  });

  test('× removes the timer', () => {
    const next = applyTimerActions(
      { 'soup:1': timer(), 'soup:2': timer() },
      [{ type: 'dismiss', key: 'soup:1', at: START }],
      START,
    );
    expect(Object.keys(next)).toEqual(['soup:2']);
  });

  test('Stop ends the alert for the run it rang for, not a later one', () => {
    const now = START + 90_000;
    const stoppedRun = applyTimerActions(
      { 'soup:1': timer() },
      [
        {
          type: 'stop',
          key: 'soup:1',
          at: START + 70_000,
          endsAt: START + 60_000,
        },
      ],
      now,
    )['soup:1']!;
    expect(isAlerting(stoppedRun)).toBe(false);
    expect(stoppedRun).toMatchObject({ rem: 0, seen: true });

    const otherRun = applyTimerActions(
      { 'soup:1': timer({ endsAt: START + 80_000 }) },
      [
        {
          type: 'stop',
          key: 'soup:1',
          at: START + 70_000,
          endsAt: START + 60_000,
        },
      ],
      now,
    )['soup:1']!;
    expect(isAlerting(otherRun)).toBe(true);
  });

  test('presses for unknown timers change nothing', () => {
    const timers = { 'soup:1': timer() };
    expect(
      applyTimerActions(
        timers,
        [{ type: 'pause', key: 'x:0', at: START }],
        START,
      ),
    ).toBe(timers);
  });
});

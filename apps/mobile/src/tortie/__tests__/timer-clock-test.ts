import { useCook } from '@/tortie/cook-store';
import {
  addMinute,
  alarmId,
  armSignature,
  diffAlarms,
  projectTimers,
  scheduledAlarmFrom,
  triggerEndsAt,
  withRun,
  type StepTimer,
} from '@/tortie/timer-clock';

const START = 1_700_000_000_000;

function timer(overrides: Partial<StepTimer> = {}): StepTimer {
  return {
    rem: 120,
    total: 120,
    run: true,
    title: 'Simmer',
    recipeTitle: 'Soup',
    endsAt: START + 120_000,
    ...overrides,
  };
}

describe('cooking timer clock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCook.setState({
      timers: {},
      active: null,
      activeOn: false,
      sessionId: null,
      resumed: false,
    });
  });

  test('pause freezes the seconds still left on the deadline', () => {
    const paused = withRun(timer(), false, START + 15_000);
    expect(paused).toMatchObject({ run: false, endsAt: null, rem: 105 });
  });

  test('resume arms a new deadline from the frozen remainder', () => {
    const paused = timer({ run: false, endsAt: null, rem: 45 });
    expect(withRun(paused, true, START)).toMatchObject({
      run: true,
      rem: 45,
      endsAt: START + 45_000,
    });
  });

  test('adding a minute extends a running deadline by 60s', () => {
    const next = addMinute(timer(), START + 10_000, true);
    expect(next.endsAt).toBe(START + 180_000);
    expect(next.rem).toBe(170);
    expect(next.run).toBe(true);
  });

  test('adding a minute to a paused timer does not start it', () => {
    const paused = timer({ run: false, endsAt: null, rem: 40 });
    expect(addMinute(paused, START, false)).toMatchObject({
      run: false,
      endsAt: null,
      rem: 100,
    });
  });

  test('the countdown survives a gap with no ticks', () => {
    const { timers, finished } = projectTimers(
      { 'soup:1': timer() },
      START + 90_000,
    );
    expect(finished).toEqual([]);
    expect(timers['soup:1']).toMatchObject({
      rem: 30,
      run: true,
      endsAt: START + 120_000,
    });
  });

  test('a timer that expires while the app is open is finished', () => {
    const { timers, finished } = projectTimers(
      { 'soup:1': timer({ rem: 1 }) },
      START + 120_000,
    );
    expect(finished).toHaveLength(1);
    expect(timers['soup:1']).toMatchObject({
      rem: 0,
      run: false,
      endsAt: null,
    });
  });

  test('a timer that expired long ago does not toast again', () => {
    const { finished, timers } = projectTimers(
      { 'soup:1': timer({ endsAt: START - 60_000, rem: 10 }) },
      START,
    );
    expect(finished).toEqual([]);
    expect(timers['soup:1']!.run).toBe(false);
    expect(timers['soup:1']!.rem).toBe(0);
  });

  test('a legacy running timer without a deadline gets one', () => {
    const { timers } = projectTimers(
      { 'soup:1': timer({ endsAt: null, rem: 40 }) },
      START,
    );
    expect(timers['soup:1']).toMatchObject({
      run: true,
      rem: 40,
      endsAt: START + 40_000,
    });
  });

  test('the alarm signature ignores the once-a-second remainder', () => {
    const running = timer({ rem: 10 });
    expect(armSignature({ a: running }, true)).toBe(
      armSignature({ a: { ...running, rem: 9 } }, true),
    );
  });
});

describe('alarm schedule', () => {
  const running = timer();
  const id = alarmId('soup:1');

  test('schedules a running timer the OS does not know about yet', () => {
    expect(diffAlarms({ 'soup:1': running }, true, [], START)).toEqual([
      {
        type: 'schedule',
        key: 'soup:1',
        endsAt: running.endsAt,
        title: 'Simmer',
        recipeTitle: 'Soup',
      },
    ]);
  });

  test('keeps an iOS alarm whose absolute deadline was not echoed back', () => {
    const trusted = new Map([[id, running.endsAt!]]);
    expect(
      diffAlarms(
        { 'soup:1': running },
        true,
        [{ id, key: 'soup:1', endsAt: null }],
        START,
        trusted,
      ),
    ).toEqual([]);
  });

  test('leaves an alarm alone when its deadline has not changed', () => {
    expect(
      diffAlarms(
        { 'soup:1': running },
        true,
        [{ id, key: 'soup:1', endsAt: running.endsAt }],
        START,
      ),
    ).toEqual([]);
  });

  test('replaces an alarm when the deadline moves', () => {
    const extended = timer({ endsAt: START + 180_000, rem: 180, total: 180 });
    expect(
      diffAlarms(
        { 'soup:1': extended },
        true,
        [{ id, key: 'soup:1', endsAt: running.endsAt }],
        START,
      ),
    ).toEqual([
      { type: 'cancel', id },
      {
        type: 'schedule',
        key: 'soup:1',
        endsAt: extended.endsAt,
        title: 'Simmer',
        recipeTitle: 'Soup',
      },
    ]);
  });

  test('cancels a paused timer and keeps one that just finished', () => {
    const paused = timer({ run: false, endsAt: null, rem: 40 });
    const done = timer({ run: false, endsAt: null, rem: 0 });
    expect(
      diffAlarms(
        { 'soup:1': paused, 'soup:2': done },
        true,
        [
          { id, key: 'soup:1', endsAt: running.endsAt },
          { id: alarmId('soup:2'), key: 'soup:2', endsAt: START },
        ],
        START,
      ),
    ).toEqual([{ type: 'cancel', id }]);
  });

  test('turns every running alarm off with timer alerts', () => {
    expect(
      diffAlarms(
        { 'soup:1': running },
        false,
        [{ id, key: 'soup:1', endsAt: running.endsAt }],
        START,
      ),
    ).toEqual([{ type: 'cancel', id }]);
  });

  test('reads the deadline back off a scheduled notification', () => {
    expect(triggerEndsAt({ type: 'date', timestamp: 42 })).toBe(42);
    expect(
      scheduledAlarmFrom(
        id,
        { key: 'soup:1' },
        { type: 'date', timestamp: running.endsAt },
      ),
    ).toEqual({ id, key: 'soup:1', endsAt: running.endsAt });
    expect(scheduledAlarmFrom('other', { key: 'soup:1' }, null)).toBeNull();
  });
});

describe('cook store deadlines', () => {
  beforeEach(() => {
    useCook.setState({
      timers: {},
      active: { id: 'soup', step: 1, at: START },
      activeOn: true,
      sessionId: null,
      resumed: false,
    });
    jest.spyOn(Date, 'now').mockReturnValue(START);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('starting, pausing, and resuming keep a wall-clock deadline', () => {
    useCook.getState().toggle('soup:1', 2, 'Simmer', 'Soup');
    expect(useCook.getState().timers['soup:1']).toMatchObject({
      run: true,
      rem: 120,
      endsAt: START + 120_000,
    });

    jest.spyOn(Date, 'now').mockReturnValue(START + 90_000);
    useCook.getState().tick();
    expect(useCook.getState().timers['soup:1']!.rem).toBe(30);

    useCook.getState().toggle('soup:1', 2, 'Simmer', 'Soup');
    expect(useCook.getState().timers['soup:1']).toMatchObject({
      run: false,
      rem: 30,
      endsAt: null,
    });

    jest.spyOn(Date, 'now').mockReturnValue(START + 100_000);
    useCook.getState().toggle('soup:1', 2, 'Simmer', 'Soup');
    expect(useCook.getState().timers['soup:1']).toMatchObject({
      run: true,
      rem: 30,
      endsAt: START + 130_000,
    });
  });

  test('discard pauses that recipe and drops its deadline', () => {
    useCook.getState().toggle('soup:1', 1, 'Simmer', 'Soup');
    useCook.getState().toggle('other:0', 1, 'Boil', 'Tea');
    useCook.getState().discard();
    expect(useCook.getState().timers['soup:1']).toMatchObject({
      run: false,
      endsAt: null,
    });
    expect(useCook.getState().timers['other:0']!.run).toBe(true);
  });
});

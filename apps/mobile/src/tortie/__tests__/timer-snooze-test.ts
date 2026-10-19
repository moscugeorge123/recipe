import { AppState } from 'react-native';

import { stopAlarm } from '@/tortie/alarm-player';
import { useCook } from '@/tortie/cook-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import {
  ALERT_MAX_MS,
  alertingKeys,
  clampSnooze,
  diffAlarms,
  dockTimerKeys,
  isAlerting,
  overSec,
  projectTimers,
  withRun,
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

const alerting = (doneAt = START, o: Partial<StepTimer> = {}) =>
  timer({ rem: 0, run: false, endsAt: null, doneAt, ...o });

describe('finished timer alert', () => {
  test('hitting zero starts the alert at the deadline', () => {
    const r = projectTimers({ 'a:1': timer() }, START + 61_500);
    const t = r.timers['a:1']!;
    expect(isAlerting(t)).toBe(true);
    expect(t.doneAt).toBe(START + 60_000);
  });

  test('counts whole seconds past zero', () => {
    const t = alerting(START);
    expect(overSec(t, START + 59_999)).toBe(59);
    expect(overSec(t, START + 125_000)).toBe(125);
    expect(overSec(timer(), START + 125_000)).toBe(0);
  });

  test('an alert nobody answered stops after ALERT_MAX_MS', () => {
    const timers = { 'a:1': alerting(START) };
    expect(projectTimers(timers, START + ALERT_MAX_MS).timers).toBe(timers);
    const late = projectTimers(timers, START + ALERT_MAX_MS + 1).timers;
    expect(isAlerting(late['a:1']!)).toBe(false);
  });

  test('a timer that ended long ago while the app was closed does not alert', () => {
    const r = projectTimers({ 'a:1': timer() }, START + ALERT_MAX_MS * 2);
    expect(isAlerting(r.timers['a:1']!)).toBe(false);
    expect(r.timers['a:1']!.rem).toBe(0);
  });

  test('alerting timers stay in the dock even when seen', () => {
    const timers = {
      'a:1': alerting(START, { seen: true }),
      'a:2': timer({ rem: 0, run: false, endsAt: null, seen: true }),
    };
    expect(dockTimerKeys(timers, null)).toEqual(['a:1']);
    expect(dockTimerKeys(timers, 'a:1')).toEqual([]);
  });

  test('alertingKeys lists the one that finished first first', () => {
    const timers = {
      'a:1': alerting(START + 5_000),
      'a:2': timer(),
      'b:0': alerting(START),
    };
    expect(alertingKeys(timers)).toEqual(['b:0', 'a:1']);
  });

  test('restarting or pausing a finished timer ends the alert', () => {
    const t = alerting(START);
    expect(withRun({ ...t, rem: 30 }, true, START).doneAt).toBeNull();
    expect(withRun(t, false, START).doneAt).toBeNull();
  });

  test('snooze length is clamped to 1–30 minutes', () => {
    expect(clampSnooze(0)).toBe(1);
    expect(clampSnooze(45)).toBe(30);
    expect(clampSnooze(NaN)).toBe(1);
  });
});

describe('useCook snooze / stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppState as { currentState: string }).currentState = 'active';
    useTortiePrefs.setState({ timerAlerts: true, snoozeMinutes: 1 });
    jest.spyOn(Date, 'now').mockReturnValue(START + 30_000);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    useCook.setState({ timers: {}, visibleKey: null });
  });

  test('snooze runs the timer again for the configured minutes', () => {
    useTortiePrefs.setState({ snoozeMinutes: 3 });
    useCook.setState({ timers: { 'a:1': alerting() } });
    useCook.getState().snooze('a:1');
    const t = useCook.getState().timers['a:1']!;
    expect(isAlerting(t)).toBe(false);
    expect(t.run).toBe(true);
    expect(t.rem).toBe(180);
    expect(t.endsAt).toBe(START + 30_000 + 180_000);
    expect(stopAlarm).toHaveBeenCalledTimes(1);
  });

  test('a snoozed timer alerts again when it runs out', () => {
    useCook.setState({ timers: { 'a:1': alerting() } });
    useCook.getState().snooze('a:1');
    (Date.now as jest.Mock).mockReturnValue(START + 30_000 + 60_000);
    useCook.getState().tick();
    expect(isAlerting(useCook.getState().timers['a:1']!)).toBe(true);
  });

  test('stop ends the alert, keeps the timer finished and out of the dock', () => {
    useCook.setState({ timers: { 'a:1': alerting() } });
    useCook.getState().stop('a:1');
    const t = useCook.getState().timers['a:1']!;
    expect(isAlerting(t)).toBe(false);
    expect(t.rem).toBe(0);
    expect(dockTimerKeys(useCook.getState().timers, null)).toEqual([]);
    expect(stopAlarm).toHaveBeenCalledTimes(1);
  });

  test('the step detail rides on the timer and into the alarm', () => {
    useCook.getState().toggle('a:1', 5, 'Simmer', 'Soup', 'Lid on, low heat.');
    // The dock restarts it without knowing the step text: detail is kept.
    useCook.getState().toggle('a:1', 5, 'Simmer', 'Soup');
    useCook.getState().toggle('a:1', 5, 'Simmer', 'Soup');
    const timers = useCook.getState().timers;
    expect(timers['a:1']!.detail).toBe('Lid on, low heat.');
    expect(diffAlarms(timers, true, [], START + 30_000)).toEqual([
      expect.objectContaining({
        type: 'schedule',
        key: 'a:1',
        detail: 'Lid on, low heat.',
      }),
    ]);
  });

  test('the alarm keeps ringing while another timer still alerts', () => {
    useCook.setState({
      timers: { 'a:1': alerting(), 'a:2': alerting(START + 1_000) },
    });
    useCook.getState().stop('a:1');
    expect(stopAlarm).not.toHaveBeenCalled();
    useCook.getState().snooze('a:2');
    expect(stopAlarm).toHaveBeenCalledTimes(1);
  });
});

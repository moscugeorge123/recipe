import { AppState } from 'react-native';

import { startAlarm, stopAlarm } from '@/tortie/alarm-player';
import { useCook } from '@/tortie/cook-store';
import { toast } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import {
  addMinute,
  dockTimerKeys,
  markSeen,
  projectTimers,
  shouldRing,
  type StepTimer,
} from '@/tortie/timer-clock';

jest.mock('@/tortie/alarm-player', () => ({
  startAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));
jest.mock('@/tortie/nav-store', () => ({ toast: jest.fn() }));

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

describe('shouldRing', () => {
  test('rings only for finished timers, alerts on, app active', () => {
    expect(shouldRing([timer()], true, 'active')).toBe(true);
    expect(shouldRing([], true, 'active')).toBe(false);
    expect(shouldRing([timer()], false, 'active')).toBe(false);
    expect(shouldRing([timer()], true, 'background')).toBe(false);
  });
});

describe('seen timers (Q24)', () => {
  test('finishing on the visible step marks it seen', () => {
    const r = projectTimers({ 'a:1': timer() }, START + 60_000, 'a:1');
    expect(r.finished).toHaveLength(1);
    expect(r.seenKeys).toEqual(['a:1']);
    expect(r.timers['a:1']!.seen).toBe(true);
  });

  test('finishing on another step leaves it unseen', () => {
    const r = projectTimers({ 'a:1': timer() }, START + 60_000, 'a:2');
    expect(r.seenKeys).toEqual([]);
    expect(r.timers['a:1']!.seen).toBeFalsy();
  });

  test('dock hides seen finished timers but keeps unseen ones', () => {
    const done = { rem: 0, run: false, endsAt: null };
    const timers = {
      'a:1': timer({ ...done, seen: true }),
      'a:2': timer(done),
      'a:3': timer(),
      'a:4': timer({ run: false, endsAt: null }),
    };
    expect(dockTimerKeys(timers, 'a:3')).toEqual(['a:2']);
    expect(dockTimerKeys(timers, null)).toEqual(['a:2', 'a:3']);
  });

  test('opening the step marks a finished timer seen; paused ones untouched', () => {
    const done = timer({ rem: 0, run: false, endsAt: null });
    const marked = markSeen({ 'a:1': done }, 'a:1');
    expect(marked['a:1']!.seen).toBe(true);
    const paused = { 'a:1': timer({ rem: 20, run: false, endsAt: null }) };
    expect(markSeen(paused, 'a:1')).toBe(paused);
  });

  test('restarting clears seen', () => {
    const seen = timer({ rem: 0, run: false, endsAt: null, seen: true });
    expect(addMinute(seen, START, true).seen).toBe(false);
  });

  test('a persisted timer with no seen flag loads as unseen', () => {
    const old = timer({ rem: 0, run: false, endsAt: null });
    expect(dockTimerKeys({ 'a:1': old }, null)).toEqual(['a:1']);
  });
});

describe('useCook.tick alarm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppState as { currentState: string }).currentState = 'active';
    useTortiePrefs.setState({ timerAlerts: true });
    useCook.setState({ timers: {}, visibleKey: null });
    jest.spyOn(Date, 'now').mockReturnValue(START + 60_000);
  });
  afterEach(() => jest.restoreAllMocks());

  test('rings and toasts for a timer finishing off-screen', () => {
    useCook.setState({ timers: { 'a:1': timer() }, visibleKey: 'a:2' });
    useCook.getState().tick();
    expect(startAlarm).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('rings but does not toast when finished on the visible step', () => {
    useCook.setState({ timers: { 'a:1': timer() }, visibleKey: 'a:1' });
    useCook.getState().tick();
    expect(startAlarm).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    expect(useCook.getState().timers['a:1']!.seen).toBe(true);
  });

  test('two finishing together ring once', () => {
    useCook.setState({
      timers: { 'a:1': timer(), 'a:2': timer() },
      visibleKey: null,
    });
    useCook.getState().tick();
    expect(startAlarm).toHaveBeenCalledTimes(1);
  });

  test('timer alerts off means no ring', () => {
    useTortiePrefs.setState({ timerAlerts: false });
    useCook.setState({ timers: { 'a:1': timer() } });
    useCook.getState().tick();
    expect(startAlarm).not.toHaveBeenCalled();
  });

  test('dismiss and opening the step stop the alarm', () => {
    useCook.setState({
      timers: { 'a:1': timer({ rem: 0, run: false, endsAt: null }) },
    });
    useCook.getState().setVisibleKey('a:1');
    expect(stopAlarm).toHaveBeenCalledTimes(1);
    useCook.getState().dismiss('a:1');
    expect(stopAlarm).toHaveBeenCalledTimes(2);
  });
});

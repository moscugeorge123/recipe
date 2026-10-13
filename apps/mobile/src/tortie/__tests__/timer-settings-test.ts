import { useCook } from '@/tortie/cook-store';
import {
  clampMinutes,
  shiftMinutes,
  stepMinutes,
  withDuration,
  type StepTimer,
} from '@/tortie/timer-clock';

const NOW = 1_700_000_000_000;

function timer(overrides: Partial<StepTimer> = {}): StepTimer {
  return {
    rem: 300,
    total: 300,
    run: false,
    title: 'Simmer',
    recipeTitle: 'Soup',
    endsAt: null,
    ...overrides,
  };
}

describe('timer duration stepper', () => {
  test('steps by 1 below 10 and by 5 from 10 up', () => {
    expect(stepMinutes(5, 1)).toBe(6);
    expect(stepMinutes(9, 1)).toBe(10);
    expect(stepMinutes(10, 1)).toBe(15);
    expect(stepMinutes(15, -1)).toBe(10);
    expect(stepMinutes(10, -1)).toBe(9);
  });

  test('clamps to 1–600 minutes', () => {
    expect(stepMinutes(1, -1)).toBe(1);
    expect(stepMinutes(600, 1)).toBe(600);
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(9999)).toBe(600);
    expect(clampMinutes(NaN)).toBe(1);
  });
});

describe('shiftMinutes / withDuration', () => {
  test('+5 adds five minutes to a paused timer and leaves it paused', () => {
    expect(shiftMinutes(timer(), NOW, 5)).toMatchObject({
      rem: 600,
      total: 600,
      run: false,
      endsAt: null,
    });
  });

  test('−1 moves a running deadline earlier', () => {
    const t = timer({ run: true, endsAt: NOW + 300_000 });
    expect(shiftMinutes(t, NOW, -1)).toMatchObject({
      rem: 240,
      total: 240,
      run: true,
      endsAt: NOW + 240_000,
    });
  });

  test('−1 never takes the time below one minute', () => {
    expect(shiftMinutes(timer({ rem: 90, total: 90 }), NOW, -1).rem).toBe(60);
    const one = timer({ rem: 60, total: 60 });
    expect(shiftMinutes(one, NOW, -1)).toBe(one);
  });

  test('withDuration gives a fresh paused timer', () => {
    const t = timer({ run: true, rem: 12, endsAt: NOW + 12_000 });
    expect(withDuration(t, 15)).toMatchObject({
      rem: 900,
      total: 900,
      run: false,
      endsAt: null,
    });
    expect(withDuration(t, 5000).total).toBe(600 * 60);
  });
});

describe('setDuration', () => {
  afterEach(() => useCook.setState({ timers: {} }));

  test('keeps the timer paused so setting it never starts the clock', () => {
    useCook.getState().setDuration('soup:1', 15, 'Simmer', 'Soup');
    expect(useCook.getState().timers['soup:1']).toMatchObject({
      rem: 900,
      run: false,
    });
  });
});

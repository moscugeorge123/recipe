/** Wall-clock cooking timers and the alarm schedule derived from them. */

export type StepTimer = {
  rem: number;
  total: number;
  run: boolean;
  /** Step title, for the "Timer done — …" toast and the dock. */
  title: string;
  recipeTitle: string;
  /** Epoch ms when a running timer hits zero. Null while paused. */
  endsAt: number | null;
};

/** Toast only when the timer finishes while the app is actually open. */
export const FINISH_TOAST_MS = 5_000;

export const ALARM_ID_PREFIX = 'cook-timer-';
export const ALARM_SOUND = 'cook_alarm.wav';

export type ScheduledAlarm = {
  id: string;
  key: string | null;
  endsAt: number | null;
};

export type AlarmCommand =
  | { type: 'cancel'; id: string }
  | {
      type: 'schedule';
      key: string;
      endsAt: number;
      title: string;
      recipeTitle: string;
    };

export function alarmId(key: string): string {
  const safe = key.replace(/:/g, '--').replace(/[^A-Za-z0-9_-]/g, '_');
  return ALARM_ID_PREFIX + safe;
}

export function splitTimerKey(
  key: string,
): { recipeId: string; step: number } | null {
  const i = key.lastIndexOf(':');
  if (i <= 0) return null;
  const recipeId = key.slice(0, i);
  const step = Number(key.slice(i + 1));
  if (!recipeId || !Number.isInteger(step) || step < 0) return null;
  return { recipeId, step };
}

export function remainingSec(
  timer: Pick<StepTimer, 'rem' | 'run' | 'endsAt'>,
  now: number,
): number {
  if (timer.run && timer.endsAt != null) {
    return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  }
  return Math.max(0, timer.rem);
}

/** Start or pause. Pausing freezes the seconds still left. */
export function withRun(
  timer: StepTimer,
  run: boolean,
  now: number,
): StepTimer {
  const rem = remainingSec(timer, now);
  if (!run || rem <= 0) return { ...timer, rem, run: false, endsAt: null };
  return { ...timer, rem, run: true, endsAt: now + rem * 1000 };
}

/**
 * Adds one minute. `startIfDone` is the dock's +1, which restarts a finished
 * timer; the cook-mode button leaves a paused timer paused.
 */
export function addMinute(
  timer: StepTimer,
  now: number,
  startIfDone: boolean,
): StepTimer {
  const liveMs =
    timer.run && timer.endsAt != null
      ? Math.max(0, timer.endsAt - now)
      : Math.max(0, timer.rem) * 1000;
  const remMs = liveMs + 60_000;
  const done =
    timer.rem <= 0 ||
    (timer.run && timer.endsAt != null && timer.endsAt <= now);
  const run = startIfDone && done ? true : timer.run;
  return {
    ...timer,
    rem: Math.ceil(remMs / 1000),
    total: timer.total + 60,
    run,
    endsAt: run ? now + remMs : null,
  };
}

export function projectTimers(
  timers: Record<string, StepTimer>,
  now: number,
): { timers: Record<string, StepTimer>; finished: StepTimer[] } {
  let changed = false;
  const next: Record<string, StepTimer> = {};
  const finished: StepTimer[] = [];
  for (const key of Object.keys(timers)) {
    const timer = timers[key]!;
    const projected = projectOne(timer, now);
    next[key] = projected.timer;
    if (projected.timer !== timer) changed = true;
    if (projected.finished) finished.push(projected.timer);
  }
  return { timers: changed ? next : timers, finished };
}

/**
 * Identity of the alarms we need. Remaining seconds are omitted so the
 * once-a-second tick does not reschedule the notification.
 */
export function armSignature(
  timers: Record<string, StepTimer>,
  alerts: boolean,
): string {
  if (!alerts) return 'off';
  return Object.keys(timers)
    .sort()
    .map((key) => {
      const timer = timers[key]!;
      if (timer.run && timer.endsAt != null) return `${key}@${timer.endsAt}`;
      return `${key}#${timer.run ? 'run' : 'stop'}#${timer.rem === 0 ? 'zero' : 'left'}`;
    })
    .join('|');
}

/**
 * Diff desired alarms against what the OS already has scheduled.
 * `trusted` maps notification id → deadline we scheduled in this process.
 * iOS reports date alarms back as a relative interval, so a matching trusted
 * deadline means "leave it" instead of cancelling and arming it again.
 */
export function diffAlarms(
  timers: Record<string, StepTimer>,
  alerts: boolean,
  existing: ScheduledAlarm[],
  now: number,
  trusted: ReadonlyMap<string, number> = new Map(),
): AlarmCommand[] {
  const desired = new Map<string, StepTimer>();
  if (alerts) {
    for (const key of Object.keys(timers)) {
      const timer = timers[key]!;
      if (timer.run && timer.endsAt != null && timer.endsAt > now) {
        desired.set(key, timer);
      }
    }
  }

  const commands: AlarmCommand[] = [];
  const seen = new Set<string>();
  for (const alarm of existing) {
    if (!alarm.id.startsWith(ALARM_ID_PREFIX)) continue;
    seen.add(alarm.id);
    const key = alarm.key;
    const want = key ? desired.get(key) : undefined;
    if (!key || !want) {
      const timer = key ? timers[key] : undefined;
      // Let a timer that just hit zero keep its pending alarm so it can ring.
      if (timer && !timer.run && timer.rem === 0) continue;
      commands.push({ type: 'cancel', id: alarm.id });
      continue;
    }
    if (!sameDeadline(alarm, want.endsAt!, trusted)) {
      commands.push({ type: 'cancel', id: alarm.id });
      commands.push(scheduleCommand(key, want));
    }
  }
  for (const [key, timer] of desired) {
    if (!seen.has(alarmId(key))) commands.push(scheduleCommand(key, timer));
  }
  return commands;
}

export function triggerEndsAt(trigger: unknown): number | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const record = trigger as Record<string, unknown>;
  for (const field of ['timestamp', 'date', 'value'] as const) {
    const value = record[field];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function scheduledAlarmFrom(
  id: string,
  data: unknown,
  trigger: unknown,
): ScheduledAlarm | null {
  if (!id.startsWith(ALARM_ID_PREFIX)) return null;
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const key = record && typeof record.key === 'string' ? record.key : null;
  return { id, key, endsAt: triggerEndsAt(trigger) };
}

function sameDeadline(
  alarm: ScheduledAlarm,
  endsAt: number,
  trusted: ReadonlyMap<string, number>,
): boolean {
  if (alarm.endsAt != null) return alarm.endsAt === endsAt;
  return trusted.get(alarm.id) === endsAt;
}

function scheduleCommand(key: string, timer: StepTimer): AlarmCommand {
  return {
    type: 'schedule',
    key,
    endsAt: timer.endsAt!,
    title: timer.title,
    recipeTitle: timer.recipeTitle,
  };
}

function projectOne(
  timer: StepTimer,
  now: number,
): { timer: StepTimer; finished: boolean } {
  if (!timer.run) {
    if (timer.endsAt == null) return { timer, finished: false };
    return { timer: { ...timer, endsAt: null }, finished: false };
  }
  const endsAt = timer.endsAt ?? now + Math.max(0, timer.rem) * 1000;
  const rem = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = rem === 0;
  const updated: StepTimer = {
    ...timer,
    rem,
    run: !done,
    endsAt: done ? null : endsAt,
  };
  if (
    updated.rem === timer.rem &&
    updated.run === timer.run &&
    updated.endsAt === timer.endsAt
  ) {
    return { timer, finished: false };
  }
  const finished = done && timer.rem > 0 && now - endsAt <= FINISH_TOAST_MS;
  return { timer: updated, finished };
}

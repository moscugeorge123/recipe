/** Wall-clock cooking timers and the alarm schedule derived from them. */

export type StepTimer = {
  rem: number;
  total: number;
  run: boolean;
  /** Step title, for the dock and the alarm notification. */
  title: string;
  recipeTitle: string;
  /** Step instructions, shown in the expanded alarm notification. */
  detail?: string;
  /** Epoch ms when a running timer hits zero. Null while paused. */
  endsAt: number | null;
  /** The user saw this timer reach zero (or opened its step after). Missing = false. */
  seen?: boolean;
  /**
   * Epoch ms the timer hit zero, kept until the cook presses Stop or Snooze.
   * While set the timer is alerting and its clock counts past zero.
   */
  doneAt?: number | null;
};

/** Toast only when the timer finishes while the app is actually open. */
export const FINISH_TOAST_MS = 5_000;

/** An alert nobody answered for this long is stopped on its own (e.g. app reopened next day). */
export const ALERT_MAX_MS = 2 * 60 * 60_000;

export const MIN_SNOOZE_MINUTES = 1;
export const MAX_SNOOZE_MINUTES = 30;

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
      detail?: string;
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
  if (!run || rem <= 0)
    return { ...timer, rem, run: false, endsAt: null, doneAt: null };
  return {
    ...timer,
    rem,
    run: true,
    endsAt: now + rem * 1000,
    seen: false,
    doneAt: null,
  };
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
    seen: false,
    doneAt: null,
  };
}

export const MIN_TIMER_MINUTES = 1;
export const MAX_TIMER_MINUTES = 600;

export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_TIMER_MINUTES;
  return Math.min(
    MAX_TIMER_MINUTES,
    Math.max(MIN_TIMER_MINUTES, Math.round(minutes)),
  );
}

/** Stepper: 1 min steps below 10, 5 min steps from 10 up, clamped to 1–600. */
export function stepMinutes(minutes: number, dir: 1 | -1): number {
  const step = dir === 1 ? (minutes < 10 ? 1 : 5) : minutes <= 10 ? 1 : 5;
  return clampMinutes(minutes + dir * step);
}

/**
 * Moves the deadline by whole minutes. Shortening never goes below one minute
 * left, so −1 can't finish a timer by accident. Adding follows `addMinute`.
 */
export function shiftMinutes(
  timer: StepTimer,
  now: number,
  minutes: number,
  startIfDone = false,
): StepTimer {
  if (minutes >= 0) {
    let next = timer;
    for (let i = 0; i < minutes; i++) {
      next = addMinute(next, now, i === 0 && startIfDone);
    }
    return next;
  }
  const left = remainingSec(timer, now);
  const rem = Math.max(60, left + minutes * 60);
  if (rem >= left) return timer;
  return {
    ...timer,
    rem,
    total: Math.max(rem, timer.total + minutes * 60),
    seen: false,
    doneAt: null,
    endsAt: timer.run && timer.endsAt != null ? now + rem * 1000 : null,
  };
}

/** Apply from the settings panel: a fresh, paused timer of that length. */
export function withDuration(timer: StepTimer, minutes: number): StepTimer {
  const sec = clampMinutes(minutes) * 60;
  return {
    ...timer,
    rem: sec,
    total: sec,
    run: false,
    endsAt: null,
    seen: false,
    doneAt: null,
  };
}

/** Snooze: run again for `minutes` and end the alert. */
export function snoozed(
  timer: StepTimer,
  now: number,
  minutes: number,
): StepTimer {
  const sec = clampSnooze(minutes) * 60;
  return {
    ...timer,
    rem: sec,
    total: sec,
    run: true,
    endsAt: now + sec * 1000,
    seen: false,
    doneAt: null,
  };
}

/** Stop: end the alert; the timer stays finished and leaves the dock. */
export function stopped(timer: StepTimer): StepTimer {
  return { ...timer, doneAt: null, seen: true };
}

export function clampSnooze(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_SNOOZE_MINUTES;
  return Math.min(
    MAX_SNOOZE_MINUTES,
    Math.max(MIN_SNOOZE_MINUTES, Math.round(minutes)),
  );
}

export const isAlerting = (t: StepTimer) =>
  isFinishedTimer(t) && t.doneAt != null;

/** Whole seconds past zero for an alerting timer, else 0. */
export function overSec(t: StepTimer, now: number): number {
  if (!isAlerting(t)) return 0;
  return Math.max(0, Math.floor((now - t.doneAt!) / 1000));
}

/** Alerting timer keys, the one that finished first first. */
export function alertingKeys(timers: Record<string, StepTimer>): string[] {
  return Object.keys(timers)
    .filter((k) => isAlerting(timers[k]!))
    .sort(
      (a, b) => timers[a]!.doneAt! - timers[b]!.doneAt! || (a < b ? -1 : 1),
    );
}

/**
 * `visibleKey` is the timer whose step the cook is looking at. A timer that
 * finishes there is marked seen and reported in `seenKeys`, so the caller can
 * skip the toast (the alarm still rings for everything in `finished`).
 */
export function projectTimers(
  timers: Record<string, StepTimer>,
  now: number,
  visibleKey: string | null = null,
): {
  timers: Record<string, StepTimer>;
  finished: StepTimer[];
  seenKeys: string[];
} {
  let changed = false;
  const next: Record<string, StepTimer> = {};
  const finished: StepTimer[] = [];
  const seenKeys: string[] = [];
  for (const key of Object.keys(timers)) {
    const timer = timers[key]!;
    const projected = projectOne(timer, now);
    let out = projected.timer;
    if (isAlerting(out) && now - out.doneAt! > ALERT_MAX_MS) {
      out = { ...out, doneAt: null };
    }
    if (projected.finished) {
      finished.push(out);
      if (key === visibleKey) {
        out = { ...out, seen: true };
        seenKeys.push(key);
      }
    }
    next[key] = out;
    if (out !== timer) changed = true;
  }
  return { timers: changed ? next : timers, finished, seenKeys };
}

export const isFinishedTimer = (t: StepTimer) =>
  !t.run && t.rem === 0 && t.total > 0;

/** Marks a finished timer seen (opening its step). Returns the same object when nothing changes. */
export function markSeen(
  timers: Record<string, StepTimer>,
  key: string | null,
): Record<string, StepTimer> {
  const t = key ? timers[key] : undefined;
  if (!key || !t || !isFinishedTimer(t) || t.seen) return timers;
  return { ...timers, [key]: { ...t, seen: true } };
}

/**
 * Dock pills: running or partly used timers, minus the visible step and
 * finished ones the user saw. An alerting timer stays until Stop or Snooze.
 */
export function dockTimerKeys(
  timers: Record<string, StepTimer>,
  visibleKey: string | null,
): string[] {
  return Object.keys(timers).filter((k) => {
    const t = timers[k]!;
    if (k === visibleKey) return false;
    if (isFinishedTimer(t) && t.seen && !isAlerting(t)) return false;
    return t.run || t.rem < t.total;
  });
}

/** The alarm rings in-app only while the app is open and alerts are on. */
export function shouldRing(
  finished: readonly unknown[],
  timerAlerts: boolean,
  appState: string,
): boolean {
  return finished.length > 0 && timerAlerts && appState === 'active';
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
    ...(timer.detail ? { detail: timer.detail } : {}),
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
    ...(done ? { doneAt: endsAt } : {}),
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

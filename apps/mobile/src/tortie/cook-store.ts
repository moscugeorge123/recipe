import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AppState } from 'react-native';

import { startAlarm, stopAlarm } from '@/tortie/alarm-player';
import { toast } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import {
  addMinute,
  markSeen,
  projectTimers,
  shouldRing,
  shiftMinutes,
  withDuration,
  withRun,
  type StepTimer,
} from '@/tortie/timer-clock';

export type { StepTimer };

/** The cooking session shown on Today (prototype `active` + `activeOn`). */
export type ActiveCook = { id: string; step: number; at: number };

type CookState = {
  timers: Record<string, StepTimer>;
  active: ActiveCook | null;
  activeOn: boolean;
  /** API cook-session id for the active recipe, when one was created. */
  sessionId: string | null;
  /** Result of the last `begin` (Cook mode skips the intro when resuming). */
  resumed: boolean;
  /** Timer key of the step on screen in cook mode (not persisted). */
  visibleKey: string | null;
};

type CookActions = {
  /** New session on the intro, or resume when it's the active recipe. Returns whether it resumed. */
  begin: (id: string) => boolean;
  setStep: (step: number) => void;
  /** Close cook mode but keep the session (Today shows the card). */
  keep: (id: string, step: number) => void;
  /** End the session (Finish on the summary). */
  end: () => void;
  /** Today card ×: pause that recipe's timers and hide the card. */
  discard: () => void;
  setSessionId: (id: string | null) => void;
  ensure: (
    key: string,
    minutes: number,
    title: string,
    recipeTitle: string,
  ) => StepTimer;
  toggle: (
    key: string,
    minutes: number,
    title: string,
    recipeTitle: string,
  ) => void;
  plus: (key: string) => void;
  /** Cook-mode card "+1 min": adds a minute without touching `run`, creating the timer if needed. */
  bump: (
    key: string,
    minutes: number,
    title: string,
    recipeTitle: string,
  ) => void;
  reset: (key: string, minutes: number) => void;
  /** Cook-mode card −1 / +5 min: shifts the deadline, creating the timer if needed. */
  shift: (
    key: string,
    delta: number,
    minutes: number,
    title: string,
    recipeTitle: string,
  ) => void;
  /** Settings panel "Apply": a paused timer of exactly `minutes`. */
  setDuration: (
    key: string,
    minutes: number,
    title: string,
    recipeTitle: string,
  ) => void;
  dismiss: (key: string) => void;
  /** Cook mode reports which step's timer is on screen; a finished one is marked seen. */
  setVisibleKey: (key: string | null) => void;
  tick: () => void;
};

export const timerKey = (recipeId: string, step: number) =>
  `${recipeId}:${step}`;

export const useCook = create<CookState & CookActions>()(
  persist(
    (set, get) => ({
      timers: {},
      active: null,
      activeOn: false,
      sessionId: null,
      resumed: false,
      visibleKey: null,

      begin: (id) => {
        const { active, activeOn } = get();
        const same = !!active && active.id === id && activeOn;
        set({
          active: same ? active : { id, step: 0, at: Date.now() },
          activeOn: true,
          sessionId: same ? get().sessionId : null,
          resumed: same,
        });
        return same;
      },
      setStep: (step) =>
        set((s) => (s.active ? { active: { ...s.active, step } } : {})),
      keep: (id, step) =>
        set((s) => ({
          activeOn: true,
          active: {
            id,
            step,
            at: s.active && s.active.id === id ? s.active.at : Date.now(),
          },
        })),
      end: () => set({ activeOn: false, sessionId: null }),
      discard: () =>
        set((s) => {
          const id = s.active?.id;
          const now = Date.now();
          const T: Record<string, StepTimer> = {};
          for (const k in s.timers) {
            const timer = s.timers[k]!;
            T[k] =
              id && k.startsWith(id + ':') ? withRun(timer, false, now) : timer;
          }
          return { activeOn: false, timers: T };
        }),
      setSessionId: (sessionId) => set({ sessionId }),

      ensure: (key, minutes, title, recipeTitle) =>
        get().timers[key] ?? blank(minutes, title, recipeTitle),
      toggle: (key, minutes, title, recipeTitle) =>
        set((s) => {
          stopAlarm();
          const now = Date.now();
          const current = s.timers[key] ?? blank(minutes, title, recipeTitle);
          const base =
            current.rem === 0
              ? { ...current, rem: current.total, title, recipeTitle }
              : { ...current, title, recipeTitle };
          return {
            timers: {
              ...s.timers,
              [key]: withRun(base, current.rem === 0 || !current.run, now),
            },
          };
        }),
      plus: (key) =>
        set((s) => {
          stopAlarm();
          const timer = s.timers[key];
          if (!timer) return {};
          return {
            timers: {
              ...s.timers,
              [key]: addMinute(timer, Date.now(), true),
            },
          };
        }),
      bump: (key, minutes, title, recipeTitle) =>
        set((s) => {
          stopAlarm();
          const current = s.timers[key] ?? blank(minutes, title, recipeTitle);
          return {
            timers: {
              ...s.timers,
              [key]: addMinute(
                { ...current, title, recipeTitle },
                Date.now(),
                false,
              ),
            },
          };
        }),
      reset: (key, minutes) =>
        set((s) => {
          stopAlarm();
          const timer = s.timers[key];
          if (!timer) return {};
          const sec = minutes * 60;
          return {
            timers: {
              ...s.timers,
              [key]: {
                ...timer,
                rem: sec,
                total: sec,
                run: false,
                endsAt: null,
                seen: false,
              },
            },
          };
        }),
      shift: (key, delta, minutes, title, recipeTitle) =>
        set((s) => {
          stopAlarm();
          const current = s.timers[key] ?? blank(minutes, title, recipeTitle);
          return {
            timers: {
              ...s.timers,
              [key]: shiftMinutes(
                { ...current, title, recipeTitle },
                Date.now(),
                delta,
              ),
            },
          };
        }),
      setDuration: (key, minutes, title, recipeTitle) =>
        set((s) => {
          stopAlarm();
          const current = s.timers[key] ?? blank(minutes, title, recipeTitle);
          return {
            timers: {
              ...s.timers,
              [key]: withDuration({ ...current, title, recipeTitle }, minutes),
            },
          };
        }),
      dismiss: (key) =>
        set((s) => {
          stopAlarm();
          const T = { ...s.timers };
          delete T[key];
          return { timers: T };
        }),
      setVisibleKey: (key) => {
        const timers = markSeen(get().timers, key);
        if (timers !== get().timers) {
          stopAlarm();
          set({ visibleKey: key, timers });
        } else if (get().visibleKey !== key) set({ visibleKey: key });
      },
      tick: () => {
        const { timers, finished, seenKeys } = projectTimers(
          get().timers,
          Date.now(),
          get().visibleKey,
        );
        if (timers !== get().timers) set({ timers });
        const { timerAlerts } = useTortiePrefs.getState();
        if (shouldRing(finished, timerAlerts, AppState.currentState)) {
          startAlarm();
        }
        const seen = new Set(seenKeys);
        for (const key of Object.keys(timers)) {
          const t = timers[key]!;
          if (!finished.includes(t) || seen.has(key)) continue;
          toast('Timer done — ' + t.title.toLowerCase());
        }
      },
    }),
    {
      name: 'tortie-cook',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ timers, active, activeOn, sessionId }) => ({
        timers,
        active,
        activeOn,
        sessionId,
      }),
    },
  ),
);

function blank(minutes: number, title: string, recipeTitle: string): StepTimer {
  const sec = minutes * 60;
  return {
    rem: sec,
    total: sec,
    run: false,
    title,
    recipeTitle,
    endsAt: null,
  };
}

/** Keeps the on-screen countdown aligned with each timer's `endsAt`. */
let ticker: ReturnType<typeof setInterval> | null = null;
export function startCookTicker() {
  if (ticker) return () => undefined;
  useCook.getState().tick();
  ticker = setInterval(() => useCook.getState().tick(), 1000);
  return () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };
}

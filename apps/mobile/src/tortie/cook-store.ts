import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { toast } from '@/tortie/nav-store';
import {
  addMinute,
  projectTimers,
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
  dismiss: (key: string) => void;
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
              },
            },
          };
        }),
      dismiss: (key) =>
        set((s) => {
          const T = { ...s.timers };
          delete T[key];
          return { timers: T };
        }),
      tick: () => {
        const { timers, finished } = projectTimers(get().timers, Date.now());
        if (timers !== get().timers) set({ timers });
        for (const done of finished) {
          toast('Timer done — ' + done.title.toLowerCase());
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

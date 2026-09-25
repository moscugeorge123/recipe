import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { toast } from '@/tortie/nav-store';

/** A step timer, keyed `${recipeId}:${stepIndex}` (prototype `timers`). */
export type StepTimer = {
  rem: number;
  total: number;
  run: boolean;
  /** Step title, for the "Timer done — …" toast and the dock. */
  title: string;
  recipeTitle: string;
};

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
          const T: Record<string, StepTimer> = {};
          for (const k in s.timers)
            T[k] =
              id && k.startsWith(id + ':')
                ? { ...s.timers[k]!, run: false }
                : s.timers[k]!;
          return { activeOn: false, timers: T };
        }),
      setSessionId: (sessionId) => set({ sessionId }),

      ensure: (key, minutes, title, recipeTitle) => {
        const t = get().timers[key];
        return (
          t ?? {
            rem: minutes * 60,
            total: minutes * 60,
            run: false,
            title,
            recipeTitle,
          }
        );
      },
      toggle: (key, minutes, title, recipeTitle) =>
        set((s) => {
          const t = s.timers[key] ?? {
            rem: minutes * 60,
            total: minutes * 60,
            run: false,
            title,
            recipeTitle,
          };
          const next =
            t.rem === 0
              ? { ...t, rem: t.total, run: true }
              : { ...t, run: !t.run };
          return { timers: { ...s.timers, [key]: next } };
        }),
      plus: (key) =>
        set((s) => {
          const t = s.timers[key];
          if (!t) return {};
          return {
            timers: {
              ...s.timers,
              [key]: {
                ...t,
                rem: t.rem + 60,
                total: t.total + 60,
                run: t.rem === 0 ? true : t.run,
              },
            },
          };
        }),
      bump: (key, minutes, title, recipeTitle) =>
        set((s) => {
          const t = s.timers[key] ?? {
            rem: minutes * 60,
            total: minutes * 60,
            run: false,
            title,
            recipeTitle,
          };
          return {
            timers: {
              ...s.timers,
              [key]: { ...t, rem: t.rem + 60, total: t.total + 60 },
            },
          };
        }),
      reset: (key, minutes) =>
        set((s) => {
          const t = s.timers[key];
          if (!t) return {};
          return {
            timers: {
              ...s.timers,
              [key]: {
                ...t,
                rem: minutes * 60,
                total: minutes * 60,
                run: false,
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
        let fin: StepTimer | null = null;
        set((s) => {
          let ch = false;
          const T = { ...s.timers };
          for (const k in T) {
            const t = T[k]!;
            if (!t.run) continue;
            ch = true;
            const r = t.rem - 1;
            T[k] = { ...t, rem: Math.max(0, r), run: r > 0 };
            if (r <= 0) fin = T[k]!;
          }
          return ch ? { timers: T } : {};
        });
        const done = fin as StepTimer | null;
        if (done) toast('Timer done — ' + done.title.toLowerCase());
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

/** Global 1s ticker (the prototype's `setInterval` in componentDidMount). */
let ticker: ReturnType<typeof setInterval> | null = null;
export function startCookTicker() {
  if (ticker) return () => undefined;
  ticker = setInterval(() => useCook.getState().tick(), 1000);
  return () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };
}

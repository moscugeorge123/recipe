import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CookSessionState, CookTimer } from '@/stores/contracts';
import { useUiStore } from '@/stores/ui-store';

let ticker: ReturnType<typeof setInterval> | null = null;

function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startTicker(): void {
  if (ticker) {
    return;
  }
  ticker = setInterval(() => {
    useCookStore.getState().tick();
  }, 1000);
}

export const useCookStore = create<CookSessionState & { tick: () => void }>()(
  persist(
    (set, get) => ({
      recipeId: null,
      stepIndex: 0,
      startedAt: null,
      timer: null,
      start: (recipeId) => {
        stopTicker();
        set({
          recipeId,
          stepIndex: 0,
          startedAt: Date.now(),
          timer: null,
        });
      },
      setStep: (index) => set({ stepIndex: Math.max(0, index) }),
      exit: () => {
        stopTicker();
        set({ recipeId: null, stepIndex: 0, startedAt: null, timer: null });
      },
      startTimer: (stepIndex, seconds, label) => {
        const current = get().timer;
        if (current && current.stepIndex === stepIndex) {
          const next: CookTimer = {
            ...current,
            running: !current.running,
          };
          set({ timer: next });
          if (next.running) {
            startTicker();
          }
          return;
        }
        set({
          timer: {
            stepIndex,
            label,
            remainingSec: seconds,
            totalSec: seconds,
            running: true,
          },
        });
        startTicker();
      },
      toggleTimer: () => {
        const timer = get().timer;
        if (!timer) {
          return;
        }
        const running = !timer.running;
        set({ timer: { ...timer, running } });
        if (running) {
          startTicker();
        }
      },
      clearTimer: () => {
        stopTicker();
        set({ timer: null });
      },
      tick: () => {
        const timer = get().timer;
        if (!timer?.running) {
          return;
        }
        if (timer.remainingSec <= 1) {
          stopTicker();
          set({ timer: { ...timer, remainingSec: 0, running: false } });
          useUiStore.getState().showToast({
            glyph: '⏲',
            text: `${timer.label} — time`,
            action: 'Dismiss',
            onAction: () => useUiStore.getState().hideToast(),
          });
          return;
        }
        set({ timer: { ...timer, remainingSec: timer.remainingSec - 1 } });
      },
    }),
    {
      name: 'mise.cook.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipeId: state.recipeId,
        stepIndex: state.stepIndex,
        startedAt: state.startedAt,
        timer: state.timer,
      }),
    },
  ),
);

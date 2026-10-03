import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mondayOfWeek } from '@/features/meal-plan/types';
import { localTodayIso, shiftWeekStart } from '@/features/meal-plan/week';

export type MealPlanWeekState = {
  weekStart: string;
  setWeekStart: (isoDate: string) => void;
  shiftWeek: (weeks: number) => void;
  reset: () => void;
};

function defaultMonday(): string {
  return mondayOfWeek(localTodayIso());
}

export const useMealPlanWeekStore = create<MealPlanWeekState>()(
  persist(
    (set, get) => ({
      weekStart: defaultMonday(),
      setWeekStart: (isoDate) => set({ weekStart: mondayOfWeek(isoDate) }),
      shiftWeek: (weeks) =>
        set({ weekStart: shiftWeekStart(get().weekStart, weeks) }),
      reset: () => set({ weekStart: defaultMonday() }),
    }),
    {
      name: 'recime.meal-plan-week.v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === 'object'
            ? (persisted as { weekStart?: unknown }).weekStart
            : undefined;
        const weekStart =
          typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? mondayOfWeek(raw)
            : current.weekStart;
        return { ...current, weekStart };
      },
    },
  ),
);

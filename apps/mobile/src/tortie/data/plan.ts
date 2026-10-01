import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { create } from 'zustand';

import { listMealPlan } from '@/features/meal-plan/api';
import { useMealPlan } from '@/features/meal-plan/hooks';
import { mealPlanKeys, QUERY_FRESHNESS } from '@/features/query-keys';
import {
  addUtcDays,
  daysOfWeek,
  localTodayIso,
  shiftWeekStart,
} from '@/features/meal-plan/week';
import {
  mondayOfWeek,
  type MealPlanEntryView,
  type MealSlot,
} from '@/features/meal-plan/types';
import { useNav } from '@/tortie/nav-store';
import { MON } from '@/tortie/lib/fmt';
import { useTRecipe, useTRecipes, type TRecipe } from '@/tortie/data/recipes';

/** Prototype `plan[i]` = {b, l, d} recipe ids for one day. */
export type TDay = { b: string | null; l: string | null; d: string | null };
export type MealKey = keyof TDay;

export const MEAL_KEYS: MealKey[] = ['b', 'l', 'd'];
const SLOT_OF: Record<MealKey, MealSlot> = {
  b: 'BREAKFAST',
  l: 'LUNCH',
  d: 'DINNER',
};

/** A meal slot waiting for a cookbook pick. */
export type MealPick = {
  date: string;
  day: number;
  meal: MealKey;
  label: string;
};

export const mealSlot = (meal: MealKey): MealSlot => SLOT_OF[meal];

/** Monday-first index of today (0 = Monday). */
export const todayIndex = (now = new Date()) => (now.getDay() + 6) % 7;
export const currentMonday = () => mondayOfWeek(localTodayIso());
export const mondayAt = (wk: number) => shiftWeekStart(currentMonday(), wk);

export function isoParts(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    wd: (d.getUTCDay() + 6) % 7,
  };
}

export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) /
      864e5,
  );

/** "Sept 21 – 27" / "Sept 28 – Oct 4". */
export function weekRange(monday: string): string {
  const a = isoParts(monday);
  const b = isoParts(addUtcDays(monday, 6));
  return (
    MON[a.m] + ' ' + a.d + ' – ' + (a.m === b.m ? '' : MON[b.m] + ' ') + b.d
  );
}

export const weekName = (w: number) =>
  w === 0
    ? 'This week'
    : w === 1
      ? 'Next week'
      : w === -1
        ? 'Last week'
        : w > 0
          ? 'In ' + w + ' weeks'
          : -w + ' weeks ago';

const EMPTY_WEEK: TDay[] = Array.from({ length: 7 }, () => ({
  b: null,
  l: null,
  d: null,
}));

/** Groups RECIPE entries into per-day B/L/D slots (first by sortOrder wins). */
export function toWeek(
  monday: string,
  items: MealPlanEntryView[] | undefined,
): TDay[] {
  if (!items?.length) return EMPTY_WEEK;
  const dates = daysOfWeek(monday);
  return dates.map((date) => {
    const day: TDay = { b: null, l: null, d: null };
    for (const k of MEAL_KEYS) {
      const hit = items
        .filter(
          (e) =>
            e.date === date &&
            e.slot === SLOT_OF[k] &&
            e.kind === 'RECIPE' &&
            e.recipeId,
        )
        .sort((x, y) => x.sortOrder - y.sortOrder)[0];
      day[k] = hit?.recipeId ?? null;
    }
    return day;
  });
}

export const plannedIn = (week: TDay[]) =>
  week.reduce((a, d) => a + MEAL_KEYS.filter((k) => d[k]).length, 0);

/** One week of the meal plan in the prototype's shape. */
export function usePlanWeek(monday: string) {
  const q = useMealPlan(monday);
  const week = useMemo(
    () => toWeek(monday, q.data?.from === monday ? q.data.items : undefined),
    [monday, q.data],
  );
  const recipeIds = useMemo(
    () => [
      ...new Set(
        week.flatMap((d) =>
          MEAL_KEYS.map((k) => d[k]).filter((x): x is string => !!x),
        ),
      ),
    ],
    [week],
  );
  return { week, planned: plannedIn(week), recipeIds, isLoading: q.isLoading };
}

/** Dates (ISO) with at least one planned B/L/D recipe in [from, to] — one range query. */
export function usePlannedDates(from: string, to: string, enabled: boolean) {
  const q = useQuery({
    queryKey: mealPlanKeys.range(from, to),
    queryFn: ({ signal }) => listMealPlan({ from, to }, signal),
    staleTime: QUERY_FRESHNESS.mealPlan,
    enabled,
    retry: 1,
    placeholderData: (previous) => previous,
  });
  return useMemo(() => {
    const s = new Set<string>();
    for (const e of q.data ?? []) {
      if (e.kind === 'RECIPE' && e.recipeId && e.slot !== 'SNACK')
        s.add(e.date);
    }
    return s;
  }, [q.data]);
}

/** Recipe summary from the cookbook list, or the detail query when it isn't listed. */
export function useRecipeSlot(id: string | null | undefined) {
  const { list, isLoading } = useTRecipes();
  const hit = id ? list.find((r) => r.id === id) : undefined;
  const detail = useTRecipe(hit ? null : id);
  const recipe = hit ?? detail.r ?? null;
  return {
    recipe,
    pending: !!id && !recipe && (isLoading || detail.isLoading),
  };
}

export function useRecipeLite(id: string | null | undefined): TRecipe | null {
  return useRecipeSlot(id).recipe;
}

type PlanState = {
  /** Week offset from the current week. */
  wk: number;
  day: number;
  /**
   * Synchronous navigation cursor. Visible `wk`/`day` commit on the animation
   * timeout; these update immediately so rapid swipes chain from the latest
   * target. Null when idle (no in-flight commit).
   */
  targetWk: number | null;
  targetDay: number | null;
  wkOut: boolean;
  wkDir: 1 | -1;
  dayOut: boolean;
  dayDir: 1 | -1;
  /** Month picker: month offset from the current month. */
  calM: number;
  calFade: boolean;
  /** Monday of the week last added to groceries (prototype `weekAdded`). */
  addedWeek: string | null;
  /** Set while the cookbook is choosing a recipe for an empty slot. */
  pick: MealPick | null;
};

type PlanActions = {
  setDay: (i: number) => void;
  setWeek: (w: number) => void;
  goDate: (w: number, d: number) => void;
  setCalM: (m: number) => void;
  openCal: () => void;
  markAdded: (monday: string) => void;
  startPick: (day: number, meal: MealKey, label: string) => void;
  clearPick: () => void;
};

/** Logical (immediate) cursor — falls back to the visible week/day when idle. */
export function planLogicalCursor(s: {
  wk: number;
  day: number;
  targetWk: number | null;
  targetDay: number | null;
}) {
  return { wk: s.targetWk ?? s.wk, day: s.targetDay ?? s.day };
}

let commitT: ReturnType<typeof setTimeout> | null = null;
let cmT: ReturnType<typeof setTimeout> | null = null;

function clearCommit() {
  if (commitT) {
    clearTimeout(commitT);
    commitT = null;
  }
}

export const usePlan = create<PlanState & PlanActions>()((set, get) => {
  const scheduleDayCommit = (i: number) => {
    const s = get();
    const { day: ld } = planLogicalCursor(s);
    if (i === ld) return;

    clearCommit();
    set({
      targetWk: null,
      targetDay: i,
      dayOut: true,
      dayDir: i > ld ? 1 : -1,
    });
    commitT = setTimeout(() => {
      const t = get();
      const day = t.targetDay ?? t.day;
      set({
        day,
        dayOut: false,
        targetWk: null,
        targetDay: null,
      });
      commitT = null;
    }, 150);
  };

  const scheduleWeekCommit = (w: number, d: number) => {
    const s = get();
    const { wk: lw, day: ld } = planLogicalCursor(s);
    if (w === lw && d === ld) return;

    clearCommit();
    set({
      targetWk: w,
      targetDay: d,
      wkOut: true,
      wkDir: w !== lw ? (w > lw ? 1 : -1) : s.wkDir,
      dayOut: false,
    });
    commitT = setTimeout(() => {
      const t = get();
      const wk = t.targetWk ?? t.wk;
      const day = t.targetDay ?? t.day;
      set({
        wk,
        day,
        wkOut: false,
        dayOut: false,
        targetWk: null,
        targetDay: null,
      });
      commitT = null;
    }, 160);
  };

  return {
    wk: 0,
    day: todayIndex(),
    targetWk: null,
    targetDay: null,
    wkOut: false,
    wkDir: 1,
    dayOut: false,
    dayDir: 1,
    calM: 0,
    calFade: false,
    addedWeek: null,
    pick: null,

    setDay: (i) => {
      const s = get();
      // Pending week change: retarget that week — setDay alone would commit on
      // the still-visible (old) week once the day timeout fires.
      if (s.targetWk != null && s.targetWk !== s.wk) {
        scheduleWeekCommit(s.targetWk, i);
        return;
      }
      scheduleDayCommit(i);
    },
    setWeek: (w) => {
      const s = get();
      const { wk: lw, day: ld } = planLogicalCursor(s);
      if (w === lw) return;
      const d = w === 0 ? todayIndex() : ld;
      scheduleWeekCommit(w, d);
    },
    goDate: (w, d) => {
      useNav.getState().set({ cal: false });
      const s = get();
      const { wk: lw, day: ld } = planLogicalCursor(s);
      if (w === lw && d === ld) return;
      // Same visible week with no pending week retarget → day-only fade.
      if (w === s.wk && (s.targetWk === null || s.targetWk === s.wk)) {
        scheduleDayCommit(d);
        return;
      }
      scheduleWeekCommit(w, d);
    },
    setCalM: (m) => {
      set({ calFade: true });
      if (cmT) clearTimeout(cmT);
      cmT = setTimeout(() => set({ calM: m, calFade: false }), 120);
    },
    openCal: () => {
      const s = get();
      const p = isoParts(addUtcDays(mondayAt(s.wk), s.day));
      const now = new Date();
      set({ calM: (p.y - now.getFullYear()) * 12 + p.m - now.getMonth() });
      useNav.getState().set({ cal: true });
    },
    markAdded: (monday) => set({ addedWeek: monday }),
    startPick: (day, meal, label) => {
      const date = addUtcDays(mondayAt(get().wk), day);
      set({ pick: { date, day, meal, label } });
    },
    clearPick: () => {
      if (get().pick) set({ pick: null });
    },
  };
});

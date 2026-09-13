import {
  MealSlot,
  mondayOfWeek,
  sundayOfWeek,
  type MealPlanEntryView,
  type ReorderMealPlanEntry,
} from '@/features/meal-plan/types';
import type { ShoppingListItemView } from '@/features/shopping-list/types';
import { colors } from '@/theme/tokens';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const MEAL_SLOTS: {
  slot: MealSlot;
  label: string;
  emoji: string;
  color: string;
}[] = [
  {
    slot: MealSlot.BREAKFAST,
    label: 'Breakfast',
    emoji: '🌅',
    color: colors.mealBreakfast,
  },
  {
    slot: MealSlot.LUNCH,
    label: 'Lunch',
    emoji: '☀️',
    color: colors.mealLunch,
  },
  {
    slot: MealSlot.DINNER,
    label: 'Dinner',
    emoji: '🌙',
    color: colors.mealDinner,
  },
  {
    slot: MealSlot.SNACK,
    label: 'Snack',
    emoji: '🍪',
    color: colors.mealSnack,
  },
];

export function localTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysOfWeek(monday: string): string[] {
  const start = mondayOfWeek(monday);
  return Array.from({ length: 7 }, (_, index) => addUtcDays(start, index));
}

export function shiftWeekStart(monday: string, weeks: number): string {
  return mondayOfWeek(addUtcDays(mondayOfWeek(monday), weeks * 7));
}

export function isCurrentWeek(
  monday: string,
  today = localTodayIso(),
): boolean {
  return mondayOfWeek(monday) === mondayOfWeek(today);
}

function utcParts(isoDate: string): {
  day: number;
  month: string;
  year: number;
} {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return {
    day: date.getUTCDate(),
    month: SHORT_MONTHS[date.getUTCMonth()] ?? 'Jan',
    year: date.getUTCFullYear(),
  };
}

export function formatWeekLabel(
  monday: string,
  today = localTodayIso(),
): string {
  const start = mondayOfWeek(monday);
  const end = sundayOfWeek(start);
  const from = utcParts(start);
  const to = utcParts(end);
  if (isCurrentWeek(start, today)) {
    if (from.month === to.month) {
      return `This week ${from.day} - ${to.day} ${from.month}`;
    }
    return `This week ${from.day} ${from.month} - ${to.day} ${to.month}`;
  }
  if (from.month === to.month && from.year === to.year) {
    return `${from.day}–${to.day} ${from.month} ${from.year}`;
  }
  if (from.year === to.year) {
    return `${from.day} ${from.month} – ${to.day} ${to.month} ${to.year}`;
  }
  return `${from.day} ${from.month} ${from.year} – ${to.day} ${to.month} ${to.year}`;
}

export function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const index = day === 0 ? 6 : day - 1;
  return WEEKDAYS[index] ?? 'Mon';
}

export function dayNumber(isoDate: string): number {
  return utcParts(isoDate).day;
}

export function weekdayWithDay(isoDate: string): string {
  return `${weekdayLabel(isoDate)} ${dayNumber(isoDate)}`;
}

export function slotMeta(slot: MealSlot) {
  return MEAL_SLOTS.find((item) => item.slot === slot) ?? MEAL_SLOTS[2]!;
}

export function entriesForDay(
  entries: MealPlanEntryView[],
  date: string,
): MealPlanEntryView[] {
  return entries
    .filter((entry) => entry.date === date)
    .sort((left, right) => {
      const slotDiff =
        MEAL_SLOTS.findIndex((item) => item.slot === left.slot) -
        MEAL_SLOTS.findIndex((item) => item.slot === right.slot);
      if (slotDiff !== 0) {
        return slotDiff;
      }
      return left.sortOrder - right.sortOrder;
    });
}

export function buildMoveToDayPayload(
  entries: MealPlanEntryView[],
  movingId: string,
  targetDate: string,
  weekStart: string,
): { entries: ReorderMealPlanEntry[] } | null {
  const moving = entries.find((entry) => entry.id === movingId);
  if (!moving) {
    return null;
  }
  const weekMonday = mondayOfWeek(weekStart);
  const weekDays = new Set(daysOfWeek(weekMonday));
  if (!weekDays.has(targetDate) || !weekDays.has(moving.date)) {
    return null;
  }
  if (moving.date === targetDate) {
    return null;
  }
  const siblings = entries.filter(
    (entry) =>
      entry.id !== movingId &&
      entry.date === targetDate &&
      entry.slot === moving.slot,
  );
  const sortOrder =
    siblings.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;
  return {
    entries: [
      {
        id: moving.id,
        date: targetDate,
        slot: moving.slot,
        sortOrder,
      },
    ],
  };
}

export function visibleGroceryItems(
  items: ShoppingListItemView[],
  options: {
    weekEntryIds: ReadonlySet<string>;
    filterMealPlan: boolean;
  },
): ShoppingListItemView[] {
  if (!options.filterMealPlan) {
    return items;
  }
  return items.filter((item) => {
    if (item.source !== 'MEAL_PLAN') {
      return true;
    }
    return (
      !!item.sourceMealPlanEntryId &&
      options.weekEntryIds.has(item.sourceMealPlanEntryId)
    );
  });
}

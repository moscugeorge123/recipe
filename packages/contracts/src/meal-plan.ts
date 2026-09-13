export const MealSlot = {
  BREAKFAST: "BREAKFAST",
  LUNCH: "LUNCH",
  DINNER: "DINNER",
  SNACK: "SNACK",
} as const;

export type MealSlot = (typeof MealSlot)[keyof typeof MealSlot];

export const MealEntryKind = {
  RECIPE: "RECIPE",
  NOTE: "NOTE",
} as const;

export type MealEntryKind = (typeof MealEntryKind)[keyof typeof MealEntryKind];

export const MEAL_PLAN_NOTE_MAX_LENGTH = 75;

export const MEAL_PLAN_WEEK_START = "monday" as const;

export interface MealPlanEntryShape {
  id: string;
  date: string;
  slot: MealSlot;
  kind: MealEntryKind;
  recipeId: string | null;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function parseUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ReciMe weeks start Monday. Returns the YYYY-MM-DD of that week's Monday. */
export function mondayOfWeek(isoDate: string): string {
  const date = parseUtcDate(isoDate);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return formatUtcDate(date);
}

/** Returns the YYYY-MM-DD Sunday that closes the week containing `isoDate`. */
export function sundayOfWeek(isoDate: string): string {
  const monday = parseUtcDate(mondayOfWeek(isoDate));
  monday.setUTCDate(monday.getUTCDate() + 6);
  return formatUtcDate(monday);
}

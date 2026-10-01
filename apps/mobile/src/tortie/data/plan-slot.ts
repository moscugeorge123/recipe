import { daysOfWeek } from '@/features/meal-plan/week';
import {
  MealSlot,
  type MealPlanEntryView,
  type MealPlanWeekPage,
} from '@/features/meal-plan/types';

const DAY_SLOTS = [
  MealSlot.BREAKFAST,
  MealSlot.LUNCH,
  MealSlot.DINNER,
] as const;

/**
 * The RECIPE entry `toWeek` shows for a date+slot+recipe — lowest sortOrder.
 */
export function findSlotRecipeEntry(
  items: MealPlanEntryView[] | undefined,
  date: string,
  slot: MealSlot,
  recipeId: string,
): MealPlanEntryView | undefined {
  if (!items?.length) return undefined;
  return items
    .filter(
      (e) =>
        e.date === date &&
        e.slot === slot &&
        e.kind === 'RECIPE' &&
        e.recipeId === recipeId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** Entry ids for the meals the plan week actually shows (first RECIPE per slot). */
export function displayedPlanEntryIds(
  monday: string,
  items: MealPlanEntryView[] | undefined,
): string[] {
  if (!items?.length) return [];
  const ids: string[] = [];
  for (const date of daysOfWeek(monday)) {
    for (const slot of DAY_SLOTS) {
      const hit = items
        .filter(
          (e) =>
            e.date === date &&
            e.slot === slot &&
            e.kind === 'RECIPE' &&
            e.recipeId,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (hit) ids.push(hit.id);
    }
  }
  return ids;
}

/** Unique recipe ids for the selected meal entries, in selection order. */
export function recipeIdsForPlanEntries(
  items: readonly { id: string; recipeId: string | null }[],
  entryIds: readonly string[],
): string[] {
  const byId = new Map(items.map((e) => [e.id, e.recipeId]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of entryIds) {
    const recipeId = byId.get(id);
    if (!recipeId || seen.has(recipeId)) continue;
    seen.add(recipeId);
    out.push(recipeId);
  }
  return out;
}

/** Week-page cache shape safe to optimistic-filter (not array-shaped date lists). */
export function isMealPlanWeekItemsCache(
  value: unknown,
): value is MealPlanWeekPage {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray((value as MealPlanWeekPage).items)
  );
}

/**
 * Drop selected entries from a week page. `null` when `prev` is not an items
 * page or none of the ids are in it (do not clobber other cache shapes).
 */
export function omitPlanEntries(
  prev: unknown,
  entryIds: readonly string[],
): MealPlanWeekPage | null {
  if (!isMealPlanWeekItemsCache(prev)) return null;
  const drop = new Set(entryIds);
  const items = prev.items.filter((e) => !drop.has(e.id));
  if (items.length === prev.items.length) return null;
  return { ...prev, items };
}

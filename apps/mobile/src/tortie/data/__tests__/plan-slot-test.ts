import {
  MealEntryKind,
  MealSlot,
  type MealPlanEntryView,
} from '@/features/meal-plan/types';
import {
  displayedPlanEntryIds,
  findSlotRecipeEntry,
  isMealPlanWeekItemsCache,
  omitPlanEntries,
  recipeIdsForPlanEntries,
} from '@/tortie/data/plan-slot';

function entry(
  overrides: Partial<MealPlanEntryView> &
    Pick<MealPlanEntryView, 'id' | 'date'>,
): MealPlanEntryView {
  return {
    slot: MealSlot.BREAKFAST,
    kind: MealEntryKind.RECIPE,
    recipeId: 'r1',
    note: null,
    sortOrder: 0,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('findSlotRecipeEntry', () => {
  test('picks the lowest sortOrder RECIPE for that date+slot+recipe', () => {
    const items = [
      entry({
        id: 'late',
        date: '2026-09-22',
        slot: MealSlot.LUNCH,
        recipeId: 'soup',
        sortOrder: 2,
      }),
      entry({
        id: 'first',
        date: '2026-09-22',
        slot: MealSlot.LUNCH,
        recipeId: 'soup',
        sortOrder: 0,
      }),
      entry({
        id: 'other-slot',
        date: '2026-09-22',
        slot: MealSlot.DINNER,
        recipeId: 'soup',
        sortOrder: -1,
      }),
      entry({
        id: 'other-recipe',
        date: '2026-09-22',
        slot: MealSlot.LUNCH,
        recipeId: 'salad',
        sortOrder: -1,
      }),
    ];
    expect(
      findSlotRecipeEntry(items, '2026-09-22', MealSlot.LUNCH, 'soup')?.id,
    ).toBe('first');
  });

  test('ignores notes and empty lists', () => {
    expect(
      findSlotRecipeEntry(undefined, '2026-09-22', MealSlot.BREAKFAST, 'r1'),
    ).toBeUndefined();
    expect(
      findSlotRecipeEntry(
        [
          entry({
            id: 'note',
            date: '2026-09-22',
            kind: MealEntryKind.NOTE,
            recipeId: null,
            note: 'leftovers',
          }),
        ],
        '2026-09-22',
        MealSlot.BREAKFAST,
        'r1',
      ),
    ).toBeUndefined();
  });
});

describe('displayedPlanEntryIds', () => {
  test('returns the shown breakfast, lunch, and dinner entries for the week', () => {
    const items = [
      entry({ id: 'mon-b', date: '2026-09-21', recipeId: 'oats' }),
      entry({
        id: 'mon-l-late',
        date: '2026-09-21',
        slot: MealSlot.LUNCH,
        recipeId: 'soup',
        sortOrder: 2,
      }),
      entry({
        id: 'mon-l',
        date: '2026-09-21',
        slot: MealSlot.LUNCH,
        recipeId: 'soup',
        sortOrder: 0,
      }),
      entry({
        id: 'tue-d',
        date: '2026-09-22',
        slot: MealSlot.DINNER,
        recipeId: 'pasta',
      }),
      entry({
        id: 'snack',
        date: '2026-09-21',
        slot: MealSlot.SNACK,
        recipeId: 'apple',
      }),
      entry({
        id: 'note',
        date: '2026-09-21',
        kind: MealEntryKind.NOTE,
        recipeId: null,
        note: 'out',
      }),
    ];
    expect(displayedPlanEntryIds('2026-09-21', items)).toEqual([
      'mon-b',
      'mon-l',
      'tue-d',
    ]);
  });
});

describe('recipeIdsForPlanEntries', () => {
  test('maps selected entries to unique recipe ids in selection order', () => {
    const items = [
      { id: 'a', recipeId: 'oats' },
      { id: 'b', recipeId: 'soup' },
      { id: 'c', recipeId: 'oats' },
    ];
    expect(recipeIdsForPlanEntries(items, ['c', 'b', 'missing'])).toEqual([
      'oats',
      'soup',
    ]);
  });
});

describe('omitPlanEntries', () => {
  test('filters selected entries when prev is a week page with items', () => {
    const prev = {
      items: [
        entry({ id: 'a', date: '2026-09-22' }),
        entry({ id: 'b', date: '2026-09-22', recipeId: 'r2' }),
      ],
      from: '2026-09-22',
      to: '2026-09-28',
    };
    const next = omitPlanEntries(prev, ['a']);
    expect(next?.items.map((e) => e.id)).toEqual(['b']);
    expect(next?.from).toBe('2026-09-22');
  });

  test('does not clobber array-shaped or missing caches', () => {
    expect(omitPlanEntries(undefined, ['a'])).toBeNull();
    expect(omitPlanEntries(['2026-09-22'], ['a'])).toBeNull();
    expect(omitPlanEntries({ items: [] }, ['a'])).toBeNull();
    expect(isMealPlanWeekItemsCache(['2026-09-22'])).toBe(false);
  });
});

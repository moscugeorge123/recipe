import {
  MealEntryKind,
  MealSlot,
  mondayOfWeek,
  sundayOfWeek,
  type MealPlanEntryView,
} from '@/features/meal-plan/types';
import {
  addUtcDays,
  buildMoveToDayPayload,
  daysOfWeek,
  formatWeekLabel,
  localTodayIso,
  shiftWeekStart,
  visibleGroceryItems,
} from '@/features/meal-plan/week';
import type { ShoppingListItemView } from '@/features/shopping-list/types';

function entry(
  overrides: Partial<MealPlanEntryView> &
    Pick<MealPlanEntryView, 'id' | 'date'>,
): MealPlanEntryView {
  return {
    slot: MealSlot.DINNER,
    kind: MealEntryKind.RECIPE,
    recipeId: 'recipe-1',
    note: null,
    sortOrder: 0,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

function shopItem(
  overrides: Partial<ShoppingListItemView>,
): ShoppingListItemView {
  return {
    id: 'shop-1',
    name: 'Lemon',
    canonicalName: 'lemon',
    quantity: 1,
    unit: null,
    category: 'Produce',
    emoji: '🍋',
    done: false,
    fromRecipeCount: 0,
    source: 'MANUAL',
    sourceRecipeId: null,
    sourceMealPlanEntryId: null,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('meal plan week math', () => {
  test('weeks start Monday and close Sunday', () => {
    expect(mondayOfWeek('2026-09-12')).toBe('2026-09-07');
    expect(sundayOfWeek('2026-09-12')).toBe('2026-09-13');
    expect(mondayOfWeek('2026-09-07')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-13')).toBe('2026-09-07');
    expect(daysOfWeek('2026-09-09')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });

  test('shifts the visible week by seven days and keeps Monday', () => {
    expect(shiftWeekStart('2026-09-07', 1)).toBe('2026-09-14');
    expect(shiftWeekStart('2026-09-09', -1)).toBe('2026-08-31');
    expect(addUtcDays('2026-09-07', 6)).toBe('2026-09-13');
  });

  test('labels this week short and other weeks with short months', () => {
    expect(formatWeekLabel('2026-09-07', '2026-09-12')).toBe(
      'This week 7 - 13 Sep',
    );
    expect(formatWeekLabel('2026-09-14', '2026-09-12')).toBe(
      '14–20 Sep 2026',
    );
    expect(formatWeekLabel('2026-08-31', '2026-09-12')).toBe(
      '31 Aug – 6 Sep 2026',
    );
    expect(formatWeekLabel('2026-08-31', '2026-09-01')).toBe(
      'This week 31 Aug - 6 Sep',
    );
  });

  test('local today is a YYYY-MM-DD calendar date', () => {
    expect(localTodayIso(new Date(2026, 8, 12))).toBe('2026-09-12');
  });
});

describe('meal plan reorder payload', () => {
  const weekStart = '2026-09-07';
  const items = [
    entry({ id: 'a', date: '2026-09-07', slot: MealSlot.DINNER, sortOrder: 0 }),
    entry({ id: 'b', date: '2026-09-08', slot: MealSlot.DINNER, sortOrder: 0 }),
  ];

  test('moves an entry onto another day in the visible week', () => {
    expect(buildMoveToDayPayload(items, 'a', '2026-09-09', weekStart)).toEqual({
      entries: [
        {
          id: 'a',
          date: '2026-09-09',
          slot: MealSlot.DINNER,
          sortOrder: 0,
        },
      ],
    });
  });

  test('does not drop onto the same day or another week', () => {
    expect(
      buildMoveToDayPayload(items, 'a', '2026-09-07', weekStart),
    ).toBeNull();
    expect(
      buildMoveToDayPayload(items, 'a', '2026-09-14', weekStart),
    ).toBeNull();
  });

  test('appends after siblings already on the target slot', () => {
    const withSibling = [
      ...items,
      entry({
        id: 'c',
        date: '2026-09-09',
        slot: MealSlot.DINNER,
        sortOrder: 2,
      }),
    ];
    expect(
      buildMoveToDayPayload(withSibling, 'a', '2026-09-09', weekStart)
        ?.entries[0]?.sortOrder,
    ).toBe(3);
  });
});

describe('grocery meal-plan week filter', () => {
  test('always keeps manual and recipe-from-detail items', () => {
    const items = [
      shopItem({ id: 'm', source: 'MANUAL' }),
      shopItem({
        id: 'r',
        source: 'RECIPE',
        sourceRecipeId: 'recipe-1',
      }),
    ];
    expect(
      visibleGroceryItems(items, {
        weekEntryIds: new Set(),
        filterMealPlan: true,
      }).map((item) => item.id),
    ).toEqual(['m', 'r']);
  });

  test('hides meal-plan items whose entry is outside the visible week', () => {
    const items = [
      shopItem({ id: 'm', source: 'MANUAL' }),
      shopItem({
        id: 'in',
        source: 'MEAL_PLAN',
        sourceMealPlanEntryId: 'entry-in',
      }),
      shopItem({
        id: 'out',
        source: 'MEAL_PLAN',
        sourceMealPlanEntryId: 'entry-out',
      }),
    ];
    expect(
      visibleGroceryItems(items, {
        weekEntryIds: new Set(['entry-in']),
        filterMealPlan: true,
      }).map((item) => item.id),
    ).toEqual(['m', 'in']);
  });
});

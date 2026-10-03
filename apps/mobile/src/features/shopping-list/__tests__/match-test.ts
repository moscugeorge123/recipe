import type { RecipeIngredientView } from '@/features/recipes/types';
import {
  isOnShoppingList,
  scaledRecipeQuantity,
  shoppingListKeysFrom,
  toShoppingWriteItems,
} from '@/features/shopping-list/match';

const recipeId = '11111111-1111-4111-8111-111111111111';

const broccoli: RecipeIngredientView = {
  id: 'ing-1',
  name: 'Broccoli',
  canonicalName: 'broccoli',
  emoji: '🥦',
  quantity: 1,
  unit: null,
  preparation: null,
  optional: false,
  category: 'Produce',
  confidence: 0.9,
};

describe('shopping list recipe matching', () => {
  test('builds keys from canonical and display names', () => {
    expect(
      shoppingListKeysFrom([
        { name: 'Olive oil', canonicalName: 'olive oil' },
        { name: 'Lemon', canonicalName: null },
      ]),
    ).toEqual(['olive oil', 'Olive oil', 'Lemon']);
  });

  test('treats checked-off grocery items as already on the list', () => {
    const keys = shoppingListKeysFrom([
      { name: 'Broccoli', canonicalName: 'broccoli' },
    ]);
    expect(isOnShoppingList(broccoli, keys)).toBe(true);
    expect(
      isOnShoppingList(
        { name: 'Garlic cloves', canonicalName: 'garlic cloves' },
        keys,
      ),
    ).toBe(false);
  });

  test('scales quantity and stamps sourceRecipeId on write items', () => {
    expect(scaledRecipeQuantity(1, 2)).toBe(2);
    expect(scaledRecipeQuantity(null, 2)).toBeNull();
    expect(
      toShoppingWriteItems(
        recipeId,
        [{ ...broccoli, quantity: 1.25, unit: 'cup' }],
        2,
      ),
    ).toEqual([
      {
        name: 'Broccoli',
        quantity: 2.5,
        unit: 'cup',
        category: 'Produce',
        emoji: '🥦',
        sourceRecipeId: recipeId,
      },
    ]);
  });
});

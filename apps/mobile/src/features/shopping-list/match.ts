import type { RecipeIngredientView } from '@/features/recipes/types';
import { isGroceryCategory } from '@/features/shopping-list/aisle';
import type {
  ShoppingListItemView,
  ShoppingListWriteItem,
} from '@/features/shopping-list/types';
import { isHave } from '@/stores/contracts';

type GroceryName = Pick<ShoppingListItemView, 'canonicalName' | 'name'>;

export function shoppingListKeysFrom(items?: GroceryName[] | null): string[] {
  const fromApi = (items ?? []).flatMap((item) =>
    [item.canonicalName, item.name].filter(
      (value): value is string => !!value && value.trim().length > 0,
    ),
  );
  return [...new Set(fromApi)];
}

export function scaledRecipeQuantity(
  quantity: number | null,
  multiplier: number,
): number | null {
  if (quantity === null) {
    return null;
  }
  return Math.round(quantity * multiplier * 10) / 10;
}

export function toShoppingWriteItems(
  recipeId: string,
  ingredients: RecipeIngredientView[],
  multiplier: number,
): ShoppingListWriteItem[] {
  return ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: scaledRecipeQuantity(ingredient.quantity, multiplier),
    ...(ingredient.unit ? { unit: ingredient.unit } : {}),
    ...(isGroceryCategory(ingredient.category)
      ? { category: ingredient.category }
      : {}),
    ...(ingredient.emoji ? { emoji: ingredient.emoji } : {}),
    sourceRecipeId: recipeId,
  }));
}

export function isOnShoppingList(
  ingredient: Pick<RecipeIngredientView, 'name'> & {
    canonicalName?: string | null;
  },
  groceryKeys: readonly string[],
): boolean {
  return isHave(ingredient.name, groceryKeys, ingredient.canonicalName);
}

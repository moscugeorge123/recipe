import type { PantryItemView } from '@/features/pantry/types';
import type { RecipeIngredientView } from '@/features/recipes/types';
import { isHave } from '@/stores/contracts';

type PantryName = Pick<PantryItemView, 'canonicalName' | 'name'>;

/**
 * Canonical pantry keys for YOU HAVE / TO BUY.
 * Matches Agent 4: exact canonical name, then exact display name — never substring.
 */
export function pantryKeysFrom(input: {
  items?: PantryName[] | null;
  leftoverStaples?: readonly string[];
}): string[] {
  const fromApi = (input.items ?? []).flatMap((item) =>
    [item.canonicalName, item.name].filter(
      (value): value is string => !!value && value.trim().length > 0,
    ),
  );
  return [...new Set([...fromApi, ...(input.leftoverStaples ?? [])])];
}

export function partitionByPantry<
  T extends Pick<RecipeIngredientView, 'name'> & {
    canonicalName?: string | null;
  },
>(ingredients: T[], pantryKeys: readonly string[]): { have: T[]; need: T[] } {
  const have: T[] = [];
  const need: T[] = [];
  for (const ingredient of ingredients) {
    if (isHave(ingredient.name, pantryKeys, ingredient.canonicalName)) {
      have.push(ingredient);
    } else {
      need.push(ingredient);
    }
  }
  return { have, need };
}

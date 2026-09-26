import type { ShoppingListWriteItem } from '@/features/shopping-list/types';
import { isGroceryCategory } from '@/features/shopping-list/aisle';

/**
 * Cookbook multi-select (handoff §2). `null` means the mode is off.
 * The array is never empty: removing the last id returns `null`.
 * Order is insertion order.
 */
export function toggleSelection(sel: string[], id: string): string[] | null {
  const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  return next.length ? next : null;
}

/** True when every visible recipe is selected. An empty visible list is never "all". */
export function allVisibleSelected(sel: string[], visible: string[]): boolean {
  return visible.length > 0 && visible.every((id) => sel.includes(id));
}

/** Tri-state membership of the selection in one collection (handoff §5.1). */
export function collectionMembership(
  recipeIds: readonly string[],
  selected: readonly string[],
): 'on' | 'partial' | 'off' {
  const on =
    selected.length > 0 && selected.every((id) => recipeIds.includes(id));
  if (on) return 'on';
  if (selected.some((id) => recipeIds.includes(id))) return 'partial';
  return 'off';
}

export type BulkIng = {
  /** Display name, preparation after a comma ("garlic, sliced"). */
  n: string;
  q: number | null;
  u: string | null;
  category?: string | null;
};

export type BulkRecipe = {
  id: string;
  title: string;
  ings: BulkIng[];
};

/**
 * Items to append for "Add to groceries" (handoff §5.2).
 * Key is the name before the first comma, lowercased. Skip when that key is
 * already on the list (substring either way) or already added in this batch.
 */
export function bulkGroceryAdds(
  recipes: readonly BulkRecipe[],
  existingNames: readonly string[],
): ShoppingListWriteItem[] {
  const seen = new Set<string>();
  const have = existingNames.map((n) => n.toLowerCase());
  const add: ShoppingListWriteItem[] = [];
  for (const recipe of recipes) {
    for (const ing of recipe.ings) {
      const nm = ing.n.split(',')[0] ?? '';
      const k = nm.toLowerCase();
      if (
        !k ||
        seen.has(k) ||
        have.some((g) => g.includes(k) || k.includes(g))
      ) {
        continue;
      }
      seen.add(k);
      add.push({
        name: nm.charAt(0).toUpperCase() + nm.slice(1),
        ...(ing.q != null ? { quantity: ing.q } : {}),
        ...(ing.u ? { unit: ing.u } : {}),
        ...(ing.category && isGroceryCategory(ing.category)
          ? { category: ing.category }
          : {}),
        emoji: '🛒',
        sourceRecipeId: recipe.id,
      });
    }
  }
  return add;
}

/** Handoff §5.3. `n` is the number of selected recipes. */
export function shareSelectionToast(n: number): string {
  return n > 1 ? `Links to ${n} recipes copied` : 'Link copied';
}

export function grocerySelectionToast(added: number): string {
  return added ? `${added} items added to groceries` : 'Already on your list';
}

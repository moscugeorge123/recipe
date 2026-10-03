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

/** Recipes staged in the add-to-groceries sheet. */
export type GroceryPickRequest = {
  recipes: BulkRecipe[];
  /** When set, confirming marks this week as added to groceries. */
  markWeekMonday: string | null;
};

/** One ingredient row in the add-to-groceries sheet. */
export type GroceryPickLine = {
  /** Stable for one open: recipe id plus ingredient index. */
  id: string;
  recipeId: string;
  recipeTitle: string;
  /** Full line, preparation after a comma. */
  label: string;
  /** Name written to the shopping list. */
  name: string;
  /** Name before the comma, lowercased. Dedupes a batch. */
  key: string;
  quantity: number | null;
  unit: string | null;
  category?: string | null;
  /** Name is already on the shopping list (substring either way). */
  onList: boolean;
};

function groceryNameParts(n: string): { raw: string; key: string } | null {
  const raw = n.split(',')[0] ?? '';
  const key = raw.toLowerCase();
  if (!key) return null;
  return { raw, key };
}

function nameOnList(key: string, existingNames: readonly string[]): boolean {
  return existingNames.some((g) => {
    const have = g.toLowerCase();
    return have.includes(key) || key.includes(have);
  });
}

/** Every named ingredient, in recipe order, for the picker sheet. */
export function groceryPickLines(
  recipes: readonly BulkRecipe[],
  existingNames: readonly string[],
): GroceryPickLine[] {
  const lines: GroceryPickLine[] = [];
  for (const recipe of recipes) {
    recipe.ings.forEach((ing, index) => {
      const parts = groceryNameParts(ing.n);
      if (!parts) return;
      lines.push({
        id: `${recipe.id}:${index}`,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        label: ing.n,
        name: parts.raw.charAt(0).toUpperCase() + parts.raw.slice(1),
        key: parts.key,
        quantity: ing.q,
        unit: ing.u,
        category: ing.category,
        onList: nameOnList(parts.key, existingNames),
      });
    });
  }
  return lines;
}

/** Every ingredient is checked when the sheet opens. */
export function defaultGrocerySelection(
  lines: readonly GroceryPickLine[],
): string[] {
  return lines.map((line) => line.id);
}

export type GroceryPickGroup = {
  recipeId: string;
  title: string;
  lines: GroceryPickLine[];
};

/** Lines grouped by recipe, preserving recipe order. */
export function groceryPickGroups(
  lines: readonly GroceryPickLine[],
): GroceryPickGroup[] {
  const groups: GroceryPickGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.recipeId === line.recipeId) last.lines.push(line);
    else
      groups.push({
        recipeId: line.recipeId,
        title: line.recipeTitle,
        lines: [line],
      });
  }
  return groups;
}

/**
 * Shopping-list rows for the checked ingredients.
 * The same name in a later recipe is skipped so the batch stays unique.
 * Checked items already on the list are included; the server merges them.
 */
export function groceryAddsForPick(
  lines: readonly GroceryPickLine[],
  selected: ReadonlySet<string>,
): ShoppingListWriteItem[] {
  const seen = new Set<string>();
  const add: ShoppingListWriteItem[] = [];
  for (const line of lines) {
    if (!selected.has(line.id) || seen.has(line.key)) continue;
    seen.add(line.key);
    add.push({
      name: line.name,
      ...(line.quantity != null ? { quantity: line.quantity } : {}),
      ...(line.unit ? { unit: line.unit } : {}),
      ...(line.category && isGroceryCategory(line.category)
        ? { category: line.category }
        : {}),
      emoji: '🛒',
      sourceRecipeId: line.recipeId,
    });
  }
  return add;
}

/**
 * Items to append for "Add to groceries" (handoff §5.2).
 * Key is the name before the first comma, lowercased. Skip when that key is
 * already on the list (substring either way) or already added in this batch.
 */
export function bulkGroceryAdds(
  recipes: readonly BulkRecipe[],
  existingNames: readonly string[],
): ShoppingListWriteItem[] {
  const lines = groceryPickLines(recipes, existingNames);
  return groceryAddsForPick(
    lines,
    new Set(lines.filter((line) => !line.onList).map((line) => line.id)),
  );
}

/** Handoff §5.3. `n` is the number of selected recipes. */
export function shareSelectionToast(n: number): string {
  return n > 1 ? `Links to ${n} recipes copied` : 'Link copied';
}

export function grocerySelectionToast(added: number): string {
  return added ? `${added} items added to groceries` : 'Already on your list';
}

import type { GroceryCategory } from '@/features/pantry/types';
import { displayUnit } from '@/features/recipes/plan';

export const AISLE_ORDER: GroceryCategory[] = [
  'Produce',
  'Meat',
  'Dairy',
  'Pantry',
  'Spices',
  'Frozen',
];

export const AISLE_DISPLAY: Record<GroceryCategory, string> = {
  Produce: 'Fresh Produce',
  Meat: 'Meat & Seafood',
  Dairy: 'Dairy',
  Pantry: 'Pantry',
  Spices: 'Herbs & Spices',
  Frozen: 'Frozen',
};

export function aisleKey(category: string | null | undefined): GroceryCategory {
  if (category && AISLE_ORDER.includes(category as GroceryCategory)) {
    return category as GroceryCategory;
  }
  return 'Pantry';
}

export function aisleLabel(category: string | null | undefined): string {
  return AISLE_DISPLAY[aisleKey(category)];
}

export function isGroceryCategory(
  value: string | null | undefined,
): value is GroceryCategory {
  return !!value && AISLE_ORDER.includes(value as GroceryCategory);
}

/**
 * Shopping-list order is when the item was added. Checking it off updates
 * `updatedAt` on the server, which must not move the row.
 */
export function groceryListOrder<T extends { createdAt: string; id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

export function groupByAisle<T extends { category?: string | null }>(
  items: T[],
): { category: GroceryCategory; label: string; items: T[] }[] {
  return AISLE_ORDER.map((category) => ({
    category,
    label: AISLE_DISPLAY[category],
    items: items.filter((item) => aisleKey(item.category) === category),
  })).filter((group) => group.items.length > 0);
}

export function formatGroceryQty(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string {
  const shownUnit = displayUnit(unit);
  if (quantity == null && !shownUnit) {
    return '';
  }
  if (quantity == null) {
    return shownUnit ?? '';
  }
  if (!shownUnit) {
    return String(quantity);
  }
  return `${quantity} ${shownUnit}`;
}

export function shoppingListShareText(
  items: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    category?: string | null;
    done?: boolean;
  }[],
): string {
  const remaining = items.filter((item) => !item.done);
  const source = remaining.length ? remaining : items;
  const groups = groupByAisle(source);
  const lines: string[] = ['Grocery List', ''];
  for (const group of groups) {
    lines.push(group.label);
    for (const item of group.items) {
      const qty = formatGroceryQty(item.quantity, item.unit);
      const mark = item.done ? '✓ ' : '';
      lines.push(qty ? `${mark}${item.name} — ${qty}` : `${mark}${item.name}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

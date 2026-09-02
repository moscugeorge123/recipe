import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecipeListItemView } from '@/features/recipes/types';

const PREFIX = 'mise.home.recipes.v1';

export type CachedRecipeList = {
  items: RecipeListItemView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

function keyFor(sort: 'latest' | 'engagement'): string {
  return `${PREFIX}.${sort}`;
}

export async function readCachedRecipeList(
  sort: 'latest' | 'engagement',
): Promise<CachedRecipeList | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(sort));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedRecipeList;
    if (!Array.isArray(parsed.items) || !parsed.meta) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedRecipeList(
  sort: 'latest' | 'engagement',
  value: CachedRecipeList,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(sort), JSON.stringify(value));
  } catch {
    // Cache writes are best-effort.
  }
}

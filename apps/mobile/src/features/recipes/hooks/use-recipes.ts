import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listRecipes } from '@/features/recipes/api';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import {
  QUERY_FRESHNESS,
  recipeKeys,
  type RecipeListFilters,
} from '@/features/query-keys';

export type { RecipeListFilters };
export {
  HOME_ENGAGEMENT_PAGE_SIZE,
  HOME_LATEST_PAGE_SIZE,
  recipeKeys,
} from '@/features/query-keys';

export type RecipeListPage = {
  items: Awaited<ReturnType<typeof listRecipes>>['items'];
  meta: Awaited<ReturnType<typeof listRecipes>>['meta'];
  fromCache?: boolean;
};

export function useRecipes(
  page = 1,
  pageSize = 50,
  filters?: RecipeListFilters,
) {
  const persistKey = persistKeyFor(recipeKeys.list(page, pageSize, filters));
  return useQuery({
    queryKey: recipeKeys.list(page, pageSize, filters),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listRecipes({ page, pageSize, ...filters }, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    staleTime: QUERY_FRESHNESS.recipesList,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

export function useRecipeSearch(q: string) {
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  const persistKey = persistKeyFor(recipeKeys.list(1, 50, { q: debouncedQ }));

  return useQuery({
    queryKey: recipeKeys.list(1, 50, { q: debouncedQ }),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(persistKey, () =>
        listRecipes({ q: debouncedQ, pageSize: 50 }, signal),
      );
      return { ...result.data, fromCache: result.fromCache };
    },
    enabled: debouncedQ.length >= 1,
    staleTime: QUERY_FRESHNESS.recipeSearch,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

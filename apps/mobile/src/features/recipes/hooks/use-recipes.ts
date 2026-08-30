import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listRecipes } from '@/features/recipes/api';

export type RecipeListFilters = {
  q?: string;
  cuisine?: string;
  sourceType?: string;
};

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (page: number, pageSize: number, filters?: RecipeListFilters) =>
    [...recipeKeys.all, page, pageSize, filters] as const,
};

export function useRecipes(
  page = 1,
  pageSize = 50,
  filters?: RecipeListFilters,
) {
  return useQuery({
    queryKey: recipeKeys.list(page, pageSize, filters),
    queryFn: ({ signal }) =>
      listRecipes({ page, pageSize, ...filters }, signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useRecipeSearch(q: string) {
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  return useQuery({
    queryKey: recipeKeys.list(1, 50, { q: debouncedQ }),
    queryFn: ({ signal }) =>
      listRecipes({ q: debouncedQ, pageSize: 50 }, signal),
    enabled: debouncedQ.length >= 1,
    staleTime: 30_000,
    retry: 1,
  });
}

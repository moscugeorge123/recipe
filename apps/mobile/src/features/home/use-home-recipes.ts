import { useQuery } from '@tanstack/react-query';

import { listRecipes } from '@/features/recipes/api';
import {
  HOME_ENGAGEMENT_PAGE_SIZE,
  HOME_LATEST_PAGE_SIZE,
  QUERY_FRESHNESS,
  recipeKeys,
} from '@/features/query-keys';
import {
  readCachedRecipeList,
  writeCachedRecipeList,
} from '@/features/recipes/list-cache';

export type HomeRecipeSort = 'latest' | 'engagement';

const PAGE_SIZES: Record<HomeRecipeSort, number> = {
  latest: HOME_LATEST_PAGE_SIZE,
  engagement: HOME_ENGAGEMENT_PAGE_SIZE,
};

export function useHomeRecipes(sort: HomeRecipeSort) {
  const pageSize = PAGE_SIZES[sort];

  return useQuery({
    queryKey: recipeKeys.list(1, pageSize, { sort }),
    queryFn: async ({ signal }) => {
      try {
        const result = await listRecipes({ page: 1, pageSize, sort }, signal);
        await writeCachedRecipeList(sort, result);
        return { ...result, fromCache: false as const };
      } catch (error) {
        const cached = await readCachedRecipeList(sort);
        if (cached) {
          return { ...cached, fromCache: true as const };
        }
        throw error;
      }
    },
    staleTime: QUERY_FRESHNESS.recipesHome,
    retry: 1,
  });
}

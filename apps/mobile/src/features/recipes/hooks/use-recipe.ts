import { useQuery } from '@tanstack/react-query';

import { getRecipe } from '@/features/recipes/api';
import { getSeedRecipe } from '@/features/recipes/seed';

export function useRecipe(id: string | undefined) {
  const seed = id ? getSeedRecipe(id) : undefined;
  const isApi = !!id && !id.startsWith('seed:');

  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: ({ signal }) => getRecipe(id as string, signal),
    enabled: isApi,
    staleTime: 60_000,
  });

  return {
    ...query,
    data: seed ?? query.data,
    isLoading: isApi ? query.isLoading : false,
  };
}

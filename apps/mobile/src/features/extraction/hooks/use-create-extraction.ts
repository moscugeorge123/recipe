import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createExtraction } from '@/features/extraction/api';
import { recipeKeys } from '@/features/recipes/hooks/use-recipes';

export function useCreateExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      url: string;
      forceRefresh?: boolean;
      selectedThumbnailUrl?: string;
    }) => createExtraction(input),
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: recipeKeys.all })
        .catch(() => undefined);
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createExtraction } from '@/features/extraction/api';
import type { ExtractionJobCreate } from '@/features/extraction/schemas';
import { recipeKeys } from '@/features/query-keys';

function recipeAlreadySaved(result: ExtractionJobCreate): boolean {
  return (
    !!result.recipeId &&
    (!!result.deduplicated || result.status === 'completed')
  );
}

export function useCreateExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      url: string;
      forceRefresh?: boolean;
      selectedThumbnailUrl?: string;
    }) => createExtraction(input),
    onSuccess: (result) => {
      if (!recipeAlreadySaved(result)) return;
      queryClient
        .invalidateQueries({ queryKey: recipeKeys.all })
        .catch(() => undefined);
    },
  });
}

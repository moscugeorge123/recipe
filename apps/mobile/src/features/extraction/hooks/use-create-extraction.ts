import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createExtraction } from '@/features/extraction/api';

export function useCreateExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { url: string; forceRefresh?: boolean }) =>
      createExtraction(input),
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: ['recipes'] })
        .catch(() => undefined);
    },
  });
}

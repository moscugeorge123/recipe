import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { queryClient } from '@/lib/query-client';

type QueryProviderProps = {
  children: ReactNode;
};

function useForegroundReconnect(): void {
  useEffect(() => {
    let current: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const resumed = current.match(/inactive|background/) && next === 'active';
      current = next;
      if (!resumed) {
        return;
      }
      void queryClient.resumePausedMutations();
      void queryClient.invalidateQueries({ refetchType: 'active' });
    });
    return () => sub.remove();
  }, []);
}

export function QueryProvider({ children }: QueryProviderProps) {
  useForegroundReconnect();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

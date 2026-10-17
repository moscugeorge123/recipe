import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { useTRecipe } from '@/tortie/data/recipes';

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const hasEmptyId = (key: readonly unknown[]) => key.some((k) => k === '');

describe('recipe reads without an id', () => {
  it('useRecipe(undefined) never creates an empty-id query', async () => {
    const { client, wrapper } = setup();
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderHook(() => useRecipe(undefined), { wrapper });
    await client.invalidateQueries({ queryKey: ['recipes'] });
    await client.refetchQueries({ queryKey: ['recipes'] });
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys.some(hasEmptyId)).toBe(false);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('useTRecipe(null) never creates an empty-id query', async () => {
    const { client, wrapper } = setup();
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useTRecipe(null), { wrapper });
    await client.refetchQueries({ queryKey: ['recipes'] });
    expect(result.current.r).toBeNull();
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys.some(hasEmptyId)).toBe(false);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

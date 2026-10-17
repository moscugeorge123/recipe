import { act, renderHook } from '@testing-library/react-native';

import { LIBRARY_SLOW_MS, useLibraryStatus } from '@/tortie/data/recipes';

type Q = {
  data?: { items: unknown[]; meta: { total: number } };
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isPending: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  refetch: jest.Mock;
};

let mockQuery: Q;

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useRecipes: () => mockQuery,
}));

const loading = (): Q => ({
  isLoading: true,
  isError: false,
  isSuccess: false,
  isPending: true,
  fetchStatus: 'fetching',
  refetch: jest.fn(),
});

beforeEach(() => {
  jest.useFakeTimers();
  mockQuery = loading();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLibraryStatus', () => {
  test('shows the skeleton first, then the import state if loading is slow', async () => {
    const { result } = await renderHook(() => useLibraryStatus());
    expect(result.current.status).toBe('loading');
    expect(result.current.pending).toBe(true);
    expect(result.current.showEmpty).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(LIBRARY_SLOW_MS);
    });
    expect(result.current.slow).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.showEmpty).toBe(true);
  });

  test('an empty library shows the import state', async () => {
    mockQuery = {
      ...loading(),
      data: { items: [], meta: { total: 0 } },
      isLoading: false,
      isSuccess: true,
      isPending: false,
      fetchStatus: 'idle',
    };
    const { result } = await renderHook(() => useLibraryStatus());
    expect(result.current.status).toBe('empty');
    expect(result.current.showEmpty).toBe(true);
  });

  test('a failed or paused first load is unreachable, not blank', async () => {
    mockQuery = {
      ...loading(),
      isLoading: false,
      isError: true,
      isPending: false,
    };
    const { result, rerender } = await renderHook(() => useLibraryStatus());
    expect(result.current.status).toBe('unreachable');
    expect(result.current.showEmpty).toBe(true);

    mockQuery = { ...loading(), isLoading: false, fetchStatus: 'paused' };
    await rerender({});
    expect(result.current.status).toBe('unreachable');

    result.current.retry();
    expect(mockQuery.refetch).toHaveBeenCalled();
  });
});

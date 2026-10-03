import { QueryClient } from '@tanstack/react-query';

import { recipeKeys } from '@/features/query-keys';
import {
  networkFirst,
  persistKeyFor,
  readPersistedQuery,
} from '@/features/query-persist';

describe('query persist and invalidation', () => {
  test('networkFirst serves last-known data when the request fails', async () => {
    const key = persistKeyFor(recipeKeys.list(1, 50));
    const first = await networkFirst(key, async () => ({
      items: [{ id: '11111111-1111-4111-8111-111111111111' }],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    }));
    expect(first.fromCache).toBe(false);

    const second = await networkFirst<{
      items: { id: string }[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(key, async () => {
      throw new Error('offline');
    });
    expect(second.fromCache).toBe(true);
    expect(second.data.items[0]?.id).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    await expect(readPersistedQuery(key)).resolves.toEqual(first.data);
  });

  test('invalidating recipeKeys.all marks list and detail queries stale', async () => {
    const client = new QueryClient();
    client.setQueryData(recipeKeys.list(1, 50), { items: [], meta: {} });
    client.setQueryData(recipeKeys.detail('r1'), { id: 'r1' });
    await client.invalidateQueries({ queryKey: recipeKeys.all });
    expect(client.getQueryState(recipeKeys.list(1, 50))?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(recipeKeys.detail('r1'))?.isInvalidated).toBe(
      true,
    );
    client.clear();
  });
});

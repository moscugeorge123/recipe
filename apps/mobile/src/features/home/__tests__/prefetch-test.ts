import { QueryClient } from '@tanstack/react-query';

import { prefetchHomeQueries } from '@/features/home/prefetch';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const emptyListBody = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
};

describe('prefetchHomeQueries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests recipes and the in-progress cook session immediately', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/cook-sessions')) {
          return mockJsonResponse({
            data: [],
            meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
          });
        }
        return mockJsonResponse(emptyListBody);
      });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await prefetchHomeQueries(client);
    client.clear();

    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes('/recipes?'))).toBe(true);
    expect(urls.some((url) => url.includes('/cook-sessions'))).toBe(true);
  });
});

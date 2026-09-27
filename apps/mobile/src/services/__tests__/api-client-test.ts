import {
  ApiError,
  apiClient,
  unwrapCollection,
  unwrapData,
} from '@/services/api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client envelopes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('unwrapData reads the data field', () => {
    expect(unwrapData({ data: { id: '1' } })).toEqual({ id: '1' });
  });

  test('unwrapCollection reads data and meta', () => {
    const result = unwrapCollection({
      data: [{ id: '1' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  test('parses error.code from the API envelope', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'UNSUPPORTED_SOURCE',
            message: 'TikTok is not supported',
          },
        },
        400,
      ),
    );

    await expect(apiClient.get('/recipes/extract')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'UNSUPPORTED_SOURCE',
    } satisfies Partial<ApiError>);
  });

  test('captures retryable and requestId without using them as copy', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests',
            requestId: 'req-abc',
            retryable: true,
          },
        },
        429,
      ),
    );

    await expect(apiClient.get('/pantry')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'TOO_MANY_REQUESTS',
      requestId: 'req-abc',
      retryable: true,
    });
  });

  test('treats HTTP 202 as success', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: { jobId: 'abc', status: 'queued' } }, 202),
      );

    const parsed = await apiClient.post('/recipes/extract', {
      url: 'https://x.com',
    });
    expect(unwrapData(parsed)).toEqual({ jobId: 'abc', status: 'queued' });
  });
});

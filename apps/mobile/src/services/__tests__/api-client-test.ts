import {
  ApiError,
  apiClient,
  READ_TIMEOUT_MS,
  setAuthTokenProvider,
  setUnauthorizedHandler,
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

describe('api client authentication', () => {
  afterEach(() => {
    setAuthTokenProvider(null);
    setUnauthorizedHandler(null);
    jest.restoreAllMocks();
  });

  const authHeader = (call: unknown[]): string | undefined =>
    (call[1] as { headers: Record<string, string> }).headers.Authorization;

  test('sends the Bearer token from the provider', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [] }));
    const provider = jest.fn(async () => 'token-1');
    setAuthTokenProvider(provider);

    await apiClient.get('/recipes');

    expect(provider).toHaveBeenCalledWith(false);
    expect(authHeader(fetchMock.mock.calls[0]!)).toBe('Bearer token-1');
  });

  test('sends no Authorization header when no provider is installed', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [] }));

    await apiClient.get('/recipes');

    expect(authHeader(fetchMock.mock.calls[0]!)).toBeUndefined();
  });

  test('refuses to call the API while signed out', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    setAuthTokenProvider(async () => null);

    await expect(apiClient.get('/recipes')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('refreshes the token once on 401 and retries', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    const provider = jest.fn(async (force: boolean) =>
      force ? 'fresh' : 'stale',
    );
    const onUnauthorized = jest.fn();
    setAuthTokenProvider(provider);
    setUnauthorizedHandler(onUnauthorized);

    const parsed = await apiClient.get('/recipes');

    expect(unwrapData(parsed)).toEqual({ ok: true });
    expect(provider.mock.calls).toEqual([[false], [true]]);
    expect(authHeader(fetchMock.mock.calls[0]!)).toBe('Bearer stale');
    expect(authHeader(fetchMock.mock.calls[1]!)).toBe('Bearer fresh');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('signs out through the handler when the retry is still 401', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401),
      );
    const onUnauthorized = jest.fn();
    setAuthTokenProvider(async () => 'token');
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiClient.get('/recipes')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('does not retry other errors', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404),
      );
    const provider = jest.fn(async () => 'token');
    setAuthTokenProvider(provider);

    await expect(apiClient.get('/recipes/x')).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledTimes(1);
  });
});

describe('api client read timeout', () => {
  /** A fetch that only settles when its signal aborts, like an unreachable host. */
  function hangingFetch() {
    return jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('Aborted')),
            ),
          ),
      );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    setAuthTokenProvider(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('a GET that never answers fails with TIMEOUT', async () => {
    hangingFetch();
    const pending = apiClient.get('/recipes');
    const check = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await check;
  });

  test('a caller abort is not reported as a timeout', async () => {
    hangingFetch();
    const ctl = new AbortController();
    const pending = apiClient.get('/recipes', { signal: ctl.signal });
    const check = expect(pending).rejects.not.toMatchObject({
      code: 'TIMEOUT',
    });
    await Promise.resolve();
    ctl.abort();
    await check;
  });

  test('writes are not bounded', async () => {
    const fetchMock = hangingFetch();
    void apiClient.post('/recipes/extract', {}).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS * 2);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal?.aborted ?? false).toBe(false);
  });
});

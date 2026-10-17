import { getApiBaseUrl } from '@/constants/env';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(message: string, status: number, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = code;
    this.requestId = isErrorEnvelope(body) ? body.error.requestId : undefined;
    const flagged =
      isErrorEnvelope(body) && typeof body.error.retryable === 'boolean'
        ? body.error.retryable
        : undefined;
    this.retryable = flagged ?? isRetryableApiFailure(status, code);
  }
}

function isRetryableApiFailure(status: number, code?: string): boolean {
  if (status === 429 || status === 503 || status >= 500) {
    return true;
  }
  return (
    code === 'TOO_MANY_REQUESTS' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'INTERNAL_SERVER_ERROR' ||
    code === 'PROVIDER_RATE_LIMITED' ||
    code === 'EXTRACTION_FAILED' ||
    code === 'CONTENT_ACQUISITION_FAILED' ||
    code === 'MEDIA_PROCESSING_FAILED'
  );
}

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId?: string;
    retryable?: boolean;
  };
};

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (!body || typeof body !== 'object' || !('error' in body)) {
    return false;
  }
  const error = (body as { error: unknown }).error;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function unwrapData<T>(parsed: unknown): T {
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

export function unwrapCollection<T>(parsed: unknown): {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
} {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'data' in parsed &&
    Array.isArray((parsed as { data: unknown }).data)
  ) {
    const record = parsed as {
      data: T[];
      meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    return {
      data: record.data,
      meta: record.meta ?? {
        page: 1,
        pageSize: record.data.length,
        total: record.data.length,
        totalPages: 1,
      },
    };
  }
  return {
    data: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Returns the current ID token, or null when nobody is signed in. */
export type AuthTokenProvider = (
  forceRefresh: boolean,
) => Promise<string | null>;

let tokenProvider: AuthTokenProvider | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Installs the source of `Authorization: Bearer` tokens (set by `features/auth`). */
export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  tokenProvider = provider;
}

/** Called when a request is still 401 after one forced token refresh. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Reads give up after this long. An unreachable host can otherwise leave a
 * request (and every screen waiting on it) pending for minutes.
 */
export const READ_TIMEOUT_MS = 20_000;

/** `signal` that also aborts after `ms`; `timedOut()` tells the two apart. */
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const ctl = new AbortController();
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    ctl.abort();
  }, ms);
  const onAbort = () => ctl.abort();
  if (signal?.aborted) ctl.abort();
  else signal?.addEventListener('abort', onAbort);
  return {
    signal: ctl.signal,
    timedOut: () => fired,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function send(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: ApiRequestOptions | undefined,
  forceRefresh: boolean,
): Promise<Response> {
  const token = tokenProvider ? await tokenProvider(forceRefresh) : undefined;
  if (tokenProvider && !token) {
    // Signed out: never reach the API without credentials.
    throw new ApiError('Not signed in', 401, null, 'UNAUTHORIZED');
  }
  // Only reads are bounded: writes may legitimately run long (imports, AI).
  const limit =
    method === 'GET' ? withTimeout(options?.signal, READ_TIMEOUT_MS) : null;
  try {
    return await fetch(joinUrl(getApiBaseUrl(), path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: limit?.signal ?? options?.signal,
    });
  } catch (error) {
    if (limit?.timedOut()) {
      throw new ApiError('Request timed out', 0, null, 'TIMEOUT');
    }
    throw error;
  } finally {
    limit?.done();
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  let response = await send(method, path, body, options, false);

  if (response.status === 401 && tokenProvider) {
    // The token may simply have expired or been revoked: refresh once.
    response = await send(method, path, body, options, true);
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    const code = isErrorEnvelope(parsed) ? parsed.error.code : undefined;
    const message = isErrorEnvelope(parsed)
      ? parsed.error.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, parsed, code);
  }

  return parsed as T;
}

export const apiClient = {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },
  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return request<T>('POST', path, body, options);
  },
  put<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return request<T>('PUT', path, body, options);
  },
  patch<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return request<T>('PATCH', path, body, options);
  },
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
};

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

  constructor(message: string, status: number, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId?: string;
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

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  const response = await fetch(joinUrl(getApiBaseUrl(), path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options?.signal,
  });

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

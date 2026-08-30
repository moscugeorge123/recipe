import {
  cookSessionSchema,
  deleteCookSessionResponseSchema,
  paginationMetaSchema,
} from '@/features/cook-sessions/schemas';
import type {
  CookSessionView,
  CreateCookSessionBody,
  ListCookSessionsQuery,
  PatchCookSessionBody,
} from '@/features/cook-sessions/types';
import { apiClient, unwrapCollection, unwrapData } from '@/services/api-client';

function listCookSessionsPath(query: ListCookSessionsQuery): string {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const params = [`page=${page}`, `pageSize=${pageSize}`];
  if (query.status !== undefined) {
    params.push(`status=${encodeURIComponent(query.status)}`);
  }
  return `/cook-sessions?${params.join('&')}`;
}

export async function listCookSessions(
  query: ListCookSessionsQuery = {},
  signal?: AbortSignal,
): Promise<{
  items: CookSessionView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const parsed = await apiClient.get<unknown>(listCookSessionsPath(query), {
    signal,
  });
  const { data, meta } = unwrapCollection(parsed);
  const items = cookSessionSchema.array().parse(data);
  paginationMetaSchema.parse(meta);
  return { items, meta };
}

export async function getCookSession(
  id: string,
  signal?: AbortSignal,
): Promise<CookSessionView> {
  const parsed = await apiClient.get<unknown>(`/cook-sessions/${id}`, {
    signal,
  });
  return cookSessionSchema.parse(unwrapData(parsed));
}

export async function createCookSession(
  body: CreateCookSessionBody,
  signal?: AbortSignal,
): Promise<CookSessionView> {
  const parsed = await apiClient.post<unknown>('/cook-sessions', body, {
    signal,
  });
  return cookSessionSchema.parse(unwrapData(parsed));
}

export async function patchCookSession(
  id: string,
  body: PatchCookSessionBody,
  signal?: AbortSignal,
): Promise<CookSessionView> {
  const parsed = await apiClient.patch<unknown>(`/cook-sessions/${id}`, body, {
    signal,
  });
  return cookSessionSchema.parse(unwrapData(parsed));
}

export async function deleteCookSession(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; deleted: true }> {
  const parsed = await apiClient.delete<unknown>(`/cook-sessions/${id}`, {
    signal,
  });
  return deleteCookSessionResponseSchema.parse(unwrapData(parsed));
}

import {
  buildSummary,
  buildUsage,
  filterLogs,
  fixtureDetails,
  fixtureLogs,
  toListItem,
} from './fixtures';
import type {
  DashboardSummary,
  ImportDetail,
  ImportListItem,
  LogEntry,
  LogQuery,
  PageResult,
  UsageReport,
} from './types';

export function usingFixtures(): boolean {
  return import.meta.env.VITE_USE_FIXTURES === 'true';
}

function pageOf<T>(rows: readonly T[], page: number, pageSize: number): PageResult<T> {
  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    meta: { page, pageSize, total, totalPages },
  };
}

function messageFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value !== 'object' || value === null) return undefined;
  if ('message' in value && typeof value.message === 'string' && value.message.trim()) {
    return value.message;
  }
  if ('error' in value) return messageFrom(value.error);
  return undefined;
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;
  try {
    return messageFrom(await response.json()) ?? fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : 'Network request failed';
    throw new Error(message);
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
}

export async function getSummary(): Promise<DashboardSummary> {
  if (usingFixtures()) return buildSummary(fixtureDetails);
  const body = await request<{ data: DashboardSummary }>('/api/v1/dashboard/summary');
  return body.data;
}

export async function getImports(page = 1, pageSize = 50): Promise<PageResult<ImportListItem>> {
  if (usingFixtures()) {
    const rows = fixtureDetails.map(toListItem).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return pageOf(rows, page, pageSize);
  }
  return request<PageResult<ImportListItem>>(
    `/api/v1/dashboard/imports?page=${page}&pageSize=${pageSize}`,
  );
}

export async function getImport(jobId: string): Promise<ImportDetail> {
  if (usingFixtures()) {
    const found = fixtureDetails.find((item) => item.jobId === jobId);
    if (!found) throw new Error(`Import ${jobId} was not found`);
    return found;
  }
  const body = await request<{ data: ImportDetail }>(
    `/api/v1/dashboard/imports/${encodeURIComponent(jobId)}`,
  );
  return body.data;
}

export async function getUsage(): Promise<UsageReport> {
  if (usingFixtures()) return buildUsage(fixtureDetails);
  const body = await request<{ data: UsageReport }>('/api/v1/dashboard/usage');
  return body.data;
}

export async function getLogs(query: LogQuery = {}): Promise<PageResult<LogEntry>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;
  if (usingFixtures()) {
    return pageOf(filterLogs(fixtureLogs, query), page, pageSize);
  }

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (query.level && query.level !== 'all') params.set('level', query.level);
  if (query.jobId?.trim()) params.set('jobId', query.jobId.trim());
  if (query.q?.trim()) params.set('q', query.q.trim());
  return request<PageResult<LogEntry>>(`/api/v1/dashboard/logs?${params.toString()}`);
}

import { listExtractionJobs } from '@/features/extraction/api';
import { errorGroupOf } from '@/features/extraction/error-groups';
import {
  importSrcOf,
  pruneHistory,
  type ImportJob,
} from '@/features/extraction/import-jobs';
import type { JobListItemDto } from '@/features/extraction/schemas';
import { errorCodeOf } from '@/lib/user-error';
import { useImports } from '@/tortie/import-store';

/** An import-history row for a finished server job; null for jobs still running or cancelled. */
function rowFromServer(job: JobListItemDto): ImportJob | null {
  const created = Date.parse(job.createdAt);
  const finished = job.completedAt ? Date.parse(job.completedAt) : created;
  const base = {
    id: `srv-${job.id}`,
    serverJobId: job.id,
    url: job.url,
    src: importSrcOf(job.url),
    createdAt: created,
    finishedAt: finished,
  };
  if (job.status === 'COMPLETED' && job.recipeId) {
    return {
      ...base,
      status: 'done',
      pct: 100,
      recipeId: job.recipeId,
      ...(job.title ? { title: job.title } : {}),
    };
  }
  if (job.status === 'FAILED' || job.status === 'COMPLETED') {
    const code = errorCodeOf(job.error) ?? 'EXTRACTION_FAILED';
    return {
      ...base,
      status: 'failed',
      pct: 0,
      errorCode: code,
      group: errorGroupOf(code),
    };
  }
  return null;
}

/**
 * Adds the server's finished jobs to the local history, skipping any the
 * device already has (same job id, or same saved recipe). Returns the merged
 * list; the input is not modified.
 */
export function mergeServerJobs(
  local: ImportJob[],
  server: JobListItemDto[],
): ImportJob[] {
  const haveJob = new Set(local.map((j) => j.serverJobId).filter(Boolean));
  const haveRecipe = new Set(local.map((j) => j.recipeId).filter(Boolean));
  const added: ImportJob[] = [];
  for (const item of server) {
    if (haveJob.has(item.id)) continue;
    if (item.recipeId && haveRecipe.has(item.recipeId)) continue;
    const row = rowFromServer(item);
    if (row) added.push(row);
  }
  return added.length ? pruneHistory([...local, ...added]) : local;
}

let hydratedFor: string | null = null;

/** Rebuilds the Imports history from the server once per signed-in account. Never throws. */
export async function hydrateImports(uid: string): Promise<void> {
  if (hydratedFor === uid) return;
  hydratedFor = uid;
  try {
    const server = await listExtractionJobs(30);
    const store = useImports.getState();
    const merged = mergeServerJobs(store.jobs, server);
    if (merged !== store.jobs) useImports.setState({ jobs: merged });
  } catch {
    // Offline or the API is older; try again at the next sign-in.
    hydratedFor = null;
  }
}

/** Forget which account was hydrated, so the next sign-in fetches again. */
export function resetImportHydration(): void {
  hydratedFor = null;
}

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getExtractionJob } from '@/features/extraction/api';
import {
  isFailedJobStatus,
  isTerminalJobStatus,
  mapJobToUiStage,
} from '@/features/extraction/stage-map';
import { recipeKeys } from '@/features/query-keys';
import { ApiError } from '@/services/api-client';

const POLL_INTERVAL_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 5000;

function isRateLimited(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 429 || error.code === 'TOO_MANY_REQUESTS')
  );
}

export function extractionPollInterval(args: {
  status?: string;
  error?: unknown;
}): number | false {
  if (isRateLimited(args.error)) {
    return RATE_LIMIT_BACKOFF_MS;
  }
  if (!args.status || isTerminalJobStatus(args.status)) {
    return false;
  }
  return POLL_INTERVAL_MS;
}

export function useExtractionJob(jobId: string | undefined) {
  const queryClient = useQueryClient();
  const refreshedJobId = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ['extraction-job', jobId],
    queryFn: ({ signal }) => getExtractionJob(jobId as string, signal),
    enabled: !!jobId,
    retry: (failureCount, error) => {
      if (isRateLimited(error)) {
        return false;
      }
      return failureCount < 3;
    },
    refetchInterval: (result) =>
      extractionPollInterval({
        status: result.state.data?.status,
        error: result.state.error,
      }),
  });

  const job = query.data;

  useEffect(() => {
    if (!job || job.status !== 'COMPLETED' || !job.recipeId) return;
    if (refreshedJobId.current === job.id) return;
    refreshedJobId.current = job.id;
    queryClient
      .invalidateQueries({ queryKey: recipeKeys.all })
      .catch(() => undefined);
  }, [job, queryClient]);

  const uiStage = job ? mapJobToUiStage(job.status, job.currentStage) : 0;

  return {
    ...query,
    job,
    uiStage,
    isTerminal: job ? isTerminalJobStatus(job.status) : false,
    isFailed: job ? isFailedJobStatus(job.status) : false,
  };
}

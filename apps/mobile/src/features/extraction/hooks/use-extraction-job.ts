import { useQuery } from '@tanstack/react-query';

import { getExtractionJob } from '@/features/extraction/api';
import {
  extractionHeadline,
  isFailedJobStatus,
  isTerminalJobStatus,
  mapJobToUiStage,
} from '@/features/extraction/stage-map';
import { ApiError } from '@/services/api-client';

const POLL_INTERVAL_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 5000;

function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.code === 'TOO_MANY_REQUESTS');
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
  const uiStage = job ? mapJobToUiStage(job.status, job.currentStage) : 0;

  return {
    ...query,
    job,
    uiStage,
    headline: extractionHeadline(uiStage),
    isTerminal: job ? isTerminalJobStatus(job.status) : false,
    isFailed: job ? isFailedJobStatus(job.status) : false,
  };
}

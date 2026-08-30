import {
  cancelJobSchema,
  extractionJobCreateSchema,
  jobStatusSchema,
  type ExtractionJobCreate,
  type JobStatusDto,
} from '@/features/extraction/schemas';
import { apiClient, unwrapData } from '@/services/api-client';

export async function createExtraction(
  input: {
    url: string;
    forceRefresh?: boolean;
    selectedThumbnailUrl?: string;
  },
  signal?: AbortSignal,
): Promise<ExtractionJobCreate> {
  const parsed = await apiClient.post<unknown>(
    '/recipes/extract',
    {
      url: input.url,
      forceRefresh: input.forceRefresh ?? false,
      outputLanguage: 'en',
      options: {
        extractImages: true,
        ...(input.selectedThumbnailUrl
          ? { selectedThumbnailUrl: input.selectedThumbnailUrl }
          : {}),
      },
    },
    { signal },
  );
  return extractionJobCreateSchema.parse(unwrapData(parsed));
}

export async function getExtractionJob(
  id: string,
  signal?: AbortSignal,
): Promise<JobStatusDto> {
  const parsed = await apiClient.get<unknown>(`/recipes/extract/jobs/${id}`, {
    signal,
  });
  return jobStatusSchema.parse(unwrapData(parsed));
}

export async function cancelExtraction(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; status: 'CANCELLED' }> {
  const parsed = await apiClient.post<unknown>(
    `/recipes/extract/jobs/${id}/cancel`,
    undefined,
    { signal },
  );
  return cancelJobSchema.parse(unwrapData(parsed));
}

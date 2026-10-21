import {
  cancelJobSchema,
  jobListItemSchema,
  extractionJobCreateSchema,
  jobStatusSchema,
  type ExtractionJobCreate,
  type JobListItemDto,
  type JobStatusDto,
} from '@/features/extraction/schemas';
import { apiClient, unwrapData } from '@/services/api-client';
import { useTortiePrefs } from '@/tortie/prefs-store';

/** New recipes are written in the user's recipe language; 'original' keeps English. */
function importLanguage(): string {
  const pref = useTortiePrefs.getState().recipeLanguage;
  return pref === 'original' ? 'en' : pref;
}

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
      outputLanguage: importLanguage(),
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

/** `images` are the pages' file contents as base64, in reading order. */
export async function createPhotoExtraction(
  input: { images: string[] },
  signal?: AbortSignal,
): Promise<ExtractionJobCreate> {
  const parsed = await apiClient.post<unknown>(
    '/recipes/extract/photos',
    {
      images: input.images.map((data) => ({ data })),
      outputLanguage: importLanguage(),
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

/** The account's recent import jobs, newest first. */
export async function listExtractionJobs(
  limit = 20,
  signal?: AbortSignal,
): Promise<JobListItemDto[]> {
  const parsed = await apiClient.get<unknown>(
    `/recipes/extract/jobs?limit=${limit}`,
    { signal },
  );
  return jobListItemSchema.array().parse(unwrapData(parsed));
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

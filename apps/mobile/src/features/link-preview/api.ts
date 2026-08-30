import {
  linkPreviewSchema,
  type LinkPreview,
} from '@/features/link-preview/schemas';
import { apiClient, unwrapData } from '@/services/api-client';

export async function fetchLinkPreview(
  url: string,
  signal?: AbortSignal,
): Promise<LinkPreview> {
  const parsed = await apiClient.post<unknown>(
    '/recipes/preview',
    { url },
    { signal },
  );
  return linkPreviewSchema.parse(unwrapData(parsed));
}

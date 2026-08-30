import { useQuery } from '@tanstack/react-query';

import { fetchLinkPreview } from '@/features/link-preview/api';

const PREVIEW_STALE_MS = 60_000;

export function isPreviewableUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }
  return /^https?:\/\/\S+$/i.test(url.trim());
}

export function useLinkPreview(url: string | undefined) {
  const trimmed = url?.trim() ?? '';
  const enabled = isPreviewableUrl(trimmed);

  return useQuery({
    queryKey: ['link-preview', trimmed],
    queryFn: ({ signal }) => fetchLinkPreview(trimmed, signal),
    enabled,
    staleTime: PREVIEW_STALE_MS,
    retry: false,
  });
}

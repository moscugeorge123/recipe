/**
 * The imported video a recipe's step clips play from. The importer stores it on the recipe
 * source's metadata under `video`; the app streams it through `GET /recipes/:id/video`.
 */

export const SOURCE_VIDEO_METADATA_KEY = 'video';

export interface SourceVideo {
  storageKey: string;
  mimeType: string;
  durationSeconds: number | null;
}

/** The stored video in a source's metadata, or null when the import kept none. */
export function sourceVideoFromMetadata(metadata: unknown): SourceVideo | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const video = (metadata as Record<string, unknown>)[SOURCE_VIDEO_METADATA_KEY];
  if (!video || typeof video !== 'object' || Array.isArray(video)) return null;
  const { storageKey, mimeType, durationSeconds } = video as Record<string, unknown>;
  if (typeof storageKey !== 'string' || storageKey.length === 0) return null;
  return {
    storageKey,
    mimeType: typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'video/mp4',
    durationSeconds:
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : null,
  };
}

/** Path of the video stream, relative to the versioned API root. */
export function sourceVideoPath(recipeId: string): string {
  return `/recipes/${recipeId}/video`;
}

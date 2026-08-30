import { collapseYouTubeThumbnails } from './thumbnails.js';

const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;
const PATH_ID_MARKERS = new Set(['embed', 'shorts', 'live', 'v']);

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** watch?v=, youtu.be/, /shorts/, /embed/, /live/, /v/. */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
    }

    const queryId = parsed.searchParams.get('v');
    if (queryId && YOUTUBE_VIDEO_ID.test(queryId)) {
      return queryId;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const marker = parts[0]?.toLowerCase();
    const pathId = parts[1];
    if (marker && pathId && PATH_ID_MARKERS.has(marker) && YOUTUBE_VIDEO_ID.test(pathId)) {
      return pathId;
    }

    return null;
  } catch {
    return null;
  }
}

export function mapYouTubeOembed(input: {
  title?: string | null;
  author_name?: string | null;
  thumbnail_url?: string | null;
}): { title: string | null; author: string | null; thumbnailUrl: string | null } {
  return {
    title: emptyToNull(input.title),
    author: emptyToNull(input.author_name),
    thumbnailUrl: emptyToNull(input.thumbnail_url),
  };
}

/**
 * Poster + numbered stills from the video id. Uses the oEmbed thumbnail when we
 * have no id; never invents maxres (that file 404s on many videos).
 */
export function youtubeFallbackThumbnails(
  videoId: string | null,
  oembedThumbnail?: string | null,
): { url: string }[] {
  if (!videoId) {
    return oembedThumbnail ? [{ url: oembedThumbnail }] : [];
  }

  return collapseYouTubeThumbnails(
    [
      { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { url: `https://i.ytimg.com/vi/${videoId}/1.jpg`, width: 120, height: 90 },
      { url: `https://i.ytimg.com/vi/${videoId}/2.jpg`, width: 120, height: 90 },
      { url: `https://i.ytimg.com/vi/${videoId}/3.jpg`, width: 120, height: 90 },
    ],
    oembedThumbnail ?? undefined,
  );
}

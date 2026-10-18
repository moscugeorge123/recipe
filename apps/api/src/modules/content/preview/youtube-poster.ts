/** The slice of `fetch` the probe needs; both the global fetch and test stand-ins fit. */
export type PosterFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * YouTube poster files best to worst for a card or hero. `maxresdefault` (1280x720) and
 * `hq720` have no black bars; `sddefault` and `hqdefault` are 4:3 files with the 16:9 picture
 * letter-boxed inside.
 */
export const YOUTUBE_POSTER_NAMES = ['maxresdefault', 'hq720', 'sddefault', 'hqdefault'] as const;

/** YouTube answers a missing poster with a ~1.5 KB grey 120x90 image instead of a 404. */
const MIN_POSTER_BYTES = 4_000;
const PROBE_TIMEOUT_MS = 4_000;

export function youtubePosterUrl(videoId: string, name: string): string {
  return `https://i.ytimg.com/vi/${videoId}/${name}.jpg`;
}

/** The poster name in a YouTube thumbnail URL ("maxresdefault"), or null for other URLs. */
export function posterNameOf(url: string): string | null {
  const match = /\/vi(?:_webp)?\/[^/]+\/([^/.?]+)\.(?:jpg|webp)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? null;
}

/** True for a 16:9 poster that has no letter-boxing. */
export function isFullFramePoster(url: string): boolean {
  const name = posterNameOf(url);
  return name === 'maxresdefault' || name === 'hq720';
}

async function posterExists(url: string, fetchImpl: PosterFetch): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.status !== 200) return false;
    const type = response.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('image/')) return false;
    const length = Number(response.headers.get('content-length'));
    return !(Number.isFinite(length) && length > 0 && length < MIN_POSTER_BYTES);
  } catch {
    return false;
  }
}

/**
 * First poster that exists, in `YOUTUBE_POSTER_NAMES` order. Returns null when none answers
 * (offline, blocked), so the caller keeps whatever thumbnail it already had.
 */
export async function probeYouTubePoster(
  videoId: string,
  fetchImpl: PosterFetch = fetch,
): Promise<string | null> {
  for (const name of YOUTUBE_POSTER_NAMES) {
    const url = youtubePosterUrl(videoId, name);
    if (await posterExists(url, fetchImpl)) return url;
  }
  return null;
}

interface PosterCandidate {
  url?: string;
  width?: number;
  height?: number;
}

/**
 * Best thumbnail for a yt-dlp result: the widest full-frame poster it lists (never a `_live`
 * variant), else a probed poster by video id, else yt-dlp's own `thumbnail`.
 */
export async function chooseYouTubeThumbnail(input: {
  videoId: string | null;
  thumbnails?: PosterCandidate[] | undefined;
  thumbnail?: string | undefined;
  fetchImpl?: PosterFetch | undefined;
  probe?: boolean | undefined;
}): Promise<string | undefined> {
  const listed = (input.thumbnails ?? [])
    .filter((thumb): thumb is PosterCandidate & { url: string } => Boolean(thumb.url))
    .filter((thumb) => !/_live/i.test(thumb.url) && isFullFramePoster(thumb.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (listed[0]) return listed[0].url;
  if (input.thumbnail && isFullFramePoster(input.thumbnail)) return input.thumbnail;
  if (input.probe && input.videoId) {
    const probed = await probeYouTubePoster(input.videoId, input.fetchImpl ?? fetch);
    if (probed) return probed;
  }
  return input.thumbnail;
}

import { createHash } from 'node:crypto';

/**
 * Query parameters that share sheets, ad tools and analytics add. They never change which
 * page a link points at, and some (YouTube's `si`) get a fresh value on every share.
 */
const TRACKING_PARAMS = new Set([
  'si',
  'igsh',
  'igshid',
  'fbclid',
  'gclid',
  'feature',
  'pp',
  'ref',
  'ref_',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_r',
  '_t',
]);

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);
const YOUTUBE_ID = /^[\w-]{6,}$/;

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase();
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key);
}

/** The video id for any YouTube URL shape (`youtu.be/ID`, `watch?v=ID`, `/shorts/ID`, …). */
function youtubeVideoId(host: string, url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be') id = parts[0] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * Normalises a URL for deduplication, so two shares of the same page give the same string:
 * https, lower-case host without `www.`, no fragment, no tracking parameters, remaining
 * parameters sorted, no trailing slash or `index.html`, and every YouTube link shape
 * (`youtu.be/ID`, `watch?v=ID`, `m.youtube.com`, `/shorts/ID`) as `youtube.com/watch?v=ID`.
 * The original link is kept separately in `originalUrl`.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  const videoId = youtubeVideoId(host, url);
  if (videoId) return `https://youtube.com/watch?v=${videoId}`;

  url.protocol = 'https:';
  url.hostname = host;
  url.hash = '';

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/index\.(html?|php)$/i, '/');

  let normalized = url.toString();
  if (url.pathname !== '/') {
    normalized = normalized.replace(/\/(?=\?|$)/, '');
  }
  return normalized;
}

/**
 * The normalisation used before tracking parameters, `www.` and YouTube shapes were folded.
 * Sources saved under it keep their hash, so a link imported earlier is still found.
 */
export function legacyNormalizeUrl(raw: string): string {
  const url = new URL(raw);

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'igsh',
  ];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }

  let normalized = url.toString();
  if (normalized.endsWith('/') && url.pathname !== '/') {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/** SHA-256 hash of the normalised URL for dedup lookups. */
export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

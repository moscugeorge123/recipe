import type { LinkPreview } from '@/features/link-preview/schemas';
import type { Brand } from '@/tortie/ui/brand';

export type SharePayload = {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string | null } | null;
};

export type LinkSource = {
  kind: Brand | 'web';
  name: string;
};

export const PLATFORMS: { kind: Brand; name: string; re: RegExp }[] = [
  { kind: 'instagram', name: 'Instagram', re: /instagram\.com|instagr\.am/i },
  { kind: 'tiktok', name: 'TikTok', re: /tiktok\.com/i },
  { kind: 'youtube', name: 'YouTube', re: /youtube\.com|youtu\.be/i },
  { kind: 'pinterest', name: 'Pinterest', re: /pinterest\.|pin\.it/i },
  {
    kind: 'facebook',
    name: 'Facebook',
    re: /facebook\.com|fb\.watch|(?:^|[/.@])fb\.com/i,
  },
];

const HTTP_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

/** A shared link, or null when the share has no usable URL. */
export function handoffFromShare(
  intent: SharePayload,
): { url: string; title: string | null } | null {
  const url = urlFromShare(intent);
  if (!url) return null;
  const title = intent.meta?.title?.trim() || null;
  return { url, title };
}

export function urlFromShare(intent: SharePayload): string | null {
  const fromWeb = normalizeUrl(intent.webUrl);
  if (fromWeb) return fromWeb;
  const text = intent.text ?? '';
  const found = text.match(HTTP_IN_TEXT)?.[0];
  if (found) return normalizeUrl(found);
  return normalizeUrl(text);
}

export function sourceOf(url: string): LinkSource | null {
  const u = url.trim();
  if (!u) return null;
  const platform = PLATFORMS.find((item) => item.re.test(u));
  if (platform) return { kind: platform.kind, name: platform.name };
  if (
    /^https?:\/\//i.test(u) ||
    /^(?:[\w-]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(u)
  ) {
    return { kind: 'web', name: 'Website' };
  }
  return null;
}

export function sourceFromPreview(type: LinkPreview['sourceType']): LinkSource {
  switch (type) {
    case 'INSTAGRAM':
      return { kind: 'instagram', name: 'Instagram' };
    case 'YOUTUBE':
      return { kind: 'youtube', name: 'YouTube' };
    case 'FACEBOOK':
      return { kind: 'facebook', name: 'Facebook' };
    case 'TIKTOK':
      return { kind: 'tiktok', name: 'TikTok' };
    case 'GENERIC_WEB':
      return { kind: 'web', name: 'Website' };
  }
}

export function hostOf(url: string): string {
  const bare = url.replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
  return bare || url;
}

/** Query parameters that share sheets and ad tools add; they never change which page it is. */
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

const YOUTUBE_ID = /^[\w-]{6,}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
]);

/**
 * A stable key for "the same link": two shares of one page give one key, whatever
 * tracking parameters, `www.`/`m.` prefix, scheme or YouTube URL shape they came in. Used
 * to avoid starting a second import of a link that is already importing.
 */
export function importKeyOf(raw: string): string {
  const text = raw.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
  } catch {
    return text.toLowerCase();
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  let videoId: string | null = null;
  if (host === 'youtu.be') videoId = parts[0] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === 'watch') videoId = u.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? ''))
      videoId = parts[1] ?? null;
  }
  if (videoId && YOUTUBE_ID.test(videoId)) {
    return 'youtube.com/watch?v=' + videoId;
  }

  const query = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()) && !/^utm_/i.test(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  return host + '/' + parts.join('/') + (query ? '?' + query : '');
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim().replace(/[)\].,;!?'"]+$/g, '');
  if (!url || /\s/.test(url)) return null;
  if (!/^https?:\/\//i.test(url)) {
    if (/^(?:[\w-]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(url)) url = 'https://' + url;
    else return null;
  }
  return url;
}

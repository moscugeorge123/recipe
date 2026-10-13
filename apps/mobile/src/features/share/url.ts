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

const PLATFORMS: { kind: Brand; name: string; re: RegExp }[] = [
  { kind: 'instagram', name: 'Instagram', re: /instagram\.com|instagr\.am/i },
  { kind: 'tiktok', name: 'TikTok', re: /tiktok\.com/i },
  { kind: 'youtube', name: 'YouTube', re: /youtube\.com|youtu\.be/i },
  { kind: 'pinterest', name: 'Pinterest', re: /pinterest\.|pin\.it/i },
  { kind: 'facebook', name: 'Facebook', re: /facebook\.com|fb\.watch/i },
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

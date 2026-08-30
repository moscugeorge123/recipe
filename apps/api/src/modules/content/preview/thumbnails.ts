export interface YouTubeThumbnailInput {
  url?: string;
  width?: number;
  height?: number;
}

const POSTER_NAMES = new Set([
  'default',
  'mqdefault',
  'hqdefault',
  'sddefault',
  'maxresdefault',
  'hq720',
  '0',
  'default_live',
  'hqdefault_live',
  'sddefault_live',
  'maxresdefault_live',
]);

function filenameStem(url: string): { videoId: string; name: string } | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/vi(?:_webp)?\/([^/]+)\/([^/.]+)/i);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    return { videoId: match[1], name: match[2].toLowerCase() };
  } catch {
    return null;
  }
}

function frameKey(url: string): string {
  const parsed = filenameStem(url);
  if (!parsed) {
    try {
      return new URL(url).href.split('?')[0] ?? url;
    } catch {
      return url;
    }
  }

  const { videoId, name } = parsed;
  if (/^[123]$/.test(name)) {
    return `${videoId}:frame:${name}`;
  }
  if (POSTER_NAMES.has(name) || name.includes('default') || name.includes('hq720')) {
    return `${videoId}:poster`;
  }
  return `${videoId}:${name}`;
}

function resolution(thumb: YouTubeThumbnailInput): number {
  return (thumb.width ?? 0) * (thumb.height ?? 0);
}

function isPosterKey(key: string): boolean {
  return key.endsWith(':poster');
}

/**
 * YouTube's thumbnails[] is mostly the same poster at different sizes.
 * Collapse those to the highest-resolution URL; keep numbered stills (1/2/3.jpg).
 */
export function collapseYouTubeThumbnails(
  thumbnails: YouTubeThumbnailInput[],
  fallback?: string,
): { url: string }[] {
  const groups = new Map<string, YouTubeThumbnailInput>();

  for (const thumb of thumbnails) {
    if (!thumb.url) {
      continue;
    }
    const key = frameKey(thumb.url);
    const existing = groups.get(key);
    if (!existing || resolution(thumb) > resolution(existing)) {
      groups.set(key, thumb);
    }
  }

  const ordered = [...groups.entries()].sort(([keyA], [keyB]) => {
    if (isPosterKey(keyA) && !isPosterKey(keyB)) {
      return -1;
    }
    if (!isPosterKey(keyA) && isPosterKey(keyB)) {
      return 1;
    }
    return keyA.localeCompare(keyB);
  });

  const result = ordered
    .map(([, thumb]) => (thumb.url ? { url: thumb.url } : null))
    .filter((entry): entry is { url: string } => entry !== null);

  if (result.length === 0 && fallback) {
    return [{ url: fallback }];
  }

  return result;
}

export function dedupeExactUrls(urls: string[]): { url: string }[] {
  const seen = new Set<string>();
  const result: { url: string }[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    result.push({ url });
  }
  return result;
}

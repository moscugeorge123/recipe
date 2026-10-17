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

/** Query parameters CDNs use to ask for a smaller copy of an image. */
const RESIZE_PARAMS = ['resize', 'w', 'width', 'h', 'height', 'fit', 'crop', 'quality', 'q'];

/** Largest width an image URL announces ("?w=1200", "resize=440,230", "_1600x900", "/food_16x9_1600/"). */
export function declaredImageWidth(url: string): number | null {
  const widths: number[] = [];
  try {
    const parsed = new URL(url);
    for (const key of ['w', 'width']) {
      const value = Number(parsed.searchParams.get(key));
      if (Number.isFinite(value) && value > 0) widths.push(value);
    }
    const resize = parsed.searchParams.get('resize');
    const resizeWidth = Number(resize?.split(/[,x]/)[0]);
    if (Number.isFinite(resizeWidth) && resizeWidth > 0) widths.push(resizeWidth);
  } catch {
    return null;
  }
  const path = url.split('?')[0] ?? url;
  const pathMatches = [
    ...path.matchAll(/[_-](\d{3,4})x(\d{2,4})(?=[._/-]|$)/g),
    ...path.matchAll(/[_/-](\d{3,4})(?=[./_])/g),
  ];
  for (const match of pathMatches) {
    const value = Number(match[1]);
    if (value >= 200 && value <= 6000) widths.push(value);
  }
  return widths.length > 0 ? Math.max(...widths) : null;
}

/** The same image without the resize query that makes the site serve a thumbnail-sized copy. */
export function stripResizeParams(url: string): string {
  try {
    const parsed = new URL(url);
    // A signed URL covers its query string: changing it would break the image.
    if (['sig', 'signature', 'token', 'hmac', 'expires', 's'].some((key) => parsed.searchParams.has(key))) {
      return url;
    }
    let changed = false;
    for (const key of RESIZE_PARAMS) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Picks the sharpest hero image from a page's og:image / JSON-LD candidates: the one announcing
 * the largest width (first one wins a tie or when none announce a size), without resize params.
 */
export function pickBestImage(candidates: string[]): string | undefined {
  const urls = candidates.filter((url) => url.trim().length > 0);
  if (urls.length === 0) return undefined;
  const first = urls[0];
  if (first === undefined) return undefined;
  let best = first;
  let bestWidth = declaredImageWidth(best) ?? 0;
  for (const url of urls.slice(1)) {
    const width = declaredImageWidth(url) ?? 0;
    if (width > bestWidth) {
      best = url;
      bestWidth = width;
    }
  }
  return stripResizeParams(best);
}

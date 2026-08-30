export const SUPPORTED_PLATFORMS = ['Instagram', 'YouTube', 'Website'] as const;

export const SUPPORTED_CAPTURE_METHODS = [
  'Photo',
  'Text',
  'Voice note',
] as const;

export const SUPPORTED_CAPTURE_SOURCES = [
  ...SUPPORTED_PLATFORMS,
  ...SUPPORTED_CAPTURE_METHODS,
] as const;

export type CaptureSource = (typeof SUPPORTED_CAPTURE_SOURCES)[number];

const LONG_TEXT_MIN_CHARS = 80;
const LONG_TEXT_MIN_LINES = 3;
const LONG_TEXT_MIN_CHARS_WHEN_MULTILINE = 40;

const INSTAGRAM_HOSTS = ['instagram.com', 'instagr.am'] as const;
const YOUTUBE_HOSTS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
] as const;
const UNSUPPORTED_PLATFORM_HOSTS = [
  'tiktok.com',
  'facebook.com',
  'fb.com',
  'fb.watch',
] as const;

export type ClipboardOffer =
  | { kind: 'hidden' }
  | {
      kind: 'url';
      source: Extract<CaptureSource, 'Instagram' | 'YouTube' | 'Website'>;
      url: string;
      preview: string;
    }
  | {
      kind: 'text';
      source: 'Text';
      text: string;
      preview: string;
    };

function hostMatches(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return hosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function unwrapCopiedValue(raw: string): string {
  return raw
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function tryParseHttpUrl(value: string): URL | null {
  const trimmed = unwrapCopiedValue(value);
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }
  if (trimmed.includes('@') && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
      return null;
    }
    if (!/\.[a-z]{2,}$/i.test(host)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function formatUrlPreview(url: URL): string {
  return `${url.host}${url.pathname}${url.search}`.replace(/\/$/, '');
}

function formatTextPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isLongText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length >= LONG_TEXT_MIN_CHARS) {
    return true;
  }
  const lines = trimmed
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return (
    lines.length >= LONG_TEXT_MIN_LINES &&
    trimmed.length >= LONG_TEXT_MIN_CHARS_WHEN_MULTILINE
  );
}

export function inspectClipboard(raw: string): ClipboardOffer {
  const value = raw.trim();
  if (!value) {
    return { kind: 'hidden' };
  }

  const url = tryParseHttpUrl(value);
  if (url) {
    if (hostMatches(url.hostname, INSTAGRAM_HOSTS)) {
      return {
        kind: 'url',
        source: 'Instagram',
        url: url.href,
        preview: formatUrlPreview(url),
      };
    }
    if (hostMatches(url.hostname, YOUTUBE_HOSTS)) {
      return {
        kind: 'url',
        source: 'YouTube',
        url: url.href,
        preview: formatUrlPreview(url),
      };
    }
    if (hostMatches(url.hostname, UNSUPPORTED_PLATFORM_HOSTS)) {
      return { kind: 'hidden' };
    }
    return {
      kind: 'url',
      source: 'Website',
      url: url.href,
      preview: formatUrlPreview(url),
    };
  }

  if (isLongText(value)) {
    return {
      kind: 'text',
      source: 'Text',
      text: value,
      preview: formatTextPreview(value),
    };
  }

  return { kind: 'hidden' };
}

/**
 * `columns` is how tiles are chunked into rows.
 * `tileColumns` is the width divisor so a leftover last row matches the
 * tiles above (a single source is sized like a 2-column card, not a full bar).
 */
export function captureGridMetrics(count: number): {
  columns: number;
  tileColumns: number;
} {
  if (count <= 0) {
    return { columns: 1, tileColumns: 1 };
  }
  if (count === 1) {
    return { columns: 1, tileColumns: 2 };
  }
  if (count === 2 || count === 4) {
    return { columns: 2, tileColumns: 2 };
  }
  return { columns: 3, tileColumns: 3 };
}

export function chunkIntoRows<T>(items: readonly T[], columns: number): T[][] {
  const size = Math.max(columns, 1);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size) as T[]);
  }
  return rows;
}

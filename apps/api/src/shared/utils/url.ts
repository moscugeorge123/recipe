import { createHash } from 'node:crypto';

/**
 * Normalises a URL for deduplication: lowercase host, strip trailing slash,
 * remove common tracking query params.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw);

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'igsh'];
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

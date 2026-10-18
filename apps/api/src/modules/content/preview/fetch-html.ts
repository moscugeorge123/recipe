import { ContentAcquisitionFailedError } from '../../../shared/errors/extraction-errors.js';

export const PREVIEW_HTTP_TIMEOUT_MS = 8_000;
export const PREVIEW_YTDLP_TIMEOUT_MS = 15_000;
/** Many recipe sites answer a bot-looking agent with a block page, so identify as a browser. */
export const HTML_FETCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
export const HTML_FETCH_HEADERS: Record<string, string> = {
  'User-Agent': HTML_FETCH_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Statuses sites use to turn away scrapers (Dotdash Meredith answers 402, Cloudflare 403/503). */
export const BLOCKED_STATUSES = new Set([401, 402, 403, 429, 503]);

const BLOCK_PAGE_PATTERN =
  /captcha|access (?:issue|denied)|verify (?:that )?you are (?:a )?human|just a moment|unusual traffic|are you a robot|pardon our interruption|enable javascript and cookies|cf-chl|attention required/i;
const RECIPE_MARKERS = /recipeIngredient|"@type"\s*:\s*"Recipe"|itemprop=["']recipeIngredient/i;
const BLOCK_PAGE_MAX_CHARS = 8_000;

/**
 * True for the short interstitial a site returns with status 200 instead of its page
 * ("Access issue", captcha, "Just a moment..."). Real recipe pages are long and carry markers.
 */
export function looksLikeBlockPage(html: string): boolean {
  return (
    html.length < BLOCK_PAGE_MAX_CHARS && BLOCK_PAGE_PATTERN.test(html) && !RECIPE_MARKERS.test(html)
  );
}

export type FetchLike = typeof fetch;

export async function fetchHtml(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: FetchLike; userAgent?: string } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? PREVIEW_HTTP_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...HTML_FETCH_HEADERS,
        ...(options.userAgent ? { 'User-Agent': options.userAgent } : {}),
      },
    });
  } catch (error: unknown) {
    throw new ContentAcquisitionFailedError({
      message: 'Failed to fetch web page',
      cause: error,
    });
  }

  if (!response.ok) {
    throw new ContentAcquisitionFailedError({
      message: `Web fetch failed with status ${String(response.status)}`,
      httpStatus: response.status,
      ...(BLOCKED_STATUSES.has(response.status)
        ? { reason: 'BLOCKED' as const }
        : response.status === 404 || response.status === 410
          ? { reason: 'NOT_FOUND' as const }
          : {}),
    });
  }

  const html = await response.text();
  if (looksLikeBlockPage(html)) {
    throw new ContentAcquisitionFailedError({
      message: 'Web fetch returned a block page',
      httpStatus: response.status,
      reason: 'BLOCKED',
    });
  }
  return html;
}

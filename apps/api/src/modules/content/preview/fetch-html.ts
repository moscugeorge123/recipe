import { ContentAcquisitionFailedError } from '../../../shared/errors/extraction-errors.js';

export const PREVIEW_HTTP_TIMEOUT_MS = 8_000;
export const PREVIEW_YTDLP_TIMEOUT_MS = 15_000;
export const HTML_FETCH_USER_AGENT = 'RecipeExtractionBot/0.1';

export type FetchLike = typeof fetch;

export async function fetchHtml(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: FetchLike; userAgent?: string } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? PREVIEW_HTTP_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? HTML_FETCH_USER_AGENT;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': userAgent },
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
    });
  }

  return response.text();
}

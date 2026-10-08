import type { FetchLike } from '../../preview/fetch-html.js';

export interface FetchedPage {
  html: string;
  finalUrl: string;
  httpStatus: number | null;
}

/** Fetches a page's HTML some other way when a site blocks our direct request. */
export interface BlockedPageFetcher {
  readonly name: string;
  fetchHtml(url: string): Promise<FetchedPage>;
}

interface RagWebBrowserItem {
  crawl?: { httpStatusCode?: number; loadedUrl?: string; requestStatus?: string };
  metadata?: { url?: string; title?: string };
  html?: string | null;
  error?: string;
}

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~rag-web-browser';
/** Headless Chrome through Apify Proxy; the page itself gets 60 s, the whole run 120 s. */
const PAGE_TIMEOUT_SECS = 60;
const RUN_TIMEOUT_SECS = 120;

/**
 * Renders a page in Apify's `rag-web-browser` (Playwright + Apify Proxy).
 *
 * Gets past fingerprint/IP blocks such as Dotdash Meredith's 402 (AllRecipes, Simply Recipes,
 * Serious Eats). The actor strips `<script>` tags, so JSON-LD is lost and extraction relies on the
 * visible page text. Cloudflare challenge pages still fail.
 */
export class ApifyPageFetcher implements BlockedPageFetcher {
  readonly name = 'apify-rag-web-browser';

  constructor(
    private readonly apiToken: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async fetchHtml(url: string): Promise<FetchedPage> {
    const response = await this.fetchImpl(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(this.apiToken)}&timeout=${String(RUN_TIMEOUT_SECS)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: url,
          maxResults: 1,
          outputFormats: ['html'],
          scrapingTool: 'browser-playwright',
          htmlTransformer: 'none',
          removeElementsCssSelector: '',
          removeCookieWarnings: true,
          requestTimeoutSecs: PAGE_TIMEOUT_SECS,
        }),
        signal: AbortSignal.timeout((RUN_TIMEOUT_SECS + 15) * 1000),
      },
    );

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Apify request failed: ${String(response.status)} ${response.statusText}`);
    }

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? JSON.stringify(body.error)
          : String(response.status);
      throw new Error(`Apify request failed: ${message}`);
    }

    const item = Array.isArray(body) ? (body[0] as RagWebBrowserItem | undefined) : undefined;
    const httpStatus = item?.crawl?.httpStatusCode ?? null;
    const html = item?.html ?? '';
    if (!item || !html.trim() || (httpStatus !== null && httpStatus >= 400)) {
      throw new Error(
        `Apify could not load the page (status ${String(httpStatus ?? 'unknown')}${item?.error ? `: ${item.error}` : ''})`,
      );
    }

    return {
      html,
      finalUrl: item.crawl?.loadedUrl ?? item.metadata?.url ?? url,
      httpStatus,
    };
  }
}

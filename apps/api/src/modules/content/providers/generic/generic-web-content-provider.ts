import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import { HTML_FETCH_USER_AGENT, type FetchLike } from '../../preview/fetch-html.js';
import { extractAllMeta, parseOpenGraph } from '../../preview/open-graph.js';
import { hasRecipeBody } from '../../domain/structured-recipe.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';
import type { BlockedPageFetcher } from './apify-page-fetcher.js';
import { extractPageText, PAGE_TEXT_LIMIT } from './page-text.js';
import { parseStructuredRecipe } from './structured-recipe-parser.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_HTML_CHARS = 3_000_000;
/** Structured data already carries the recipe; page text is only supporting context then. */
const PAGE_TEXT_LIMIT_WITH_STRUCTURED = 4_000;

/** Statuses sites use to turn away scrapers (Dotdash Meredith answers 402, Cloudflare 403/503). */
const BLOCKED_STATUSES = new Set([401, 402, 403, 429, 503]);

export interface GenericWebContentProviderOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Used when the site blocks the direct request; without it a blocked site fails the import. */
  blockedPageFetcher?: BlockedPageFetcher;
}

export class GenericWebContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'GENERIC_WEB';

  constructor(private readonly options: GenericWebContentProviderOptions = {}) {}

  private async fetchBlockedPage(
    url: string,
    status: number,
    ctx: AcquisitionContext,
  ): Promise<string> {
    const fetcher = this.options.blockedPageFetcher;
    const blockedError = (cause?: unknown): ContentAcquisitionFailedError =>
      new ContentAcquisitionFailedError({
        message: `This website blocks recipe imports (status ${String(status)})`,
        ...(cause ? { cause } : {}),
      });

    if (!fetcher) {
      ctx.log?.error(
        { step: 'web.fetch-fallback', url, httpStatus: status },
        'web.fetch-fallback unavailable (no APIFY_API_TOKEN or fallback disabled)',
      );
      throw blockedError();
    }

    const startedAt = Date.now();
    const fields = { step: 'web.fetch-fallback', url, fetcher: fetcher.name, blockedStatus: status };
    ctx.log?.info(fields, 'web.fetch-fallback started');
    try {
      const page = await fetcher.fetchHtml(url);
      ctx.log?.info(
        {
          ...fields,
          durationMs: Date.now() - startedAt,
          httpStatus: page.httpStatus,
          finalUrl: page.finalUrl,
          htmlChars: page.html.length,
        },
        'web.fetch-fallback completed',
      );
      return page.html;
    } catch (error: unknown) {
      ctx.log?.error(
        { ...fields, durationMs: Date.now() - startedAt, err: error },
        'web.fetch-fallback failed',
      );
      throw blockedError(error);
    }
  }

  supports(url: string): boolean {
    try {
      const protocol = new URL(url).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    const log = ctx.log;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fetchStartedAt = Date.now();
    log?.info({ step: 'web.fetch', url, timeoutMs }, 'web.fetch started');

    let response: Response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': HTML_FETCH_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        },
      });
    } catch (error: unknown) {
      log?.error(
        { step: 'web.fetch', url, durationMs: Date.now() - fetchStartedAt, err: error },
        'web.fetch failed',
      );
      throw new ContentAcquisitionFailedError({
        message: 'Failed to fetch web page',
        cause: error,
      });
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const fetchFields = {
      step: 'web.fetch',
      url,
      finalUrl: response.url || url,
      httpStatus: response.status,
      contentType: contentType || null,
      durationMs: Date.now() - fetchStartedAt,
    };

    let rawHtml: string;
    if (BLOCKED_STATUSES.has(response.status)) {
      log?.warn(fetchFields, 'web.fetch blocked by the site');
      rawHtml = await this.fetchBlockedPage(url, response.status, ctx);
    } else {
      if (!response.ok) {
        log?.error(fetchFields, 'web.fetch failed: non-2xx status');
        throw new ContentAcquisitionFailedError({
          message: `Web fetch failed with status ${String(response.status)}`,
        });
      }

      if (contentType && !/html|xml|text\/plain/.test(contentType)) {
        log?.error(fetchFields, 'web.fetch failed: response is not a web page');
        throw new ContentAcquisitionFailedError({
          message: `Link is not a web page (${contentType.split(';')[0] ?? contentType})`,
        });
      }

      rawHtml = await response.text();
      log?.info(
        { ...fetchFields, htmlChars: rawHtml.length, truncated: rawHtml.length > MAX_HTML_CHARS },
        'web.fetch completed',
      );
    }
    const html = rawHtml.slice(0, MAX_HTML_CHARS);

    const og = parseOpenGraph(html);
    const structured = parseStructuredRecipe(html, url);
    const pageText = extractPageText(
      html,
      hasRecipeBody(structured) ? PAGE_TEXT_LIMIT_WITH_STRUCTURED : PAGE_TEXT_LIMIT,
    );
    log?.info(
      {
        step: 'web.parse',
        ogTitle: og.title ?? null,
        ogImages: og.images.length,
        structuredSource: structured?.source ?? null,
        structuredIngredients: structured?.ingredients.length ?? 0,
        structuredSteps:
          structured?.instructions.reduce((sum, section) => sum + section.steps.length, 0) ?? 0,
        pageTextChars: pageText.length,
      },
      structured ? 'web.parse found schema.org recipe data' : 'web.parse found no schema.org recipe data',
    );

    // parseOpenGraph falls back to <title>, which usually carries a " | Site name" suffix.
    const title = extractAllMeta(html, 'og:title')[0] ?? structured?.name ?? og.title ?? undefined;
    const description = og.description ?? structured?.description;
    const images = dedupe([...og.images, ...(structured?.images ?? [])]);
    const thumbnailUrl = images[0];
    const language = structured?.language ?? htmlLang(html);

    return {
      sourceType: 'GENERIC_WEB',
      originalUrl: url,
      normalizedUrl: url,
      ...(title ? { title } : {}),
      ...(description ? { description, caption: description } : {}),
      ...(structured?.author ? { author: structured.author } : {}),
      ...(language ? { language } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      images: images.map((imageUrl) => ({ url: imageUrl, mimeType: 'image/jpeg' as const })),
      metadata: {
        provider: 'http-fetch',
        structuredData: structured?.source ?? null,
      },
      ...(structured ? { structuredRecipe: structured } : {}),
      ...(pageText ? { pageText } : {}),
    };
  }
}

function htmlLang(html: string): string | undefined {
  return /<html\b[^>]*\blang\s*=\s*["']([a-zA-Z-]{2,12})["']/i.exec(html)?.[1];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

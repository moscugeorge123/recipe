import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';

const GENERIC_HOSTS = ['example.com', 'www.example.com'];

export class GenericWebContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'GENERIC_WEB';

  supports(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return GENERIC_HOSTS.includes(host);
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    void ctx;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'RecipeExtractionBot/0.1' },
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

    const html = await response.text();
    const title = extractMeta(html, 'og:title') ?? extractTag(html, 'title');
    const description =
      extractMeta(html, 'og:description') ?? extractMeta(html, 'description') ?? extractTag(html, 'description');

    return {
      sourceType: 'GENERIC_WEB',
      originalUrl: url,
      normalizedUrl: url,
      ...(title ? { title } : {}),
      ...(description ? { description, caption: description } : {}),
      images: [],
      metadata: { provider: 'http-fetch' },
    };
  }
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

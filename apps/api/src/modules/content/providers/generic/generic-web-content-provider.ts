import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import { HTML_FETCH_USER_AGENT } from '../../preview/fetch-html.js';
import { parseOpenGraph } from '../../preview/open-graph.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';

export class GenericWebContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'GENERIC_WEB';

  supports(url: string): boolean {
    try {
      const protocol = new URL(url).protocol;
      return protocol === 'http:' || protocol === 'https:';
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
        headers: { 'User-Agent': HTML_FETCH_USER_AGENT },
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
    const og = parseOpenGraph(html);
    const thumbnailUrl = og.images[0];

    return {
      sourceType: 'GENERIC_WEB',
      originalUrl: url,
      normalizedUrl: url,
      ...(og.title ? { title: og.title } : {}),
      ...(og.description ? { description: og.description, caption: og.description } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      images: og.images.map((imageUrl) => ({ url: imageUrl, mimeType: 'image/jpeg' as const })),
      metadata: { provider: 'http-fetch' },
    };
  }
}

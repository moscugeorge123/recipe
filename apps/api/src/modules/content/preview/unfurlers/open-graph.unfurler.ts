import { fetchHtml, PREVIEW_HTTP_TIMEOUT_MS, type FetchLike } from '../fetch-html.js';
import { parseOpenGraph } from '../open-graph.js';
import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import { dedupeExactUrls, pickBestImage } from '../thumbnails.js';
import type { LinkPreview, LinkUnfurler } from '../types.js';

export class OpenGraphLinkUnfurler implements LinkUnfurler {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = PREVIEW_HTTP_TIMEOUT_MS,
  ) {}

  supports(url: string): boolean {
    try {
      const protocol = new URL(url).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  async unfurl(url: string): Promise<LinkPreview> {
    let html: string;
    try {
      html = await fetchHtml(url, {
        timeoutMs: this.timeoutMs,
        fetchImpl: this.fetchImpl,
      });
    } catch (error: unknown) {
      // A site that turns scrapers away is not offline: say so, and let the import try its fallback.
      if (error instanceof ContentAcquisitionFailedError && error.reason === 'BLOCKED') {
        return {
          url,
          sourceType: 'GENERIC_WEB',
          title: null,
          author: null,
          description: null,
          thumbnails: [],
          blocked: true,
        };
      }
      throw error;
    }
    const og = parseOpenGraph(html);
    const best = pickBestImage(og.images);

    return {
      url,
      sourceType: 'GENERIC_WEB',
      title: og.title,
      author: null,
      description: og.description,
      thumbnails: dedupeExactUrls(best ? [best, ...og.images.filter((image) => image !== best)] : []),
    };
  }
}

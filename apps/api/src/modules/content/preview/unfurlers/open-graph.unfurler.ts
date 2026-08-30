import { fetchHtml, PREVIEW_HTTP_TIMEOUT_MS, type FetchLike } from '../fetch-html.js';
import { parseOpenGraph } from '../open-graph.js';
import { dedupeExactUrls } from '../thumbnails.js';
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
    const html = await fetchHtml(url, {
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    const og = parseOpenGraph(html);

    return {
      url,
      sourceType: 'GENERIC_WEB',
      title: og.title,
      author: null,
      description: og.description,
      thumbnails: dedupeExactUrls(og.images),
    };
  }
}

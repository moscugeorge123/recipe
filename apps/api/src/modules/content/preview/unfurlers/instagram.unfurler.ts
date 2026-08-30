import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { AppLogger } from '../../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../../infrastructure/logging/logger.js';
import { logStep } from '../../../../infrastructure/logging/log-step.js';
import { fetchHtml, PREVIEW_HTTP_TIMEOUT_MS, type FetchLike } from '../fetch-html.js';
import { mapInstagramOembed, parseInstagramOgTitle } from '../instagram-mapper.js';
import { parseOpenGraph } from '../open-graph.js';
import type { LinkPreview, LinkUnfurler } from '../types.js';

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com'];
const GRAPH_OEMBED_URL = 'https://graph.facebook.com/v21.0/instagram_oembed';

export interface InstagramUnfurlerOptions {
  appId?: string;
  appSecret?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  log?: AppLogger;
}

export class InstagramLinkUnfurler implements LinkUnfurler {
  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly log: AppLogger;

  constructor(options: InstagramUnfurlerOptions = {}) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? PREVIEW_HTTP_TIMEOUT_MS;
    this.log = options.log ?? silentLogger();
  }

  supports(url: string): boolean {
    try {
      const parsed = new URL(url);
      return INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  async unfurl(url: string): Promise<LinkPreview> {
    const appId = this.appId;
    const appSecret = this.appSecret;
    if (appId && appSecret) {
      return logStep(this.log, 'instagram.graph-oembed', { url }, () =>
        this.unfurlViaGraph(url, appId, appSecret),
      );
    }
    return logStep(this.log, 'instagram.open-graph', { url }, () => this.unfurlViaOpenGraph(url));
  }

  private async unfurlViaGraph(
    url: string,
    appId: string,
    appSecret: string,
  ): Promise<LinkPreview> {
    const token = `${appId}|${appSecret}`;
    const endpoint = new URL(GRAPH_OEMBED_URL);
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('access_token', token);

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint.toString(), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error: unknown) {
      throw new ContentAcquisitionFailedError({
        message: 'Failed to fetch Instagram oEmbed',
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ContentAcquisitionFailedError({
        message: `Instagram oEmbed failed with status ${String(response.status)}`,
      });
    }

    const body = (await response.json()) as {
      author_name?: string;
      title?: string;
      thumbnail_url?: string;
    };
    const mapped = mapInstagramOembed(body);

    return {
      url,
      sourceType: 'INSTAGRAM',
      title: mapped.title,
      author: mapped.author,
      description: null,
      thumbnails: mapped.thumbnailUrl ? [{ url: mapped.thumbnailUrl }] : [],
    };
  }

  private async unfurlViaOpenGraph(url: string): Promise<LinkPreview> {
    const html = await fetchHtml(url, {
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    const og = parseOpenGraph(html);
    const parsed = parseInstagramOgTitle(og.title);
    const image = og.images[0];

    return {
      url,
      sourceType: 'INSTAGRAM',
      title: parsed.title,
      author: parsed.author,
      description: null,
      thumbnails: image ? [{ url: image }] : [],
    };
  }
}

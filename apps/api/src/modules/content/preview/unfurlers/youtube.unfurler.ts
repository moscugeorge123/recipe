import type { AppLogger } from '../../../../infrastructure/logging/logger.js';
import { silentLogger } from '../../../../infrastructure/logging/logger.js';
import { logStep } from '../../../../infrastructure/logging/log-step.js';
import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { VideoDownloadClient } from '../../providers/youtube/ytdlp-client.js';
import {
  HTML_FETCH_USER_AGENT,
  PREVIEW_HTTP_TIMEOUT_MS,
  PREVIEW_YTDLP_TIMEOUT_MS,
  type FetchLike,
} from '../fetch-html.js';
import { collapseYouTubeThumbnails } from '../thumbnails.js';
import { posterNameOf, probeYouTubePoster } from '../youtube-poster.js';
import type { LinkPreview, LinkUnfurler } from '../types.js';
import {
  extractYouTubeVideoId,
  mapYouTubeOembed,
  youtubeFallbackThumbnails,
} from '../youtube-mapper.js';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
const OEMBED_URL = 'https://www.youtube.com/oembed';
/** 4:3 poster files with the 16:9 picture letter-boxed inside. */
const BOXED_POSTERS = new Set(['hqdefault', 'sddefault']);

export interface YouTubeUnfurlerOptions {
  timeoutMs?: number;
  httpTimeoutMs?: number;
  fetchImpl?: FetchLike;
  log?: AppLogger;
}

export class YouTubeLinkUnfurler implements LinkUnfurler {
  private readonly timeoutMs: number;
  private readonly httpTimeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly log: AppLogger;

  constructor(
    private readonly ytdlp: VideoDownloadClient,
    options: YouTubeUnfurlerOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? PREVIEW_YTDLP_TIMEOUT_MS;
    this.httpTimeoutMs = options.httpTimeoutMs ?? PREVIEW_HTTP_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.log = options.log ?? silentLogger();
  }

  supports(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return YOUTUBE_HOSTS.includes(host) || host.endsWith('.youtube.com');
    } catch {
      return false;
    }
  }

  async unfurl(url: string): Promise<LinkPreview> {
    try {
      return await logStep(this.log, 'youtube.oembed', { url }, () => this.unfurlViaOembed(url));
    } catch (oembedError: unknown) {
      this.log.warn({ step: 'youtube.oembed', url, err: oembedError }, 'youtube.oembed failed');
      try {
        return await logStep(this.log, 'youtube.ytdlp-preview', { url }, () =>
          this.unfurlViaYtdlp(url),
        );
      } catch {
        throw oembedError;
      }
    }
  }

  private async unfurlViaYtdlp(url: string): Promise<LinkPreview> {
    const metadata = await this.ytdlp.fetchMetadata(url, { timeoutMs: this.timeoutMs });

    return {
      url,
      sourceType: 'YOUTUBE',
      title: metadata.title?.trim() || null,
      author: metadata.uploader?.trim() || null,
      description: metadata.description?.trim() || null,
      thumbnails: collapseYouTubeThumbnails(metadata.thumbnails ?? [], metadata.thumbnail),
    };
  }

  private async unfurlViaOembed(url: string): Promise<LinkPreview> {
    const endpoint = new URL(OEMBED_URL);
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('format', 'json');

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint.toString(), {
        signal: AbortSignal.timeout(this.httpTimeoutMs),
        headers: { 'User-Agent': HTML_FETCH_USER_AGENT },
      });
    } catch (error: unknown) {
      throw new ContentAcquisitionFailedError({
        message: 'Failed to fetch YouTube metadata',
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ContentAcquisitionFailedError({
        message: `YouTube oEmbed failed with status ${String(response.status)}`,
      });
    }

    const body = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    const mapped = mapYouTubeOembed(body);
    const videoId = extractYouTubeVideoId(url);
    const thumbnails = youtubeFallbackThumbnails(videoId, mapped.thumbnailUrl);
    // oEmbed and the hqdefault fallback are 4:3 files with black bars: lead with a full-frame poster.
    const poster = videoId ? await probeYouTubePoster(videoId, this.fetchImpl) : null;

    return {
      url,
      sourceType: 'YOUTUBE',
      title: mapped.title,
      author: mapped.author,
      description: null,
      thumbnails: poster
        ? [{ url: poster }, ...thumbnails.filter((thumb) => !BOXED_POSTERS.has(posterNameOf(thumb.url) ?? ''))]
        : thumbnails,
    };
  }
}

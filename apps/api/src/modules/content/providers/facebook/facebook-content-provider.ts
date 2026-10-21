import path from 'node:path';

import type { SourceType } from '@prisma/client';

import { logStep } from '../../../../infrastructure/logging/log-step.js';
import {
  CONTENT_FAILURE_MESSAGES,
  ContentAcquisitionFailedError,
  classifyAcquisitionFailure,
} from '../../../../shared/errors/extraction-errors.js';
import { downloadMediaToFile, type FetchLike } from '../../../../shared/utils/download-media.js';
import type {
  AcquiredContent,
  AcquisitionContext,
  ContentImage,
  ContentProvider,
  ContentVideo,
} from '../../domain/types.js';
import type { VideoDownloadClient, YtDlpMetadata } from '../youtube/ytdlp-client.js';
import type { ApifyFacebookClient, ApifyFacebookPost } from './apify-facebook-client.js';
import {
  extractFacebookMedia,
  facebookAuthor,
  facebookPostText,
  isFacebookHost,
  looksLikeFacebookVideoUrl,
} from './facebook-media.js';

export interface FacebookProviderOptions {
  /** Videos downloaded per post (MAX_POST_VIDEOS). */
  maxVideos?: number;
  maxDownloadBytes?: number;
  fetchImpl?: FetchLike;
}

const DEFAULT_MAX_VIDEOS = 3;
const DEFAULT_MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Imports public Facebook posts, photo posts and reels.
 *
 * Text and photos come from the Apify Facebook Posts Scraper. Videos are downloaded from the URLs
 * it returns, or with yt-dlp when it returns none (reels and watch links), so frames, audio and
 * on-screen text can be read like any other video import.
 */
export class FacebookContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'FACEBOOK';

  constructor(
    private readonly apify?: ApifyFacebookClient,
    private readonly ytdlp?: VideoDownloadClient,
    private readonly options: FacebookProviderOptions = {},
  ) {}

  supports(url: string): boolean {
    try {
      return isFacebookHost(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    const post = await this.fetchPost(url, ctx);
    const media = post ? extractFacebookMedia(post) : undefined;
    const postText = post ? facebookPostText(post) : undefined;

    const downloadErrors: string[] = [];
    const videos: ContentVideo[] = [];
    let ytdlpMetadata: YtDlpMetadata | undefined;

    const wantsVideo = looksLikeFacebookVideoUrl(url) || media?.hasVideo === true;
    if (wantsVideo) {
      const direct = await this.downloadDirectVideos(media?.videoUrls ?? [], ctx, downloadErrors);
      videos.push(...direct);
      if (videos.length === 0) {
        const viaYtDlp = await this.downloadWithYtDlp(url, ctx, downloadErrors);
        if (viaYtDlp) {
          videos.push({ localPath: viaYtDlp.filePath });
          ytdlpMetadata = viaYtDlp.metadata;
        }
      }
    }

    const photos = media?.photos ?? [];
    const images: ContentImage[] = photos.map((photoUrl, index) => ({
      url: photoUrl,
      mimeType: 'image/jpeg',
      slideIndex: index + 1,
    }));
    const text = postText ?? firstNonEmpty(ytdlpMetadata?.description);
    const title = firstNonEmpty(post?.title, ytdlpMetadata?.title);
    const author = (post ? facebookAuthor(post) : undefined) ?? firstNonEmpty(ytdlpMetadata?.uploader);

    if (!text && images.length === 0 && videos.length === 0) {
      const detail = downloadErrors.join('; ');
      const reason = classifyAcquisitionFailure(detail);
      throw new ContentAcquisitionFailedError({
        message: reason
          ? CONTENT_FAILURE_MESSAGES[reason]
          : detail
            ? `No Facebook content could be read: ${detail}`
            : 'No text, photo or video could be read from this Facebook link',
        ...(reason ? { reason } : {}),
      });
    }

    const thumbnailUrl = media?.poster ?? ytdlpMetadata?.thumbnail;
    if (images.length === 0 && thumbnailUrl) {
      images.push({ url: thumbnailUrl, mimeType: 'image/jpeg' });
    }

    return {
      sourceType: 'FACEBOOK',
      originalUrl: url,
      normalizedUrl: url,
      ...(title ? { title } : {}),
      ...(text ? { caption: text, description: text } : {}),
      ...(author ? { author } : {}),
      ...(ytdlpMetadata?.language ? { language: ytdlpMetadata.language } : {}),
      ...(videos[0] ? { videoLocalPath: videos[0].localPath, videos } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      images,
      metadata: {
        provider: post ? 'apify' : 'yt-dlp',
        ...(ytdlpMetadata?.duration ? { durationSeconds: ytdlpMetadata.duration } : {}),
        ...(photos.length > 1 ? { slideCount: photos.length } : {}),
        ...(downloadErrors.length > 0 ? { downloadError: downloadErrors.join('; ') } : {}),
      },
    };
  }

  /**
   * The post text and photos. A failure here is only fatal when there is no other way in: reel and
   * watch links can still be read by yt-dlp.
   */
  private async fetchPost(url: string, ctx: AcquisitionContext): Promise<ApifyFacebookPost | undefined> {
    const apify = this.apify;
    if (!apify) {
      if (looksLikeFacebookVideoUrl(url) && this.ytdlp) return undefined;
      throw new ContentAcquisitionFailedError({
        message: 'Facebook import is not configured: APIFY_API_TOKEN is missing',
      });
    }

    const scrape = (): Promise<ApifyFacebookPost[]> =>
      apify.runFacebookPostsScraper({ url, resultsLimit: 1 });
    try {
      const posts = ctx.log ? await logStep(ctx.log, 'facebook.apify', { url }, scrape) : await scrape();
      return posts[0];
    } catch (error: unknown) {
      if (looksLikeFacebookVideoUrl(url) && this.ytdlp) {
        ctx.log?.warn({ step: 'facebook.apify', url, err: error }, 'facebook.apify failed; trying yt-dlp');
        return undefined;
      }
      if (error instanceof ContentAcquisitionFailedError) throw error;
      const detail = error instanceof Error ? error.message : 'Unknown Apify error';
      const reason = classifyAcquisitionFailure(detail);
      throw new ContentAcquisitionFailedError({
        message: reason ? CONTENT_FAILURE_MESSAGES[reason] : `Failed to acquire Facebook content: ${detail}`,
        ...(reason ? { reason } : {}),
        cause: error,
      });
    }
  }

  private async downloadDirectVideos(
    urls: string[],
    ctx: AcquisitionContext,
    errors: string[],
  ): Promise<ContentVideo[]> {
    const videos: ContentVideo[] = [];
    const limit = this.options.maxVideos ?? DEFAULT_MAX_VIDEOS;
    const isCarousel = urls.length > 1;

    for (const [index, videoUrl] of urls.slice(0, limit).entries()) {
      const slideIndex = index + 1;
      const destPath = path.join(ctx.tempDir, isCarousel ? `video-${String(slideIndex)}.mp4` : 'video.mp4');
      const download = (): Promise<unknown> =>
        downloadMediaToFile(videoUrl, destPath, {
          maxBytes: this.options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES,
          timeoutMs: 180_000,
          acceptContentTypes: ['video/', 'application/octet-stream', 'binary/octet-stream'],
          ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
        });
      try {
        await (ctx.log
          ? logStep(ctx.log, 'facebook.download-video', { index: slideIndex }, download)
          : download());
        videos.push({ localPath: destPath });
      } catch (error: unknown) {
        errors.push(`video ${String(slideIndex)}: ${error instanceof Error ? error.message : 'unknown error'}`);
        ctx.log?.warn({ step: 'facebook.download-video', err: error }, 'facebook.download-video failed');
      }
    }

    return videos;
  }

  private async downloadWithYtDlp(
    url: string,
    ctx: AcquisitionContext,
    errors: string[],
  ): Promise<{ filePath: string; metadata: YtDlpMetadata } | undefined> {
    const ytdlp = this.ytdlp;
    if (!ytdlp) return undefined;

    const destPath = path.join(ctx.tempDir, 'video.mp4');
    const download = (): Promise<{ filePath: string; metadata: YtDlpMetadata }> =>
      ytdlp.download(url, destPath);
    try {
      return await (ctx.log ? logStep(ctx.log, 'facebook.ytdlp', { url }, download) : download());
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      errors.push(`yt-dlp: ${detail}`);
      ctx.log?.warn({ step: 'facebook.ytdlp', url, err: error }, 'facebook.ytdlp failed');
      return undefined;
    }
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

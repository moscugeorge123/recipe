import path from 'node:path';

import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import { downloadMediaToFile, type FetchLike } from '../../../../shared/utils/download-media.js';
import { logStep } from '../../../../infrastructure/logging/log-step.js';
import type {
  AcquiredContent,
  AcquisitionContext,
  ContentImage,
  ContentProvider,
  ContentVideo,
} from '../../domain/types.js';
import type { ApifyClient, ApifyInstagramPost } from './apify-client.js';
import { extractInstagramSlides, type InstagramSlide } from './instagram-slides.js';

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com'];

export interface InstagramProviderOptions {
  /** Carousel videos downloaded per post (MAX_POST_VIDEOS). */
  maxVideos?: number;
  maxDownloadBytes?: number;
  fetchImpl?: FetchLike;
}

export class InstagramContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'INSTAGRAM';

  constructor(
    private readonly apify: ApifyClient,
    private readonly options: InstagramProviderOptions = {},
  ) {}

  supports(url: string): boolean {
    try {
      const parsed = new URL(url);
      return INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    const posts = await (async (): Promise<ApifyInstagramPost[]> => {
      const scrape = (): Promise<ApifyInstagramPost[]> =>
        this.apify.runInstagramScraper({ directUrls: [url], resultsLimit: 1 });
      try {
        return ctx.log
          ? await logStep(ctx.log, 'instagram.apify', { url }, scrape)
          : await scrape();
      } catch (error: unknown) {
        if (error instanceof ContentAcquisitionFailedError) {
          throw error;
        }
        const detail = error instanceof Error ? error.message : 'Unknown Apify error';
        throw new ContentAcquisitionFailedError({
          message: `Failed to acquire Instagram content: ${detail}`,
          cause: error,
        });
      }
    })();

    const post = posts[0];
    if (!post) {
      throw new ContentAcquisitionFailedError({
        message: 'No Instagram content returned for URL',
      });
    }

    const postText = firstNonEmpty(post.caption, post.text);
    const slides = extractInstagramSlides(post);

    // Image/carousel posts often carry the whole recipe on the slides with no caption at all.
    if (!postText && slides.length === 0) {
      throw new ContentAcquisitionFailedError({
        message: 'Apify returned Instagram content without a caption, text, image or video',
      });
    }

    const isCarousel = slides.length > 1;
    const images: ContentImage[] = [];
    for (const slide of slides) {
      if (slide.kind === 'image' && slide.imageUrl) {
        images.push({ url: slide.imageUrl, mimeType: 'image/jpeg', slideIndex: slide.slideIndex });
      }
    }
    if (images.length === 0 && post.displayUrl) {
      // Reel cover: kept for previews, but without a slide index it is not OCR'd.
      images.push({ url: post.displayUrl, mimeType: 'image/jpeg' });
    }

    const { videos, downloadErrors } = await this.downloadVideos(
      slides.filter((slide) => slide.kind === 'video'),
      isCarousel,
      ctx,
    );
    const firstVideoUrl = slides.find((slide) => slide.kind === 'video')?.videoUrl;

    return {
      sourceType: 'INSTAGRAM',
      originalUrl: url,
      normalizedUrl: url,
      ...(post.title ? { title: post.title } : {}),
      ...(postText ? { caption: postText, description: postText } : {}),
      ...(post.ownerUsername ? { author: post.ownerUsername } : {}),
      ...(firstVideoUrl ? { videoUrl: firstVideoUrl } : {}),
      ...(videos[0] ? { videoLocalPath: videos[0].localPath } : {}),
      ...(videos.length > 0 ? { videos } : {}),
      ...(post.thumbnailUrl ?? post.displayUrl
        ? { thumbnailUrl: post.thumbnailUrl ?? post.displayUrl }
        : {}),
      images,
      metadata: {
        provider: 'apify',
        ownerUsername: post.ownerUsername,
        ...(post.type ? { postType: post.type } : {}),
        ...(isCarousel ? { slideCount: slides.length } : {}),
        ...(downloadErrors.length > 0 ? { downloadError: downloadErrors.join('; ') } : {}),
      },
    };
  }

  /** Instagram CDN URLs are signed and expire, so videos are fetched during acquisition. */
  private async downloadVideos(
    videoSlides: InstagramSlide[],
    isCarousel: boolean,
    ctx: AcquisitionContext,
  ): Promise<{ videos: ContentVideo[]; downloadErrors: string[] }> {
    const videos: ContentVideo[] = [];
    const downloadErrors: string[] = [];

    for (const slide of videoSlides.slice(0, this.options.maxVideos ?? DEFAULT_MAX_VIDEOS)) {
      if (!slide.videoUrl) {
        continue;
      }
      const destPath = path.join(
        ctx.tempDir,
        isCarousel ? `video-slide-${String(slide.slideIndex)}.mp4` : 'video.mp4',
      );
      const download = (): Promise<unknown> =>
        downloadMediaToFile(slide.videoUrl ?? '', destPath, {
          maxBytes: this.options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES,
          timeoutMs: 180_000,
          acceptContentTypes: ['video/', 'application/octet-stream', 'binary/octet-stream'],
          ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
        });
      try {
        await (ctx.log
          ? logStep(ctx.log, 'instagram.download-video', { slideIndex: slide.slideIndex }, download)
          : download());
        videos.push({ localPath: destPath, ...(isCarousel ? { slideIndex: slide.slideIndex } : {}) });
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        downloadErrors.push(`slide ${String(slide.slideIndex)}: ${detail}`);
        ctx.log?.warn(
          { step: 'instagram.download-video', slideIndex: slide.slideIndex, err: error },
          'instagram.download-video failed',
        );
      }
    }

    return { videos, downloadErrors };
  }
}

const DEFAULT_MAX_VIDEOS = 3;
const DEFAULT_MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

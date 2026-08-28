import type { SourceType } from '@prisma/client';

import { ContentAcquisitionFailedError } from '../../../../shared/errors/extraction-errors.js';
import type { AcquiredContent, AcquisitionContext, ContentProvider } from '../../domain/types.js';
import type { ApifyClient } from './apify-client.js';

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com'];

export class InstagramContentProvider implements ContentProvider {
  readonly sourceType: SourceType = 'INSTAGRAM';

  constructor(private readonly apify: ApifyClient) {}

  supports(url: string): boolean {
    try {
      const parsed = new URL(url);
      return INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  async acquire(url: string, ctx: AcquisitionContext): Promise<AcquiredContent> {
    void ctx;

    let posts;
    try {
      posts = await this.apify.runInstagramScraper({ directUrls: [url], resultsLimit: 1 });
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

    const post = posts[0];
    if (!post) {
      throw new ContentAcquisitionFailedError({
        message: 'No Instagram content returned for URL',
      });
    }

    const postText = firstNonEmpty(post.caption, post.text);
    if (!postText) {
      throw new ContentAcquisitionFailedError({
        message: 'Apify returned Instagram content without a caption or text',
      });
    }

    const images = post.displayUrl
      ? [{ url: post.displayUrl, mimeType: 'image/jpeg' as const }]
      : [];

    return {
      sourceType: 'INSTAGRAM',
      originalUrl: url,
      normalizedUrl: url,
      ...(post.title ? { title: post.title } : {}),
      caption: postText,
      description: postText,
      ...(post.ownerUsername ? { author: post.ownerUsername } : {}),
      ...(post.videoUrl ? { videoUrl: post.videoUrl } : {}),
      ...(post.thumbnailUrl ?? post.displayUrl
        ? { thumbnailUrl: post.thumbnailUrl ?? post.displayUrl }
        : {}),
      images,
      metadata: {
        provider: 'apify',
        ownerUsername: post.ownerUsername,
      },
    };
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

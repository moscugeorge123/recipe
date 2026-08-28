import { describe, expect, it } from 'vitest';

import type { ApifyClient } from '../../../../src/modules/content/providers/instagram/apify-client.js';
import { parseApifyDatasetItems } from '../../../../src/modules/content/providers/instagram/apify-client.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';
import { FacebookContentProvider } from '../../../../src/modules/content/providers/facebook/facebook-content-provider.js';
import { TikTokContentProvider } from '../../../../src/modules/content/providers/tiktok/tiktok-content-provider.js';
import { ContentAcquisitionFailedError } from '../../../../src/shared/errors/extraction-errors.js';
import { UnsupportedSourceError } from '../../../../src/shared/errors/extraction-errors.js';

const ctx = {
  jobId: 'job-1',
  outputLanguage: 'en',
  tempDir: '/tmp/test',
};

describe('InstagramContentProvider', () => {
  it('acquires content via mocked Apify client', async () => {
    const apify: ApifyClient = {
      runInstagramScraper: async () => [
        {
          caption: '1 cup flour, 2 eggs',
          ownerUsername: 'baker',
          displayUrl: 'https://cdn.example/image.jpg',
          videoUrl: 'https://cdn.example/video.mp4',
        },
      ],
    };

    const provider = new InstagramContentProvider(apify);
    const content = await provider.acquire('https://www.instagram.com/reel/abc123/', ctx);

    expect(content.sourceType).toBe('INSTAGRAM');
    expect(content.caption).toContain('flour');
    expect(content.description).toContain('flour');
    expect(content.author).toBe('baker');
  });

  it('uses Apify text or alt when caption is missing', async () => {
    const apify: ApifyClient = {
      runInstagramScraper: async () => [
        {
          text: '150g oats, 1 banana. Calories: 280',
          ownerUsername: 'baker',
        },
      ],
    };

    const provider = new InstagramContentProvider(apify);
    const content = await provider.acquire('https://www.instagram.com/p/no-caption/', ctx);

    expect(content.caption).toContain('150g oats');
    expect(content.description).toContain('Calories: 280');
  });

  it('throws when Apify returns no results', async () => {
    const provider = new InstagramContentProvider({
      runInstagramScraper: async () => [],
    });

    await expect(
      provider.acquire('https://www.instagram.com/reel/empty/', ctx),
    ).rejects.toBeInstanceOf(ContentAcquisitionFailedError);
  });

  it('throws when Apify returns an error item and does not continue', async () => {
    const provider = new InstagramContentProvider({
      runInstagramScraper: async () => {
        throw new Error('Empty or private data for provided input');
      },
    });

    await expect(
      provider.acquire('https://www.instagram.com/reel/private/', ctx),
    ).rejects.toMatchObject({
      name: 'ContentAcquisitionFailedError',
      message: expect.stringContaining('Empty or private data for provided input'),
    });
  });

  it('throws when Apify returns a post with no caption or text', async () => {
    const provider = new InstagramContentProvider({
      runInstagramScraper: async () => [{ ownerUsername: 'baker', alt: 'May be an image of food' }],
    });

    await expect(
      provider.acquire('https://www.instagram.com/reel/no-text/', ctx),
    ).rejects.toBeInstanceOf(ContentAcquisitionFailedError);
  });
});

describe('parseApifyDatasetItems', () => {
  it('rejects dataset error items', () => {
    expect(() =>
      parseApifyDatasetItems([
        { error: 'not_found', errorDescription: 'Empty or private data for provided input' },
      ]),
    ).toThrow('Empty or private data for provided input');
  });

  it('rejects Apify API error envelopes', () => {
    expect(() => parseApifyDatasetItems({ error: { message: 'Actor run failed' } })).toThrow(
      'Actor run failed',
    );
  });

  it('returns successful posts', () => {
    const posts = parseApifyDatasetItems([{ caption: '1 cup flour' }]);
    expect(posts[0]?.caption).toBe('1 cup flour');
  });
});

describe('YouTubeContentProvider', () => {
  it('acquires content via mocked yt-dlp client', async () => {
    const ytdlp: VideoDownloadClient = {
      fetchMetadata: async () => ({
        title: 'Chocolate Cake',
        description: 'Mix and bake',
        uploader: 'Chef Tube',
        duration: 120,
        thumbnail: 'https://i.ytimg.com/thumb.jpg',
      }),
      download: async () => ({
        filePath: '/tmp/video.mp4',
        metadata: { title: 'Chocolate Cake' },
      }),
    };

    const provider = new YouTubeContentProvider(ytdlp);
    const content = await provider.acquire('https://www.youtube.com/watch?v=abc', ctx);

    expect(content.sourceType).toBe('YOUTUBE');
    expect(content.title).toBe('Chocolate Cake');
    expect(content.description).toBe('Mix and bake');
    expect(content.caption).toBe('Mix and bake');
    expect(content.videoLocalPath).toBe('/tmp/video.mp4');
  });
});

describe('stub providers', () => {
  it('Facebook provider rejects acquisition', async () => {
    const provider = new FacebookContentProvider();
    await expect(
      provider.acquire('https://www.facebook.com/reel/123', ctx),
    ).rejects.toBeInstanceOf(UnsupportedSourceError);
  });

  it('TikTok provider rejects acquisition', async () => {
    const provider = new TikTokContentProvider();
    await expect(
      provider.acquire('https://www.tiktok.com/@user/video/123', ctx),
    ).rejects.toBeInstanceOf(UnsupportedSourceError);
  });
});

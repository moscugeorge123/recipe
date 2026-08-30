import { describe, expect, it, vi } from 'vitest';

import type { ApifyClient } from '../../../../src/modules/content/providers/instagram/apify-client.js';
import { parseApifyDatasetItems } from '../../../../src/modules/content/providers/instagram/apify-client.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
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

  it('surfaces a missing yt-dlp binary on metadata failure', async () => {
    const ytdlp: VideoDownloadClient = {
      fetchMetadata: async () => {
        throw new Error('Failed to fetch YouTube metadata: yt-dlp is not installed or not on PATH');
      },
      download: async () => {
        throw new Error('download must not run');
      },
    };

    const provider = new YouTubeContentProvider(ytdlp);
    await expect(provider.acquire('https://www.youtube.com/watch?v=abc', ctx)).rejects.toThrow(
      /yt-dlp is not installed/,
    );
  });

  it('returns metadata without videoLocalPath when download fails', async () => {
    const ytdlp: VideoDownloadClient = {
      fetchMetadata: async () => ({
        title: 'Pan sauce',
        description: 'Deglaze the pan with wine',
        uploader: 'Chef Tube',
        duration: 45,
      }),
      download: async () => {
        throw new Error('Failed to download YouTube video: Sign in to confirm you are not a bot');
      },
    };

    const provider = new YouTubeContentProvider(ytdlp);
    const content = await provider.acquire('https://www.youtube.com/watch?v=abc', ctx);

    expect(content.title).toBe('Pan sauce');
    expect(content.description).toBe('Deglaze the pan with wine');
    expect(content.videoLocalPath).toBeUndefined();
    expect(content.metadata.downloadError).toContain('Sign in to confirm');
  });
});

describe('GenericWebContentProvider', () => {
  it('supports any remaining http(s) URL', () => {
    const provider = new GenericWebContentProvider();
    expect(provider.supports('https://www.seriouseats.com/pasta')).toBe(true);
    expect(provider.supports('http://blog.example.org/recipe')).toBe(true);
    expect(provider.supports('ftp://example.com/file')).toBe(false);
  });

  it('stores the first og:image as thumbnailUrl', async () => {
    const fetchImpl = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        `<meta property="og:title" content="Web pasta" />
         <meta property="og:image" content="https://cdn.example/hero.jpg" />`,
        { status: 200 },
      ),
    );

    const content = await new GenericWebContentProvider().acquire('https://food.example/pasta', ctx);

    expect(content.title).toBe('Web pasta');
    expect(content.thumbnailUrl).toBe('https://cdn.example/hero.jpg');
    fetchImpl.mockRestore();
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

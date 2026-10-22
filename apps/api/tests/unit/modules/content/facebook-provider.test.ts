import { describe, expect, it, vi } from 'vitest';

import type {
  ApifyFacebookClient,
  ApifyFacebookPost,
} from '../../../../src/modules/content/providers/facebook/apify-facebook-client.js';
import { parseFacebookDatasetItems } from '../../../../src/modules/content/providers/facebook/apify-facebook-client.js';
import { FacebookContentProvider } from '../../../../src/modules/content/providers/facebook/facebook-content-provider.js';
import {
  extractFacebookMedia,
  looksLikeFacebookVideoUrl,
} from '../../../../src/modules/content/providers/facebook/facebook-media.js';
import { FacebookLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/facebook.unfurler.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';
import { ContentAcquisitionFailedError } from '../../../../src/shared/errors/extraction-errors.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test-facebook' };

const apifyReturning = (...posts: ApifyFacebookPost[]): ApifyFacebookClient => ({
  runFacebookPostsScraper: vi.fn(() => Promise.resolve(posts)),
});

const failingApify = (message: string): ApifyFacebookClient => ({
  runFacebookPostsScraper: vi.fn(() => Promise.reject(new Error(message))),
});

const ytdlpDownload = vi.fn(() =>
  Promise.resolve({
    filePath: '/tmp/test-facebook/video.mp4',
    metadata: { title: 'Reel pasta', description: '200g pasta, 2 eggs', uploader: 'Chef Reel', duration: 41 },
  }),
);

const ytdlpDownloading = (): VideoDownloadClient => ({
  fetchMetadata: () => Promise.reject(new Error('unused')),
  download: ytdlpDownload,
});

describe('FacebookContentProvider', () => {
  it('supports facebook.com, fb.com and fb.watch hosts only', () => {
    const provider = new FacebookContentProvider();
    expect(provider.supports('https://www.facebook.com/chef/posts/1')).toBe(true);
    expect(provider.supports('https://m.facebook.com/story.php?story_fbid=1')).toBe(true);
    expect(provider.supports('https://fb.watch/abc/')).toBe(true);
    expect(provider.supports('https://fb.com/chef')).toBe(true);
    expect(provider.supports('https://notfacebook.com/x')).toBe(false);
    expect(provider.supports('https://example.com/facebook.com')).toBe(false);
  });

  it('reads post text, author and photos as numbered slides', async () => {
    const apify = apifyReturning({
      text: 'Pancakes: 1 cup flour, 1 egg',
      user: { name: 'Home Baker' },
      media: [
        { __typename: 'Photo', photo_image: { uri: 'https://cdn.example/1.jpg' } },
        { __typename: 'Photo', image: { uri: 'https://cdn.example/2.jpg' } },
      ],
    });
    const content = await new FacebookContentProvider(apify).acquire(
      'https://www.facebook.com/baker/posts/99',
      ctx,
    );

    expect(content.sourceType).toBe('FACEBOOK');
    expect(content.caption).toContain('1 cup flour');
    expect(content.author).toBe('Home Baker');
    expect(content.images).toEqual([
      { url: 'https://cdn.example/1.jpg', mimeType: 'image/jpeg', slideIndex: 1 },
      { url: 'https://cdn.example/2.jpg', mimeType: 'image/jpeg', slideIndex: 2 },
    ]);
    expect(content.thumbnailUrl).toBe('https://cdn.example/1.jpg');
    expect(content.videos).toBeUndefined();
    expect(content.metadata).toMatchObject({ provider: 'apify', slideCount: 2 });
  });

  it('accepts a photo-only post with no text', async () => {
    const apify = apifyReturning({
      media: [{ __typename: 'Photo', photo_image: { uri: 'https://cdn.example/card.jpg' } }],
    });
    const content = await new FacebookContentProvider(apify).acquire(
      'https://www.facebook.com/photo/?fbid=1',
      ctx,
    );
    expect(content.caption).toBeUndefined();
    expect(content.images).toHaveLength(1);
  });

  it('downloads a direct video URL from the post', async () => {
    const apify = apifyReturning({
      text: 'Quick curry',
      media: [{ __typename: 'Video', browser_native_hd_url: 'https://video.example/curry.mp4' }],
    });
    const provider = new FacebookContentProvider(apify, undefined, {
      fetchImpl: () =>
        Promise.resolve(new Response('mp4', { status: 200, headers: { 'content-type': 'video/mp4' } })),
    });
    const content = await provider.acquire('https://www.facebook.com/chef/videos/5', {
      ...ctx,
      tempDir: await import('node:os').then((os) => os.tmpdir()),
    });

    expect(content.videos).toHaveLength(1);
    expect(content.videoLocalPath).toMatch(/video\.mp4$/);
  });

  it('falls back to yt-dlp for reels when the post has no direct video URL', async () => {
    ytdlpDownload.mockClear();
    const content = await new FacebookContentProvider(
      apifyReturning({ text: 'Reel caption', media: [{ __typename: 'Video', thumbnail: 'https://cdn.example/t.jpg' }] }),
      ytdlpDownloading(),
    ).acquire('https://www.facebook.com/reel/123', ctx);

    expect(ytdlpDownload).toHaveBeenCalledOnce();
    expect(content.videoLocalPath).toBe('/tmp/test-facebook/video.mp4');
    expect(content.caption).toBe('Reel caption');
    expect(content.thumbnailUrl).toBe('https://cdn.example/t.jpg');
  });

  it('reads a reel with yt-dlp alone when Apify is unavailable', async () => {
    const content = await new FacebookContentProvider(
      failingApify('Apify request failed: boom'),
      ytdlpDownloading(),
    ).acquire('https://fb.watch/abc/', ctx);

    expect(content.title).toBe('Reel pasta');
    expect(content.caption).toBe('200g pasta, 2 eggs');
    expect(content.author).toBe('Chef Reel');
    expect(content.metadata).toMatchObject({ provider: 'yt-dlp', durationSeconds: 41 });
  });

  it('fails with a clear reason for a private post', async () => {
    const provider = new FacebookContentProvider(failingApify('This content is private or needs a login'));
    const error = await provider
      .acquire('https://www.facebook.com/groups/1/posts/2', ctx)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ContentAcquisitionFailedError);
    expect((error as ContentAcquisitionFailedError).reason).toBe('PRIVATE');
  });

  it('fails when a post has neither text, photos nor video', async () => {
    await expect(
      new FacebookContentProvider(apifyReturning({ text: '  ', media: [] })).acquire(
        'https://www.facebook.com/chef/posts/3',
        ctx,
      ),
    ).rejects.toBeInstanceOf(ContentAcquisitionFailedError);
  });

  it('says so when Apify is not configured for a non-video link', async () => {
    await expect(
      new FacebookContentProvider(undefined, ytdlpDownloading()).acquire(
        'https://www.facebook.com/chef/posts/3',
        ctx,
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('APIFY_API_TOKEN') as string });
  });
});

describe('facebook media helpers', () => {
  it.each([
    ['https://www.facebook.com/reel/123', true],
    ['https://www.facebook.com/watch/?v=1', true],
    ['https://www.facebook.com/chef/videos/123', true],
    ['https://www.facebook.com/share/r/abc', true],
    ['https://fb.watch/abc', true],
    ['https://www.facebook.com/chef/posts/123', false],
    ['https://www.facebook.com/photo/?fbid=1', false],
  ])('looksLikeFacebookVideoUrl(%s) = %s', (url, expected) => {
    expect(looksLikeFacebookVideoUrl(url)).toBe(expected);
  });

  it('separates photos from videos and ignores non-http URLs', () => {
    const media = extractFacebookMedia({
      media: [
        { __typename: 'Photo', photo_image: { uri: 'https://cdn.example/a.jpg' } },
        { __typename: 'Photo', photo_image: { uri: 'data:image/png;base64,AAAA' } },
        { __typename: 'Video', thumbnail: 'https://cdn.example/poster.jpg', video_url: 'https://v.example/a.mp4' },
      ],
    });
    expect(media.photos).toEqual(['https://cdn.example/a.jpg']);
    expect(media.videoUrls).toEqual(['https://v.example/a.mp4']);
    expect(media.hasVideo).toBe(true);
    expect(media.poster).toBe('https://cdn.example/poster.jpg');
  });

  it('rejects Apify error items', () => {
    expect(() => parseFacebookDatasetItems([{ error: 'Page is private' }])).toThrow('Page is private');
    expect(() => parseFacebookDatasetItems([])).toThrow('No Facebook content');
  });
});

describe('FacebookLinkUnfurler', () => {
  it('names the source without scraping the login wall', async () => {
    const unfurler = new FacebookLinkUnfurler();
    expect(unfurler.supports('https://www.facebook.com/reel/1')).toBe(true);
    expect(unfurler.supports('https://example.com')).toBe(false);
    await expect(unfurler.unfurl('https://www.facebook.com/reel/1')).resolves.toMatchObject({
      sourceType: 'FACEBOOK',
      title: null,
      thumbnails: [],
    });
  });
});

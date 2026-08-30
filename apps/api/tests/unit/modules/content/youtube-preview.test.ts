import { describe, expect, it, vi } from 'vitest';

import { YouTubeLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/youtube.unfurler.js';
import {
  extractYouTubeVideoId,
  mapYouTubeOembed,
  youtubeFallbackThumbnails,
} from '../../../../src/modules/content/preview/youtube-mapper.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';

function failingYtdlp(error = new Error('spawn yt-dlp ENOENT')): VideoDownloadClient {
  return {
    fetchMetadata: vi.fn(async () => {
      throw error;
    }),
    download: async () => {
      throw new Error('download must not run on preview');
    },
  };
}

describe('extractYouTubeVideoId', () => {
  it('reads watch, short, embed and youtu.be URLs', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-video paths', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/@channel')).toBeNull();
    expect(extractYouTubeVideoId('not-a-url')).toBeNull();
  });
});

describe('mapYouTubeOembed', () => {
  it('trims title and author', () => {
    expect(
      mapYouTubeOembed({
        title: '  Weeknight pasta  ',
        author_name: ' Chef Tube ',
        thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      }),
    ).toEqual({
      title: 'Weeknight pasta',
      author: 'Chef Tube',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    });
  });
});

describe('youtubeFallbackThumbnails', () => {
  it('returns poster plus numbered stills', () => {
    expect(youtubeFallbackThumbnails('abc123xyz01').map((entry) => entry.url)).toEqual([
      'https://i.ytimg.com/vi/abc123xyz01/hqdefault.jpg',
      'https://i.ytimg.com/vi/abc123xyz01/1.jpg',
      'https://i.ytimg.com/vi/abc123xyz01/2.jpg',
      'https://i.ytimg.com/vi/abc123xyz01/3.jpg',
    ]);
  });

  it('uses the oEmbed thumbnail when there is no video id', () => {
    expect(youtubeFallbackThumbnails(null, 'https://i.ytimg.com/vi/xyz/hqdefault.jpg')).toEqual([
      { url: 'https://i.ytimg.com/vi/xyz/hqdefault.jpg' },
    ]);
  });
});

describe('YouTubeLinkUnfurler', () => {
  it('uses public oEmbed without calling yt-dlp', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          title: 'Chocolate Cake',
          author_name: 'Chef Tube',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        }),
        { status: 200 },
      );

    const ytdlp = failingYtdlp();
    const preview = await new YouTubeLinkUnfurler(ytdlp, { fetchImpl }).unfurl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(ytdlp.fetchMetadata).not.toHaveBeenCalled();
    expect(preview).toEqual({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sourceType: 'YOUTUBE',
      title: 'Chocolate Cake',
      author: 'Chef Tube',
      description: null,
      thumbnails: [
        { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
        { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/1.jpg' },
        { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg' },
        { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/3.jpg' },
      ],
    });
  });

  it('falls back to yt-dlp when oEmbed fails', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 404 });
    const fetchMetadata = vi.fn(async () => ({
      title: 'From yt-dlp',
      uploader: 'Chef Tube',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    }));

    const preview = await new YouTubeLinkUnfurler(
      { fetchMetadata, download: async () => ({ filePath: '/tmp/v', metadata: {} }) },
      { fetchImpl },
    ).unfurl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(fetchMetadata).toHaveBeenCalled();
    expect(preview.title).toBe('From yt-dlp');
    expect(preview.author).toBe('Chef Tube');
  });

  it('throws when oEmbed and yt-dlp both fail', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 404 });

    await expect(
      new YouTubeLinkUnfurler(failingYtdlp(), { fetchImpl }).unfurl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ),
    ).rejects.toMatchObject({
      code: 'CONTENT_ACQUISITION_FAILED',
      message: 'YouTube oEmbed failed with status 404',
    });
  });
});

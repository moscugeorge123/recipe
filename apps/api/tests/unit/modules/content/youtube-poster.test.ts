import { describe, expect, it, vi } from 'vitest';

import {
  chooseYouTubeThumbnail,
  isFullFramePoster,
  posterNameOf,
  probeYouTubePoster,
  type PosterFetch,
} from '../../../../src/modules/content/preview/youtube-poster.js';
import { YouTubeLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/youtube.unfurler.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';

const id = 'dQw4w9WgXcQ';
const poster = (name: string): string => `https://i.ytimg.com/vi/${id}/${name}.jpg`;

/** HEAD stand-in: `existing` maps a poster name to its content length; everything else is 404. */
function headFetch(existing: Record<string, number>): ReturnType<typeof vi.fn<PosterFetch>> {
  return vi.fn<PosterFetch>((url) => {
    const name = posterNameOf(url) ?? '';
    const length = existing[name];
    if (length === undefined) return Promise.resolve(new Response(null, { status: 404 }));
    return Promise.resolve(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': String(length) },
      }),
    );
  });
}

describe('posterNameOf / isFullFramePoster', () => {
  it('reads the poster name', () => {
    expect(posterNameOf(poster('hqdefault'))).toBe('hqdefault');
    expect(posterNameOf('https://example.com/a.jpg')).toBeNull();
  });

  it('knows which posters have no black bars', () => {
    expect(isFullFramePoster(poster('maxresdefault'))).toBe(true);
    expect(isFullFramePoster(poster('hq720'))).toBe(true);
    expect(isFullFramePoster(poster('hqdefault'))).toBe(false);
    expect(isFullFramePoster(poster('sddefault'))).toBe(false);
  });
});

describe('probeYouTubePoster', () => {
  it('takes maxresdefault when it exists', async () => {
    const fetchImpl = headFetch({ maxresdefault: 90_000, hqdefault: 30_000 });
    await expect(probeYouTubePoster(id, fetchImpl)).resolves.toBe(poster('maxresdefault'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'HEAD' });
  });

  it('falls back through hq720, sddefault and hqdefault', async () => {
    await expect(probeYouTubePoster(id, headFetch({ hq720: 50_000, hqdefault: 30_000 }))).resolves.toBe(
      poster('hq720'),
    );
    await expect(probeYouTubePoster(id, headFetch({ sddefault: 40_000, hqdefault: 30_000 }))).resolves.toBe(
      poster('sddefault'),
    );
    await expect(probeYouTubePoster(id, headFetch({ hqdefault: 30_000 }))).resolves.toBe(
      poster('hqdefault'),
    );
  });

  it('skips the tiny grey placeholder YouTube serves for a missing poster', async () => {
    await expect(
      probeYouTubePoster(id, headFetch({ maxresdefault: 1_500, hqdefault: 30_000 })),
    ).resolves.toBe(poster('hqdefault'));
  });

  it('returns null when nothing answers or the network is down', async () => {
    await expect(probeYouTubePoster(id, headFetch({}))).resolves.toBeNull();
    const offline: PosterFetch = () => Promise.reject(new Error('offline'));
    await expect(probeYouTubePoster(id, offline)).resolves.toBeNull();
  });

  it('ignores a non-image answer', async () => {
    const json: PosterFetch = () =>
      Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(probeYouTubePoster(id, json)).resolves.toBeNull();
  });
});

describe('chooseYouTubeThumbnail', () => {
  it('prefers the widest listed full-frame poster and ignores _live variants', async () => {
    const chosen = await chooseYouTubeThumbnail({
      videoId: id,
      thumbnails: [
        { url: poster('hqdefault'), width: 480, height: 360 },
        { url: poster('maxresdefault_live'), width: 1280, height: 720 },
        { url: poster('hq720'), width: 1280, height: 720 },
        { url: poster('maxresdefault'), width: 1920, height: 1080 },
      ],
      thumbnail: poster('hqdefault'),
    });
    expect(chosen).toBe(poster('maxresdefault'));
  });

  it('keeps yt-dlp thumbnail when it is already full frame', async () => {
    await expect(
      chooseYouTubeThumbnail({ videoId: id, thumbnail: poster('maxresdefault') }),
    ).resolves.toBe(poster('maxresdefault'));
  });

  it('probes by video id only when asked, then falls back to the letter-boxed file', async () => {
    const fetchImpl = headFetch({ maxresdefault: 90_000 });
    await expect(
      chooseYouTubeThumbnail({ videoId: id, thumbnail: poster('hqdefault'), fetchImpl }),
    ).resolves.toBe(poster('hqdefault'));
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(
      chooseYouTubeThumbnail({ videoId: id, thumbnail: poster('hqdefault'), fetchImpl, probe: true }),
    ).resolves.toBe(poster('maxresdefault'));
    await expect(
      chooseYouTubeThumbnail({
        videoId: id,
        thumbnail: poster('hqdefault'),
        fetchImpl: headFetch({}),
        probe: true,
      }),
    ).resolves.toBe(poster('hqdefault'));
  });
});

const ytdlp = (thumbnail: string): VideoDownloadClient =>
  ({
    fetchMetadata: () =>
      Promise.resolve({ title: 'Pasta', thumbnail, webpage_url: `https://www.youtube.com/watch?v=${id}` }),
    download: () => Promise.reject(new Error('no download in this test')),
  });

describe('YouTube content provider thumbnail', () => {
  const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };

  it('stores a full-frame poster for new imports', async () => {
    const provider = new YouTubeContentProvider(ytdlp(poster('hqdefault')), {
      fetchCaptions: false,
      probeThumbnails: true,
      fetchImpl: headFetch({ maxresdefault: 90_000, hqdefault: 30_000 }) as unknown as typeof fetch,
    });
    const content = await provider.acquire(`https://www.youtube.com/watch?v=${id}`, ctx);
    expect(content.thumbnailUrl).toBe(poster('maxresdefault'));
    expect(content.images[0]?.url).toBe(poster('maxresdefault'));
  });

  it('does not touch the network unless probing is on', async () => {
    const fetchImpl = headFetch({ maxresdefault: 90_000 });
    const provider = new YouTubeContentProvider(ytdlp(poster('hqdefault')), {
      fetchCaptions: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const content = await provider.acquire(`https://www.youtube.com/watch?v=${id}`, ctx);
    expect(content.thumbnailUrl).toBe(poster('hqdefault'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('YouTube preview thumbnail', () => {
  it('leads with the full-frame poster and drops the boxed copy', async () => {
    const fetchImpl: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/oembed')) {
        return Promise.resolve(
          Response.json({ title: 'Pasta', author_name: 'Chef', thumbnail_url: poster('hqdefault') }),
        );
      }
      return headFetch({ maxresdefault: 90_000 })(url, init);
    };
    const preview = await new YouTubeLinkUnfurler(ytdlp(poster('hqdefault')), { fetchImpl }).unfurl(
      `https://www.youtube.com/watch?v=${id}`,
    );
    expect(preview.thumbnails[0]?.url).toBe(poster('maxresdefault'));
    expect(preview.thumbnails.some((thumb) => thumb.url === poster('hqdefault'))).toBe(false);
  });
});

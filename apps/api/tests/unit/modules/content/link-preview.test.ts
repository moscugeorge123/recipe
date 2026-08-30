import { describe, expect, it, vi } from 'vitest';

import { LinkPreviewService } from '../../../../src/modules/content/preview/link-preview.service.js';
import { FakeLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/fake.unfurler.js';
import { InstagramLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/instagram.unfurler.js';
import { OpenGraphLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/open-graph.unfurler.js';
import { YouTubeLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/youtube.unfurler.js';
import type { VideoDownloadClient } from '../../../../src/modules/content/providers/youtube/ytdlp-client.js';

vi.mock('../../../../src/infrastructure/security/ssrf-guard.js', () => ({
  assertSafeUrl: vi.fn(async (raw: string) => new URL(raw)),
}));

function htmlResponse(html: string): typeof fetch {
  return async () => new Response(html, { status: 200 });
}

describe('link preview unfurlers', () => {
  it('returns fixture thumbnails for fake-recipe URLs', async () => {
    const preview = await new FakeLinkUnfurler().unfurl('https://example.com/fake-recipe');

    expect(preview.sourceType).toBe('GENERIC_WEB');
    expect(preview.thumbnails.length).toBeGreaterThan(1);
    expect(preview.title).toBe('Fake Pasta Recipe');
    expect(preview.author).toBe('fixture-chef');
  });

  it('maps YouTube oEmbed without calling yt-dlp', async () => {
    const fetchMetadata = vi.fn(async () => {
      throw new Error('yt-dlp must not run when oEmbed succeeds');
    });
    const ytdlp: VideoDownloadClient = {
      fetchMetadata,
      download: async () => {
        throw new Error('download must not run on preview');
      },
    };
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          title: 'Chocolate Cake',
          author_name: 'Chef Tube',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        }),
        { status: 200 },
      );

    const preview = await new YouTubeLinkUnfurler(ytdlp, { fetchImpl }).unfurl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(fetchMetadata).not.toHaveBeenCalled();
    expect(preview.sourceType).toBe('YOUTUBE');
    expect(preview.title).toBe('Chocolate Cake');
    expect(preview.author).toBe('Chef Tube');
    expect(preview.description).toBeNull();
    expect(preview.thumbnails.map((entry) => entry.url)).toEqual([
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/1.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/3.jpg',
    ]);
  });

  it('parses website Open Graph tags', async () => {
    const fetchImpl = htmlResponse(`
      <meta property="og:title" content="Serious pasta" />
      <meta property="og:description" content="Cook it tonight" />
      <meta property="og:image" content="https://cdn.example/a.jpg" />
      <meta property="og:image" content="https://cdn.example/b.jpg" />
    `);

    const preview = await new OpenGraphLinkUnfurler(fetchImpl).unfurl(
      'https://www.seriouseats.com/pasta',
    );

    expect(preview.sourceType).toBe('GENERIC_WEB');
    expect(preview.title).toBe('Serious pasta');
    expect(preview.description).toBe('Cook it tonight');
    expect(preview.author).toBeNull();
    expect(preview.thumbnails).toEqual([
      { url: 'https://cdn.example/a.jpg' },
      { url: 'https://cdn.example/b.jpg' },
    ]);
  });
});

describe('LinkPreviewService', () => {
  it('uses the first matching unfurler (Fake before Open Graph)', async () => {
    const ogFetch = vi.fn(htmlResponse('<title>should not run</title>'));
    const service = new LinkPreviewService([
      new FakeLinkUnfurler(),
      new InstagramLinkUnfurler({ fetchImpl: ogFetch }),
      new OpenGraphLinkUnfurler(ogFetch),
    ]);

    const preview = await service.preview('https://example.com/fake-recipe');

    expect(preview.thumbnails.length).toBeGreaterThan(1);
    expect(ogFetch).not.toHaveBeenCalled();
  });
});

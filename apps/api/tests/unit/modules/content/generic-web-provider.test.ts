import { describe, expect, it } from 'vitest';

import { FacebookContentProvider } from '../../../../src/modules/content/providers/facebook/facebook-content-provider.js';
import { FakeContentProvider } from '../../../../src/modules/content/providers/fake/fake-content-provider.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import { TikTokContentProvider } from '../../../../src/modules/content/providers/tiktok/tiktok-content-provider.js';
import { YouTubeContentProvider } from '../../../../src/modules/content/providers/youtube/youtube-content-provider.js';
import { DefaultContentProviderRegistry } from '../../../../src/modules/content/registry/content-provider-registry.js';
import {
  ContentAcquisitionFailedError,
  UnsupportedSourceError,
} from '../../../../src/shared/errors/extraction-errors.js';
import { htmlFetch, webFixture } from '../../../helpers/web-fixtures.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };

function provider(html: string, init?: { status?: number; contentType?: string }) {
  return new GenericWebContentProvider({ fetchImpl: htmlFetch(html, init) });
}

describe('GenericWebContentProvider structured data', () => {
  it('attaches JSON-LD recipe data, author, language and merged images', async () => {
    const content = await provider(webFixture('recipe-blog-jsonld.html')).acquire(
      'https://tinykitchen.example/lemon-chicken',
      ctx,
    );

    expect(content.title).toBe('Lemon Garlic Chicken');
    expect(content.description).toContain('one-pan chicken thighs');
    expect(content.author).toBe('Ana Pop');
    expect(content.language).toBe('en-US');
    expect(content.thumbnailUrl).toBe('https://tinykitchen.example/img/chicken-og.jpg');
    expect(content.images.map((i) => i.url)).toEqual([
      'https://tinykitchen.example/img/chicken-og.jpg',
      'https://tinykitchen.example/img/chicken-1x1.jpg',
      'https://tinykitchen.example/img/chicken-4x3.jpg',
      'https://tinykitchen.example/img/chicken-16x9.jpg',
    ]);
    expect(content.structuredRecipe?.ingredients).toHaveLength(5);
    expect(content.metadata).toEqual({ provider: 'http-fetch', structuredData: 'json-ld' });
    expect(content.pageText).toContain('crispy');
    expect(content.pageText?.length).toBeLessThanOrEqual(4_000);
  });

  it('uses JSON-LD name and <title> when Open Graph is missing', async () => {
    const graph = await provider(webFixture('recipe-blog-graph.html')).acquire(
      'https://bake.example/banana-bread/',
      ctx,
    );
    expect(graph.title).toBe('Classic Banana Bread');
    expect(graph.thumbnailUrl).toBe('https://bake.example/banana.jpg');

    const textOnly = await provider(webFixture('recipe-text-only.html')).acquire(
      'https://family.example/tomato-soup',
      ctx,
    );
    expect(textOnly.title).toBe("Grandma's Tomato Soup");
    expect(textOnly.structuredRecipe).toBeUndefined();
    expect(textOnly.metadata.structuredData).toBeNull();
    expect(textOnly.pageText).toContain('800 g canned tomatoes');
  });

  it('keeps structured data out of metadata so it is not persisted as provenance', async () => {
    const content = await provider(webFixture('recipe-blog-graph.html')).acquire(
      'https://bake.example/banana-bread/',
      ctx,
    );
    expect(JSON.stringify(content.metadata)).not.toContain('flour');
  });
});

describe('GenericWebContentProvider failures', () => {
  it('fails acquisition on 404', async () => {
    await expect(
      provider('<h1>Not found</h1>', { status: 404 }).acquire('https://x.example/missing', ctx),
    ).rejects.toMatchObject({
      name: 'ContentAcquisitionFailedError',
      message: 'Web fetch failed with status 404',
    });
  });

  it('fails acquisition on timeout', async () => {
    const hangingFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const slow = new GenericWebContentProvider({ fetchImpl: hangingFetch, timeoutMs: 20 });

    const error = await slow.acquire('https://slow.example/', ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentAcquisitionFailedError);
    expect((error as Error).message).toBe('Failed to fetch web page');
    expect(((error as Error).cause as Error).name).toBe('TimeoutError');
  });

  it('rejects links that are not web pages', async () => {
    await expect(
      provider('%PDF-1.7', { contentType: 'application/pdf' }).acquire(
        'https://x.example/menu.pdf',
        ctx,
      ),
    ).rejects.toMatchObject({ message: 'Link is not a web page (application/pdf)' });
  });
});

/**
 * Mirrors createContentRegistry() in src/shared/di/container.ts (same order) so link routing
 * is documented without constructing the full container.
 */
function productionRegistry(): DefaultContentProviderRegistry {
  const registry = new DefaultContentProviderRegistry();
  registry.register(
    new InstagramContentProvider({ runInstagramScraper: () => Promise.resolve([]) }),
  );
  registry.register(
    new YouTubeContentProvider({
      fetchMetadata: () => Promise.reject(new Error('unused')),
      download: () => Promise.reject(new Error('unused')),
    }),
  );
  registry.register(new FacebookContentProvider());
  registry.register(new TikTokContentProvider());
  registry.register(new FakeContentProvider());
  registry.register(new GenericWebContentProvider());
  return registry;
}

describe('link routing by URL', () => {
  const registry = productionRegistry();

  it.each([
    ['https://www.instagram.com/reel/abc123/', 'INSTAGRAM'],
    ['https://www.youtube.com/watch?v=abc', 'YOUTUBE'],
    ['https://youtu.be/abc', 'YOUTUBE'],
    ['https://www.tiktok.com/@chef/video/123', 'TIKTOK'],
    ['https://vm.tiktok.com/ZMabc/', 'TIKTOK'],
    ['https://www.facebook.com/reel/123', 'FACEBOOK'],
    // Not matched by the Facebook provider's host check → generic web.
    ['https://fb.watch/abc/', 'GENERIC_WEB'],
    // No Pinterest provider: pins fall through to generic web (OG tags + page text).
    ['https://www.pinterest.com/pin/123456/', 'GENERIC_WEB'],
    ['https://pin.it/abc', 'GENERIC_WEB'],
    ['https://www.seriouseats.com/pasta', 'GENERIC_WEB'],
  ])('%s → %s', (url, sourceType) => {
    expect(registry.detectSourceType(url)).toBe(sourceType);
  });

  it('rejects non-http URLs as unsupported', () => {
    expect(() => registry.getProvider('ftp://example.com/recipe')).toThrow(UnsupportedSourceError);
    expect(() => registry.getProvider('not a url')).toThrow(UnsupportedSourceError);
  });

  it('TikTok and Facebook stubs fail acquisition with UNSUPPORTED_SOURCE', async () => {
    for (const url of [
      'https://www.tiktok.com/@chef/video/123',
      'https://www.facebook.com/reel/1',
    ]) {
      await expect(registry.getProvider(url).acquire(url, ctx)).rejects.toMatchObject({
        code: 'UNSUPPORTED_SOURCE',
      });
    }
  });
});

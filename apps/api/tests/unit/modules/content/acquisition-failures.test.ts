import { describe, expect, it, vi } from 'vitest';

import { isPermanentFailure } from '../../../../src/infrastructure/queues/bullmq/bullmq-queue-provider.js';
import { serializeStageError } from '../../../../src/modules/extraction/application/stage-orchestrator.js';
import {
  fetchHtml,
  looksLikeBlockPage,
} from '../../../../src/modules/content/preview/fetch-html.js';
import {
  declaredImageWidth,
  pickBestImage,
  stripResizeParams,
} from '../../../../src/modules/content/preview/thumbnails.js';
import { OpenGraphLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/open-graph.unfurler.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import { InstagramContentProvider } from '../../../../src/modules/content/providers/instagram/instagram-content-provider.js';
import {
  ContentAcquisitionFailedError,
  NotARecipeError,
  classifyAcquisitionFailure,
} from '../../../../src/shared/errors/extraction-errors.js';
import { htmlFetch } from '../../../helpers/web-fixtures.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };

describe('classifyAcquisitionFailure', () => {
  it.each([
    ['Post does not exist', undefined, 'NOT_FOUND'],
    ['Failed with status 404', undefined, 'NOT_FOUND'],
    ['Video unavailable', undefined, 'NOT_FOUND'],
    ['Empty or private data for provided input', undefined, 'PRIVATE'],
    ['Sign in to confirm your age', undefined, 'PRIVATE'],
    ['Login required', undefined, 'PRIVATE'],
    ['anything', 410, 'NOT_FOUND'],
    ['anything', 403, 'PRIVATE'],
    ['Connection reset', undefined, undefined],
    ['Apify request failed: timeout (500)', undefined, undefined],
  ])('%s (%s)', (detail, status, expected) => {
    expect(classifyAcquisitionFailure(detail, status)).toBe(expected);
  });
});

describe('permanent failures', () => {
  it('flags missing, private and blocked links, not outages', () => {
    expect(new ContentAcquisitionFailedError({ reason: 'NOT_FOUND' }).permanent).toBe(true);
    expect(new ContentAcquisitionFailedError({ reason: 'PRIVATE' }).permanent).toBe(true);
    expect(new ContentAcquisitionFailedError({ reason: 'BLOCKED' }).permanent).toBe(true);
    expect(new ContentAcquisitionFailedError({ reason: 'UNAVAILABLE' }).permanent).toBe(false);
    expect(new ContentAcquisitionFailedError({}).permanent).toBe(false);
  });

  it('gives each reason its own sentence', () => {
    expect(new ContentAcquisitionFailedError({ reason: 'NOT_FOUND' }).message).toBe(
      "This link doesn't exist or has been removed",
    );
    expect(new ContentAcquisitionFailedError({ reason: 'BLOCKED' }).message).toBe(
      'This site blocks automatic import',
    );
  });

  it('tells the queue not to retry them', () => {
    expect(isPermanentFailure(new ContentAcquisitionFailedError({ reason: 'NOT_FOUND' }))).toBe(true);
    expect(isPermanentFailure(new NotARecipeError())).toBe(true);
    expect(isPermanentFailure(new ContentAcquisitionFailedError({ reason: 'UNAVAILABLE' }))).toBe(false);
    expect(isPermanentFailure(new Error('boom'))).toBe(false);
    expect(isPermanentFailure('x')).toBe(false);
  });
});

describe('Instagram failures', () => {
  function providerThrowing(message: string): InstagramContentProvider {
    return new InstagramContentProvider({
      runInstagramScraper: () => Promise.reject(new Error(message)),
    });
  }

  it('fails a deleted reel as NOT_FOUND with one sentence', async () => {
    const error = await providerThrowing('Post does not exist')
      .acquire('https://www.instagram.com/reel/C9xQ2ZkLmNp/', ctx)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentAcquisitionFailedError);
    const serialized = serializeStageError(error);
    expect(serialized).toEqual({
      message: "This link doesn't exist or has been removed",
      code: 'CONTENT_ACQUISITION_FAILED',
      reason: 'NOT_FOUND',
      cause: 'Post does not exist',
    });
  });

  it('keeps unknown Apify errors retryable', async () => {
    const error = await providerThrowing('socket hang up')
      .acquire('https://www.instagram.com/reel/abc/', ctx)
      .catch((e: unknown) => e);
    expect((error as ContentAcquisitionFailedError).permanent).toBe(false);
    expect((error as Error).message).toBe('Failed to acquire Instagram content: socket hang up');
  });
});

describe('serializeStageError', () => {
  it('does not repeat a cause that the message already says', () => {
    const wrapped = new ContentAcquisitionFailedError({
      message: 'Failed to acquire Instagram content: Post does not exist',
      cause: new Error('Post does not exist'),
    });
    expect(serializeStageError(wrapped).cause).toBeUndefined();
  });

  it('keeps a cause that adds information', () => {
    const wrapped = new ContentAcquisitionFailedError({
      message: 'Failed to fetch web page',
      cause: new Error('ECONNRESET'),
    });
    expect(serializeStageError(wrapped).cause).toBe('ECONNRESET');
  });
});

describe('block pages', () => {
  it('detects a short interstitial', () => {
    expect(looksLikeBlockPage('<html><body><h1>Access issue</h1><p>Please verify you are human</p></body></html>')).toBe(true);
    expect(looksLikeBlockPage('<title>Just a moment...</title>')).toBe(true);
  });

  it('does not flag a recipe page or a long page', () => {
    expect(looksLikeBlockPage('<script type="application/ld+json">{"@type":"Recipe","recipeIngredient":[]}</script> captcha')).toBe(false);
    expect(looksLikeBlockPage(`<html>${'x'.repeat(9_000)} captcha</html>`)).toBe(false);
    expect(looksLikeBlockPage('<html><body>Simple pancakes</body></html>')).toBe(false);
  });

  it('goes to the fallback straight away when a 200 response is a block page', async () => {
    const fetchHtmlFallback = vi.fn().mockResolvedValue({
      html: '<html><body><p>Mix 2 cups flour. Bake.</p></body></html>',
      finalUrl: 'https://example.com/r',
      httpStatus: 200,
    });
    const provider = new GenericWebContentProvider({
      fetchImpl: htmlFetch('<html><body>Access issue. Verify you are human.</body></html>'),
      blockedPageFetcher: { name: 'test', fetchHtml: fetchHtmlFallback },
    });
    const content = await provider.acquire('https://example.com/r', ctx);
    expect(fetchHtmlFallback).toHaveBeenCalledOnce();
    expect(content.pageText).toContain('flour');
  });

  it('fails with BLOCKED when the fallback is not available', async () => {
    const provider = new GenericWebContentProvider({
      fetchImpl: htmlFetch('<html><body>Access issue. Verify you are human.</body></html>'),
    });
    await expect(provider.acquire('https://example.com/r', ctx)).rejects.toMatchObject({
      reason: 'BLOCKED',
      permanent: true,
    });
  });

  it('treats a 404 from the fallback browser as NOT_FOUND', async () => {
    const provider = new GenericWebContentProvider({
      fetchImpl: htmlFetch('', { status: 403 }),
      blockedPageFetcher: {
        name: 'test',
        fetchHtml: vi.fn().mockRejectedValue(new Error('Apify could not load the page (status 404)')),
      },
    });
    await expect(provider.acquire('https://example.com/r', ctx)).rejects.toMatchObject({
      reason: 'NOT_FOUND',
    });
  });
});

describe('preview of a blocked site', () => {
  it('reports blocked instead of failing', async () => {
    const unfurler = new OpenGraphLinkUnfurler(htmlFetch('', { status: 403 }));
    const preview = await unfurler.unfurl('https://www.simplyrecipes.com/recipes/x/');
    expect(preview).toMatchObject({ blocked: true, thumbnails: [], title: null });
  });

  it('still fails for a site that is missing', async () => {
    const unfurler = new OpenGraphLinkUnfurler(htmlFetch('', { status: 404 }));
    await expect(unfurler.unfurl('https://example.com/gone')).rejects.toMatchObject({
      reason: 'NOT_FOUND',
    });
  });

  it('puts the sharpest og:image first', async () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/a.jpg?w=300"><meta property="og:image" content="https://cdn.example.com/b.jpg?w=1600">`;
    const preview = await new OpenGraphLinkUnfurler(htmlFetch(html)).unfurl('https://example.com/r');
    expect(preview.thumbnails[0]?.url).toBe('https://cdn.example.com/b.jpg');
  });

  it('fetchHtml reports the status of a failed request', async () => {
    await expect(
      fetchHtml('https://example.com', { fetchImpl: htmlFetch('', { status: 503 }) }),
    ).rejects.toMatchObject({ httpStatus: 503, reason: 'BLOCKED' });
  });
});

describe('thumbnail picker', () => {
  it('reads announced widths', () => {
    expect(declaredImageWidth('https://x.com/a.jpg?w=1200')).toBe(1200);
    expect(declaredImageWidth('https://x.com/a.jpg?resize=440%2C230')).toBe(440);
    expect(declaredImageWidth('https://x.com/a_1600x900.jpg')).toBe(1600);
    expect(declaredImageWidth('https://x.com/food_16x9_1600/pancakes.jpg')).toBe(1600);
    expect(declaredImageWidth('https://x.com/plain.jpg')).toBeNull();
  });

  it('strips resize params, keeping other query values', () => {
    expect(stripResizeParams('https://x.com/a.jpg?resize=440%2C230')).toBe('https://x.com/a.jpg');
    expect(stripResizeParams('https://x.com/a.jpg?id=7&w=300')).toBe('https://x.com/a.jpg?id=7');
    expect(stripResizeParams('https://x.com/a.jpg?w=300&sig=abc')).toBe(
      'https://x.com/a.jpg?w=300&sig=abc',
    );
  });

  it('prefers the largest candidate and drops its resize query', () => {
    expect(
      pickBestImage([
        'https://x.com/a.jpg?resize=440%2C230',
        'https://x.com/b_1200x800.jpg',
        'https://x.com/c.jpg?w=800',
      ]),
    ).toBe('https://x.com/b_1200x800.jpg');
  });

  it('upgrades a lone resized image', () => {
    expect(pickBestImage(['https://ichef.bbci.co.uk/pancakes.jpg?resize=440%2C230'])).toBe(
      'https://ichef.bbci.co.uk/pancakes.jpg',
    );
  });

  it('keeps the first when no candidate announces a size', () => {
    expect(pickBestImage(['https://x.com/1.jpg', 'https://x.com/2.jpg'])).toBe('https://x.com/1.jpg');
    expect(pickBestImage([])).toBeUndefined();
  });
});

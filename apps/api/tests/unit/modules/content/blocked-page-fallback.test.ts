import { describe, expect, it, vi } from 'vitest';

import {
  ApifyPageFetcher,
  type BlockedPageFetcher,
} from '../../../../src/modules/content/providers/generic/apify-page-fetcher.js';
import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import type { FetchLike } from '../../../../src/modules/content/preview/fetch-html.js';
import { htmlFetch, webFixture } from '../../../helpers/web-fixtures.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };
const URL = 'https://www.allrecipes.com/recipe/1/lasagna/';

function fetcherReturning(html: string): {
  fetcher: BlockedPageFetcher;
  fetchHtml: ReturnType<typeof vi.fn>;
} {
  const fetchHtml = vi.fn().mockResolvedValue({ html, finalUrl: URL, httpStatus: 200 });
  return { fetcher: { name: 'test-fetcher', fetchHtml }, fetchHtml };
}

describe('GenericWebContentProvider blocked-site fallback', () => {
  it.each([402, 403, 429, 503])('re-fetches through the fallback when the site answers %i', async (status) => {
    const { fetcher, fetchHtml } = fetcherReturning(webFixture('recipe-text-only.html'));
    const provider = new GenericWebContentProvider({
      fetchImpl: htmlFetch('<html>blocked</html>', { status }),
      blockedPageFetcher: fetcher,
    });

    const content = await provider.acquire(URL, ctx);

    expect(fetchHtml).toHaveBeenCalledWith(URL);
    expect(content.pageText).toBeTruthy();
    expect(content.pageText).not.toContain('blocked');
  });

  it('does not use the fallback for a missing page', async () => {
    const { fetcher, fetchHtml } = fetcherReturning('<html></html>');
    const provider = new GenericWebContentProvider({
      fetchImpl: htmlFetch('not found', { status: 404 }),
      blockedPageFetcher: fetcher,
    });

    await expect(provider.acquire(URL, ctx)).rejects.toMatchObject({
      code: 'CONTENT_ACQUISITION_FAILED',
      message: 'Web fetch failed with status 404',
    });
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it('says the site blocks imports when there is no fallback or it fails too', async () => {
    const without = new GenericWebContentProvider({ fetchImpl: htmlFetch('', { status: 402 }) });
    await expect(without.acquire(URL, ctx)).rejects.toMatchObject({
      code: 'CONTENT_ACQUISITION_FAILED',
      message: 'This website blocks recipe imports (status 402)',
    });

    const failing = new GenericWebContentProvider({
      fetchImpl: htmlFetch('', { status: 403 }),
      blockedPageFetcher: {
        name: 'test-fetcher',
        fetchHtml: vi.fn().mockRejectedValue(new Error('Apify could not load the page (status 403)')),
      },
    });
    await expect(failing.acquire(URL, ctx)).rejects.toMatchObject({
      message: 'This website blocks recipe imports (status 403)',
    });
  });
});

describe('ApifyPageFetcher', () => {
  function apifyFetch(body: unknown, status = 201): FetchLike {
    return vi.fn<FetchLike>().mockResolvedValue(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    );
  }

  it('returns the rendered HTML and final URL', async () => {
    const fetchImpl = apifyFetch([
      { crawl: { httpStatusCode: 200, loadedUrl: `${URL}?x=1` }, html: '<html>ok</html>' },
    ]);

    const page = await new ApifyPageFetcher('token', fetchImpl).fetchHtml(URL);

    expect(page).toEqual({ html: '<html>ok</html>', finalUrl: `${URL}?x=1`, httpStatus: 200 });
    const [endpoint, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(endpoint).toContain('apify~rag-web-browser/run-sync-get-dataset-items');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      query: URL,
      scrapingTool: 'browser-playwright',
      outputFormats: ['html'],
    });
  });

  it('fails when the browser could not load the page', async () => {
    const fetcher = new ApifyPageFetcher('token', apifyFetch([{ crawl: { httpStatusCode: 500 }, html: '' }]));
    await expect(fetcher.fetchHtml(URL)).rejects.toThrow('Apify could not load the page (status 500)');
  });

  it('surfaces Apify API errors', async () => {
    const fetcher = new ApifyPageFetcher(
      'token',
      apifyFetch({ error: { type: 'actor-not-found' } }, 404),
    );
    await expect(fetcher.fetchHtml(URL)).rejects.toThrow('Apify request failed');
  });
});

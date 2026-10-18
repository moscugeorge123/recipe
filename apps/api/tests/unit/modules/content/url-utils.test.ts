import { describe, expect, it } from 'vitest';

import { hashUrl, legacyNormalizeUrl, normalizeUrl } from '../../../../src/shared/utils/url.js';

describe('url utils', () => {
  it('normalizes URLs by lowercasing host, dropping www and stripping tracking params', () => {
    const normalized = normalizeUrl(
      'https://WWW.Example.com/recipe/?utm_source=twitter&fbclid=abc',
    );

    expect(normalized).toBe('https://example.com/recipe');
  });

  it('produces stable hashes for normalized URLs', () => {
    const hashA = hashUrl('https://example.com/recipe');
    const hashB = hashUrl('https://example.com/recipe');

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });
});

describe('normalizeUrl: one string per page', () => {
  const YT = 'https://youtube.com/watch?v=dQw4w9WgXcQ';

  it.each([
    ['youtu.be share with si', 'https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123'],
    ['youtu.be share with a different si', 'https://youtu.be/dQw4w9WgXcQ?si=ZzZzZz999'],
    ['watch URL', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['mobile watch URL', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'],
    ['watch with extra params', 'https://youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&pp=abc'],
    ['shorts URL', 'https://www.youtube.com/shorts/dQw4w9WgXcQ?si=xyz'],
    ['http scheme and fragment', 'http://youtu.be/dQw4w9WgXcQ#t=10'],
  ])('YouTube: %s', (_name, url) => {
    expect(normalizeUrl(url)).toBe(YT);
  });

  it('keeps different YouTube videos apart', () => {
    expect(normalizeUrl('https://youtu.be/aaaaaaaaaaa')).not.toBe(
      normalizeUrl('https://youtu.be/bbbbbbbbbbb'),
    );
  });

  it('strips tracking parameters and keeps the ones that select content', () => {
    expect(
      normalizeUrl('https://example.com/r?id=7&utm_medium=x&igshid=1&ref=home&gclid=2&_ga=3&mc_cid=4'),
    ).toBe('https://example.com/r?id=7');
  });

  it('sorts the remaining parameters', () => {
    expect(normalizeUrl('https://example.com/r?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/r?a=1&b=2'),
    );
  });

  it('ignores www, scheme, trailing slash and index.html', () => {
    const want = 'https://example.com/recipes/soup';
    expect(normalizeUrl('http://www.example.com/recipes/soup/')).toBe(want);
    expect(normalizeUrl('https://EXAMPLE.com/recipes/soup')).toBe(want);
    expect(normalizeUrl('https://example.com/recipes/soup/index.html')).toBe(want);
  });

  it('keeps the root path and a non-trivial query intact', () => {
    expect(normalizeUrl('https://www.example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/?p=12&utm_source=a')).toBe('https://example.com/?p=12');
  });

  it('strips the Instagram and TikTok share parameters', () => {
    expect(normalizeUrl('https://www.instagram.com/reel/Cabc123/?igsh=MWxx&utm_source=ig_web')).toBe(
      'https://instagram.com/reel/Cabc123',
    );
    expect(normalizeUrl('https://www.tiktok.com/@a/video/1?_r=1&_t=abc')).toBe(
      'https://tiktok.com/@a/video/1',
    );
  });

  it('keeps the old hash reachable through legacyNormalizeUrl', () => {
    expect(legacyNormalizeUrl('https://WWW.Example.com/recipe/?utm_source=t&fbclid=a')).toBe(
      'https://www.example.com/recipe',
    );
  });
});

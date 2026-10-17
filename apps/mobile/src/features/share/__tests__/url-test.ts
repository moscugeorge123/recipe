import {
  handoffFromShare,
  hostOf,
  importKeyOf,
  sourceOf,
} from '@/features/share/url';

describe('handoffFromShare', () => {
  test('prefers the shared web url', () => {
    expect(
      handoffFromShare({
        webUrl: 'https://www.instagram.com/reel/abc',
        text: 'look https://example.com/other',
        meta: { title: '  Lemon pasta  ' },
      }),
    ).toEqual({
      url: 'https://www.instagram.com/reel/abc',
      title: 'Lemon pasta',
    });
  });

  test('pulls a link out of shared text', () => {
    expect(
      handoffFromShare({
        text: 'Made this tonight https://youtu.be/dQw4w9WgXcQ).',
      }),
    ).toEqual({
      url: 'https://youtu.be/dQw4w9WgXcQ',
      title: null,
    });
  });

  test('adds a scheme to a bare host', () => {
    expect(handoffFromShare({ webUrl: 'www.seriouseats.com/pasta' })).toEqual({
      url: 'https://www.seriouseats.com/pasta',
      title: null,
    });
  });

  test('rejects a share with no link', () => {
    expect(handoffFromShare({ text: 'just a note' })).toBeNull();
    expect(handoffFromShare({})).toBeNull();
  });
});

describe('sourceOf', () => {
  test('names the platforms the importer already understands', () => {
    expect(sourceOf('https://www.tiktok.com/@cook/video/1')?.name).toBe(
      'TikTok',
    );
    expect(sourceOf('https://pin.it/abc')?.kind).toBe('pinterest');
    expect(sourceOf('https://cooking.nytimes.com/recipes/1')?.kind).toBe('web');
  });
});

describe('hostOf', () => {
  test('drops the scheme and www', () => {
    expect(hostOf('https://www.bbcgoodfood.com/recipes/cake')).toBe(
      'bbcgoodfood.com',
    );
  });
});

describe('importKeyOf', () => {
  const YT = 'youtube.com/watch?v=dQw4w9WgXcQ';

  test.each([
    'https://youtu.be/dQw4w9WgXcQ?si=AbCdEf',
    'https://youtu.be/dQw4w9WgXcQ?si=Other',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'http://youtu.be/dQw4w9WgXcQ#t=5',
  ])('YouTube link %s has one key', (url) => {
    expect(importKeyOf(url)).toBe(YT);
  });

  test('different videos differ', () => {
    expect(importKeyOf('https://youtu.be/aaaaaaaaaaa')).not.toBe(
      importKeyOf('https://youtu.be/bbbbbbbbbbb'),
    );
  });

  test('ignores www, scheme, tracking parameters, order and trailing slash', () => {
    const key = importKeyOf('https://example.com/r?a=1&b=2');
    expect(importKeyOf('http://www.example.com/r/?b=2&a=1&utm_source=x')).toBe(
      key,
    );
    expect(importKeyOf('https://example.com/r?a=1&b=2&igshid=9&ref=h')).toBe(
      key,
    );
  });

  test('keeps parameters that pick the content', () => {
    expect(importKeyOf('https://example.com/r?id=1')).not.toBe(
      importKeyOf('https://example.com/r?id=2'),
    );
  });
});

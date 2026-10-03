import { handoffFromShare, hostOf, sourceOf } from '@/features/share/url';

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

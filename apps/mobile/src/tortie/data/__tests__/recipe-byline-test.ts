import { bylineOf, sourceHost } from '@/tortie/data/recipes';

describe('sourceHost', () => {
  test('strips the scheme and www', () => {
    expect(sourceHost('https://www.Instagram.com/reel/abc')).toBe(
      'instagram.com',
    );
  });

  test('is null for missing or non-web values', () => {
    expect(sourceHost(null)).toBeNull();
    expect(sourceHost('pia@example.com')).toBeNull();
  });
});

describe('bylineOf', () => {
  test('credits the creator of an imported recipe', () => {
    expect(
      bylineOf({
        creator: 'Pia Castellano',
        originalUrl: 'https://example.com/shakshuka',
      }),
    ).toBe('by Pia Castellano');
  });

  test('says "by you" when the recipe has no web source', () => {
    expect(bylineOf({ creator: 'Manual', originalUrl: null })).toBe('by you');
  });
});

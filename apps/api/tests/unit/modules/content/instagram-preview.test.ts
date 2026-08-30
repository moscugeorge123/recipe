import { describe, expect, it } from 'vitest';

import { mapInstagramOembed, parseInstagramOgTitle } from '../../../../src/modules/content/preview/instagram-mapper.js';
import { InstagramLinkUnfurler } from '../../../../src/modules/content/preview/unfurlers/instagram.unfurler.js';

describe('mapInstagramOembed', () => {
  it('maps author, title and thumbnail when they are provided', () => {
    expect(
      mapInstagramOembed({
        author_name: 'noor.cooks',
        title: 'the pistachio pasta',
        thumbnail_url: 'https://cdn.example/still.jpg',
      }),
    ).toEqual({
      author: 'noor.cooks',
      title: 'the pistachio pasta',
      thumbnailUrl: 'https://cdn.example/still.jpg',
    });
  });

  it('ignores a title that is just the username', () => {
    expect(
      mapInstagramOembed({
        author_name: 'noor.cooks',
        title: '@noor.cooks',
        thumbnail_url: 'https://cdn.example/still.jpg',
      }),
    ).toEqual({
      author: 'noor.cooks',
      title: null,
      thumbnailUrl: 'https://cdn.example/still.jpg',
    });
  });

  it('leaves missing fields null', () => {
    expect(mapInstagramOembed({})).toEqual({
      author: null,
      title: null,
      thumbnailUrl: null,
    });
  });
});

describe('parseInstagramOgTitle', () => {
  it('splits the typical Instagram og:title', () => {
    expect(
      parseInstagramOgTitle('noor.cooks on Instagram: "the pistachio pasta everyone keeps asking about"'),
    ).toEqual({
      author: 'noor.cooks',
      title: 'the pistachio pasta everyone keeps asking about',
    });
  });

  it('uses the first caption line and decodes emoji entities', () => {
    expect(
      parseInstagramOgTitle(
        'Andreea Dumitru on Instagram: "Salata de cartofi si oua &#x1f95a;\nAi nevoie de:\n&#x25aa;&#xfe0f; cartofi"',
      ),
    ).toEqual({
      author: 'Andreea Dumitru',
      title: 'Salata de cartofi si oua 🥚',
    });
  });

  it('keeps a short oEmbed title with a decoded emoji', () => {
    expect(
      mapInstagramOembed({
        author_name: 'Andreea Dumitru',
        title: 'Salata de cartofi si oua &#x1f95a;',
        thumbnail_url: 'https://cdn.example/still.jpg',
      }),
    ).toEqual({
      author: 'Andreea Dumitru',
      title: 'Salata de cartofi si oua 🥚',
      thumbnailUrl: 'https://cdn.example/still.jpg',
    });
  });

  it('keeps author when there is no quoted remainder', () => {
    expect(parseInstagramOgTitle('noor.cooks on Instagram')).toEqual({
      author: 'noor.cooks',
      title: null,
    });
  });
});

describe('InstagramLinkUnfurler', () => {
  it('uses Graph oEmbed when app credentials are set and forces description null', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          author_name: 'baker',
          title: 'Sourdough loaf',
          thumbnail_url: 'https://cdn.example/t.jpg',
        }),
        { status: 200 },
      );

    const unfurler = new InstagramLinkUnfurler({
      appId: 'app',
      appSecret: 'secret',
      fetchImpl,
    });

    const preview = await unfurler.unfurl('https://www.instagram.com/reel/abc/');

    expect(preview).toEqual({
      url: 'https://www.instagram.com/reel/abc/',
      sourceType: 'INSTAGRAM',
      title: 'Sourdough loaf',
      author: 'baker',
      description: null,
      thumbnails: [{ url: 'https://cdn.example/t.jpg' }],
    });
  });

  it('falls back to Open Graph without inventing copy', async () => {
    const html = `
      <meta property="og:title" content="noor.cooks on Instagram: &quot;weeknight pasta&quot;" />
      <meta property="og:description" content="should never appear" />
      <meta property="og:image" content="https://cdn.example/og.jpg" />
    `;
    const fetchImpl: typeof fetch = async () => new Response(html, { status: 200 });

    const preview = await new InstagramLinkUnfurler({ fetchImpl }).unfurl(
      'https://www.instagram.com/reel/abc/',
    );

    expect(preview.description).toBeNull();
    expect(preview.author).toBe('noor.cooks');
    expect(preview.title).toBe('weeknight pasta');
    expect(preview.thumbnails).toEqual([{ url: 'https://cdn.example/og.jpg' }]);
  });
});

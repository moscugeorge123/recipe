import { describe, expect, it } from 'vitest';

import { parseOpenGraph } from '../../../../src/modules/content/preview/open-graph.js';

const html = `
  <html>
    <head>
      <title>Fallback title</title>
      <meta property="og:title" content="Pistachio pasta" />
      <meta property="og:description" content="A weeknight bowl" />
      <meta property="og:image" content="https://cdn.example/one.jpg" />
      <meta property="og:image" content="https://cdn.example/two.jpg" />
      <meta property="og:image" content="https://cdn.example/one.jpg" />
      <meta content="https://cdn.example/twitter.jpg" name="twitter:image" />
      <meta name="twitter:image:src" content="https://cdn.example/two.jpg" />
    </head>
  </html>
`;

describe('parseOpenGraph', () => {
  it('reads title, description and unique images in document order', () => {
    const parsed = parseOpenGraph(html);

    expect(parsed.title).toBe('Pistachio pasta');
    expect(parsed.description).toBe('A weeknight bowl');
    expect(parsed.images).toEqual([
      'https://cdn.example/one.jpg',
      'https://cdn.example/two.jpg',
      'https://cdn.example/twitter.jpg',
    ]);
  });

  it('falls back to the title tag and decodes entities', () => {
    const parsed = parseOpenGraph(
      '<html><head><title>Lemon &amp; herb chicken</title></head></html>',
    );

    expect(parsed.title).toBe('Lemon & herb chicken');
    expect(parsed.description).toBeNull();
    expect(parsed.images).toEqual([]);
  });

  it('decodes numeric emoji entities in og:title', () => {
    const parsed = parseOpenGraph(
      '<meta property="og:title" content="Salata de cartofi si oua &#x1f95a;" />',
    );

    expect(parsed.title).toBe('Salata de cartofi si oua 🥚');
  });
});

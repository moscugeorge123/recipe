import { describe, expect, it } from 'vitest';

import { looksLikeRecipePage } from '../../../../src/modules/content/preview/recipe-precheck.js';

const filler = ' Lorem ipsum dolor sit amet consectetur adipiscing elit.'.repeat(12);

describe('looksLikeRecipePage', () => {
  it('accepts a page with a schema.org Recipe', () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Soup"}</script></head><body>${filler}</body></html>`;
    expect(looksLikeRecipePage(html)).toBe(true);
  });

  it('accepts a recipe typed as part of a @graph list', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":["Article","Recipe"]}]}</script><body>${filler}</body>`;
    expect(looksLikeRecipePage(html)).toBe(true);
  });

  it('accepts a recipe page with no structured data', () => {
    const html = `<html><body><h1>Easy tomato soup</h1><p>Ingredients</p><ul>
      <li>2 tablespoons olive oil</li><li>1 onion, diced</li><li>3 cloves garlic</li>
      <li>800 g canned tomatoes</li><li>500 ml vegetable stock</li><li>1 teaspoon salt</li></ul>
      <p>Instructions</p><p>Heat the oil and sauté the onion until tender. Add the garlic, then the
      tomatoes and stock. Simmer for 20 minutes, blend until smooth and season with pepper.
      Serves 4. Prep time 10 minutes.</p>${filler}</body></html>`;
    expect(looksLikeRecipePage(html)).toBe(true);
  });

  it('rejects an encyclopedia or news article', () => {
    const html = `<html><body><h1>The domestic cat</h1><p>The cat is a small carnivorous mammal. It is the
      only domesticated species in the family Felidae. Cats are valued by humans for companionship
      and their ability to kill vermin. They sleep for most of the day and hunt at dusk, and
      some are fed fish or milk by their owners.</p>${filler}${filler}</body></html>`;
    expect(looksLikeRecipePage(html)).toBe(false);
  });

  it('says nothing about a page with almost no text', () => {
    expect(looksLikeRecipePage('<html><body><div id="app"></div><script>boot()</script></body></html>')).toBeNull();
    expect(looksLikeRecipePage('')).toBeNull();
  });

  it('ignores words that only appear in scripts and styles', () => {
    const scripts = '<script>var s = "flour sugar butter bake simmer 2 cups 3 tablespoons ingredients instructions";</script>'.repeat(5);
    expect(looksLikeRecipePage(`<html><body>${scripts}<p>${filler}</p></body></html>`)).toBe(false);
  });
});

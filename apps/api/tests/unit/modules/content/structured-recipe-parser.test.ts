import { describe, expect, it } from 'vitest';

import { extractPageText } from '../../../../src/modules/content/providers/generic/page-text.js';
import {
  parseCalories,
  parseDuration,
  parseJsonLdRecipes,
  parseMicrodataRecipe,
  parseStructuredRecipe,
} from '../../../../src/modules/content/providers/generic/structured-recipe-parser.js';
import { webFixture } from '../../../helpers/web-fixtures.js';

const ldScript = (json: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(json)}</script>`;

describe('parseStructuredRecipe — JSON-LD', () => {
  it('reads a standard recipe blog block', () => {
    const recipe = parseStructuredRecipe(
      webFixture('recipe-blog-jsonld.html'),
      'https://tinykitchen.example/lemon-chicken',
    );

    expect(recipe).toBeDefined();
    expect(recipe?.source).toBe('json-ld');
    expect(recipe?.name).toBe('Lemon Garlic Chicken');
    expect(recipe?.description).toBe('Juicy one-pan chicken thighs with lemon & garlic.');
    expect(recipe?.author).toBe('Ana Pop');
    expect(recipe?.ingredients).toHaveLength(5);
    expect(recipe?.ingredients[1]).toBe('4 cloves garlic, minced');
    expect(recipe?.instructions).toEqual([
      {
        steps: [
          'Preheat the oven to 220°C.',
          'Rub the chicken with garlic, olive oil, lemon juice and salt.',
          'Roast for 30 minutes until golden.',
        ],
      },
    ]);
    expect(recipe?.recipeYield).toBe('4 servings');
    expect(recipe?.servings).toBe(4);
    expect(recipe?.prepTimeMinutes).toBe(10);
    expect(recipe?.cookTimeMinutes).toBe(30);
    expect(recipe?.totalTimeMinutes).toBe(40);
    expect(recipe?.calories).toBe(420);
    expect(recipe?.nutrition.proteinContent).toBe('38 g');
    expect(recipe?.cuisine).toEqual(['Mediterranean']);
    expect(recipe?.category).toEqual(['Dinner', 'Main course']);
    expect(recipe?.keywords).toEqual(['chicken', 'lemon', 'one-pan']);
    expect(recipe?.images).toEqual([
      'https://tinykitchen.example/img/chicken-1x1.jpg',
      'https://tinykitchen.example/img/chicken-4x3.jpg',
      'https://tinykitchen.example/img/chicken-16x9.jpg',
    ]);
  });

  it('finds the Recipe inside @graph with array @type and HowToSections', () => {
    const recipe = parseStructuredRecipe(webFixture('recipe-blog-graph.html'));

    expect(recipe?.name).toBe('Classic Banana Bread');
    expect(recipe?.author).toBe('Mara');
    expect(recipe?.ingredients).toContain('250 g flour');
    expect(recipe?.instructions).toEqual([
      {
        name: 'Batter',
        steps: [
          'Mash the bananas with the melted butter.',
          'Whisk in the sugar and egg, then fold in flour and baking soda.',
        ],
      },
      { name: 'Bake', steps: ['Bake at 175°C for 60 minutes.'] },
    ]);
    expect(recipe?.recipeYield).toBe('1 loaf (10 slices)');
    expect(recipe?.servings).toBe(1);
    expect(recipe?.totalTimeMinutes).toBe(75);
    expect(recipe?.cookTimeMinutes).toBe(60);
    expect(recipe?.calories).toBe(210);
    expect(recipe?.images).toEqual(['https://bake.example/banana.jpg']);
  });

  it('finds a Recipe nested under WebPage.mainEntity and a prefixed @type', () => {
    const html = ldScript({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      mainEntity: {
        '@type': 'http://schema.org/Recipe',
        name: 'Pancakes',
        recipeIngredient: '2 eggs',
        recipeInstructions: '<ol><li>Whisk eggs.</li><li>Fry in butter.</li></ol>',
      },
    });

    const recipe = parseStructuredRecipe(html);
    expect(recipe?.name).toBe('Pancakes');
    expect(recipe?.ingredients).toEqual(['2 eggs']);
    expect(recipe?.instructions[0]?.steps).toEqual(['Whisk eggs.', 'Fry in butter.']);
  });

  it('splits newline-separated instruction strings and strips numbering', () => {
    const recipe = parseStructuredRecipe(
      ldScript({
        '@type': 'Recipe',
        name: 'Toast',
        recipeInstructions: '1. Toast the bread.\n2. Butter it.',
      }),
    );
    expect(recipe?.instructions[0]?.steps).toEqual(['Toast the bread.', 'Butter it.']);
  });

  it('tolerates raw newlines inside strings and trailing commas', () => {
    const html = `<script type="application/ld+json">{
      "@type": "Recipe",
      "name": "Broken
      JSON Soup",
      "recipeIngredient": ["1 l water", "salt",],
    }</script>`;
    const recipe = parseStructuredRecipe(html);
    expect(recipe?.name).toBe('Broken JSON Soup');
    expect(recipe?.ingredients).toEqual(['1 l water', 'salt']);
  });

  it('picks the richest Recipe when several are present', () => {
    const html =
      ldScript({ '@type': 'Recipe', name: 'Teaser' }) +
      ldScript({ '@type': 'Recipe', name: 'Full', recipeIngredient: ['a', 'b'] });
    expect(parseJsonLdRecipes(html)).toHaveLength(2);
    expect(parseStructuredRecipe(html)?.name).toBe('Full');
  });

  it('ignores non-Recipe JSON-LD (news, product) and invalid JSON', () => {
    expect(parseStructuredRecipe(webFixture('news-article.html'))).toBeUndefined();
    expect(parseStructuredRecipe(webFixture('product-page.html'))).toBeUndefined();
    expect(
      parseStructuredRecipe('<script type="application/ld+json">{not json</script>'),
    ).toBeUndefined();
  });
});

describe('parseStructuredRecipe — microdata', () => {
  it('reads itemprop-based Recipe markup', () => {
    const recipe = parseMicrodataRecipe(
      webFixture('recipe-microdata.html'),
      'https://rice.example/garlic-butter-rice',
    );
    expect(recipe?.source).toBe('microdata');
    expect(recipe?.name).toBe('Garlic Butter Rice');
    expect(recipe?.ingredients).toEqual([
      '200 g long-grain rice',
      '2 tbsp butter',
      '3 cloves garlic, minced',
    ]);
    expect(recipe?.instructions[0]?.steps).toHaveLength(2);
    expect(recipe?.prepTimeMinutes).toBe(5);
    expect(recipe?.cookTimeMinutes).toBe(20);
    expect(recipe?.servings).toBe(3);
    expect(recipe?.images).toEqual(['https://rice.example/images/rice.jpg']);
  });

  it('is used as a fallback when there is no JSON-LD', () => {
    expect(parseStructuredRecipe(webFixture('recipe-microdata.html'))?.source).toBe('microdata');
  });
});

describe('parseDuration / parseCalories', () => {
  it.each([
    ['PT20M', 20],
    ['PT1H30M', 90],
    ['P0DT1H15M', 75],
    ['PT0.5H', 30],
    ['PT90S', 2],
    ['P1D', 1440],
    ['PT0M', 0],
    ['1 hour 20 minutes', 80],
    ['45 mins', 45],
  ])('parses %s → %d minutes', (raw, minutes) => {
    expect(parseDuration(raw)).toBe(minutes);
  });

  it.each([[''], ['PT'], ['soon'], [null], ['P400D']])('rejects %s', (raw) => {
    expect(parseDuration(raw)).toBeUndefined();
  });

  it('parses calorie strings and numbers', () => {
    expect(parseCalories('420 kcal')).toBe(420);
    expect(parseCalories('1,5 kcal')).toBe(2);
    expect(parseCalories(310.4)).toBe(310);
    expect(parseCalories('n/a')).toBeUndefined();
  });
});

describe('extractPageText', () => {
  it('keeps article text and drops nav, scripts, styles and footer', () => {
    const text = extractPageText(webFixture('recipe-blog-jsonld.html'));
    expect(text).toContain('Lemon Garlic Chicken');
    expect(text).toContain('- 8 bone-in chicken thighs');
    expect(text).not.toContain('dataLayer');
    expect(text).not.toContain('color: red');
    expect(text).not.toContain('Home');
    expect(text).not.toContain('© Tiny Kitchen');
  });

  it('falls back to body text when there is no article/main', () => {
    const text = extractPageText(webFixture('recipe-text-only.html'));
    expect(text).toContain('800 g canned tomatoes');
    expect(text).toContain('simmer for 20 minutes');
    expect(text).not.toContain('Popular posts');
    expect(text).not.toContain('Contact us');
  });

  it('caps the text at a word boundary', () => {
    const html = `<body><p>${'word '.repeat(5000)}</p></body>`;
    const text = extractPageText(html, 1000);
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text.endsWith('word')).toBe(true);
  });
});

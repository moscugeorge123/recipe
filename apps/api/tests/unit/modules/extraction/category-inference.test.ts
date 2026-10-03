import { describe, expect, it } from 'vitest';

import {
  RecipeNormalizer,
  normalizeRecipeCategorySlugs,
} from '../../../../src/modules/normalization/application/recipe-normalizer.js';

describe('extraction category and ingredient presentation fallback', () => {
  it('keeps valid stable slugs and deterministically infers missing categories', () => {
    expect(normalizeRecipeCategorySlugs(['sweet', 'breakfast'], 'Cake', null)).toEqual([
      'sweet',
      'breakfast',
    ]);
    expect(normalizeRecipeCategorySlugs(['invalid'], 'Chocolate cake', null)).toEqual([
      'sweet',
      'dinner',
    ]);
    expect(normalizeRecipeCategorySlugs(undefined, 'Eggs for brunch', null)).toEqual(['breakfast']);
  });

  it('rejects invalid emoji/color output and uses Garden Plate-safe values', () => {
    const normalized = new RecipeNormalizer().normalize({
      title: 'Tomato salad',
      sourceLanguage: 'en',
      categorySlugs: [],
      ingredients: [
        {
          name: 'Tomato',
          quantity: '2',
          confidence: 0.8,
          emoji: 'not emoji',
          colorToken: 'magenta',
        },
      ],
      steps: [{ stepOrder: 1, instruction: 'Slice tomato', confidence: 0.8 }],
    });
    expect(normalized.categorySlugs).toEqual(['lunch']);
    expect(normalized.ingredients[0]).toMatchObject({
      emoji: '🥬',
      colorToken: 'basilSoft',
      category: 'Produce',
    });
  });

  it('accepts exactly one emoji grapheme from the same extraction request', () => {
    const normalized = new RecipeNormalizer().normalize({
      title: 'Dinner',
      sourceLanguage: 'en',
      categorySlugs: ['dinner'],
      ingredients: [
        {
          name: 'Chicken',
          quantity: '1',
          confidence: 0.8,
          emoji: '👩🏽‍🍳',
          colorToken: 'paprikaSoft',
        },
      ],
      steps: [{ stepOrder: 1, instruction: 'Cook', confidence: 0.8 }],
    });
    expect(normalized.ingredients[0]?.emoji).toBe('👩🏽‍🍳');
  });
});

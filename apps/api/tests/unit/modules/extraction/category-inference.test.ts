import { describe, expect, it } from 'vitest';

import {
  RecipeNormalizer,
  mealSlugsFromRecipeCategory,
  normalizeRecipeCategorySlugs,
} from '../../../../src/modules/normalization/application/recipe-normalizer.js';

describe('extraction category and ingredient presentation fallback', () => {
  it('keeps valid stable slugs and deterministically infers missing categories', () => {
    expect(normalizeRecipeCategorySlugs(['sweet', 'breakfast'], 'Cake', null)).toEqual([
      'sweet',
      'breakfast',
    ]);
    expect(normalizeRecipeCategorySlugs(['invalid'], 'Chocolate cake', null)).toEqual(['sweet']);
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

  it('does not default an unrecognised dish to dinner', () => {
    expect(normalizeRecipeCategorySlugs([], 'Perfect guacamole', 'A creamy avocado dip')).toEqual([]);
    expect(normalizeRecipeCategorySlugs(undefined, 'Roast chicken', null)).toEqual([]);
    expect(normalizeRecipeCategorySlugs(['dinner'], 'Roast chicken', null)).toEqual(['dinner']);
  });

  it.each([
    [['Main Course'], ['dinner']],
    [['Dessert'], ['sweet']],
    [['Breakfast', 'Brunch'], ['breakfast']],
    [['Lunch', 'Main Dish'], ['lunch', 'dinner']],
    [['Appetizer', 'Side Dish', 'Snack', 'Dip'], []],
    [[], []],
    [['Drinks'], []],
  ])('maps the page recipeCategory %j to %j', (categories, expected) => {
    expect(mealSlugsFromRecipeCategory(categories)).toEqual(expected);
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

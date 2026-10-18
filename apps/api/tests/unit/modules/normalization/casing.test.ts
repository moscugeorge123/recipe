import { describe, expect, it } from 'vitest';

import {
  normalizeRecipeTitle,
  toSentenceCase,
  toTitleCase,
} from '../../../../src/modules/normalization/domain/casing.js';

describe('normalizeRecipeTitle', () => {
  it.each([
    ['The Best Guacamole Recipe', 'The Best Guacamole Recipe'],
    ["Nonna's BBQ Ribs", "Nonna's BBQ Ribs"],
    ['Easy pancakes', 'Easy pancakes'],
    ['  Spaghetti   alla  Norma ', 'Spaghetti alla Norma'],
    ['chicken tikka masala', 'Chicken tikka masala'],
    ['Perfect Guacamole | Simply Recipes', 'Perfect Guacamole'],
    ['Easy pancakes - BBC Good Food', 'Easy pancakes'],
    ['Mac - n - Cheese Bake', 'Mac - n - Cheese Bake'],
    ['Pad Thai - simplyrecipes.com', 'Pad Thai'],
    ['Best Brownies EVER!!!', 'Best Brownies EVER'],
    ['Crispy Chicken 🍗🔥', 'Crispy Chicken'],
  ])('%s', (raw, expected) => {
    expect(normalizeRecipeTitle(raw)).toBe(expected);
  });

  it('keeps the original wording of a long clickbait title', () => {
    expect(
      normalizeRecipeTitle(
        '5 Minute Delicious Pasta to Save Your Busy Day! Easy and Cheap Pasta Recipe!',
      ),
    ).toBe('5 Minute Delicious Pasta to Save Your Busy Day! Easy and Cheap Pasta Recipe!');
  });

  it('converts an ALL CAPS title to Title Case', () => {
    expect(normalizeRecipeTitle('CHOCOLATE CAKE WITH ICING')).toBe('Chocolate Cake with Icing');
  });

  it('leaves short acronym-heavy titles alone', () => {
    expect(normalizeRecipeTitle('BLT')).toBe('BLT');
  });

  it('keeps non-Latin titles', () => {
    expect(normalizeRecipeTitle('Ciorbă de legume')).toBe('Ciorbă de legume');
  });
});

describe('toTitleCase / toSentenceCase', () => {
  it('title-cases with small words lower', () => {
    expect(toTitleCase('SALT AND PEPPER STEAK')).toBe('Salt and Pepper Steak');
  });

  it('still lower-cases ingredient names', () => {
    expect(toSentenceCase('Wholemeal PITTA')).toBe('Wholemeal pitta');
  });
});

import { describe, expect, it } from 'vitest';

import { IngredientNormalizer } from '../../../../src/modules/normalization/application/ingredient-normalizer.js';
import { reconcileMeasurements } from '../../../../src/modules/normalization/domain/measurement-conversion.js';
import { splitQuantityPhrase } from '../../../../src/modules/normalization/domain/units.js';
import type { ExtractedIngredient } from '../../../../src/modules/recipes/domain/types.js';

describe('splitQuantityPhrase', () => {
  it.each([
    ['1/4 teaspoon', 0.25, null, 'tsp'],
    ['1½ cups', 1.5, null, 'cup'],
    ['1 1/2 cups', 1.5, null, 'cup'],
    ['2 to 4 tablespoons', 2, 4, 'tbsp'],
    ['2–4', 2, 4, null],
    ['2-4', 2, 4, null],
    ['1 or 2', 1, 2, null],
    ['1 to 2', 1, 2, null],
    ['about 3', 3, null, null],
    ['200 g', 200, null, 'g'],
    ['3', 3, null, null],
    ['1 pinch', 1, null, 'pinch'],
    ['2 large', 2, null, null],
  ])('%s', (raw, min, max, unit) => {
    const phrase = splitQuantityPhrase(raw);
    expect(phrase.min).toBeCloseTo(min);
    expect(phrase.max).toBe(max);
    expect(phrase.unit).toBe(unit);
  });

  it('treats a bare pinch as a unit without an amount', () => {
    expect(splitQuantityPhrase('Pinch')).toMatchObject({ min: null, unit: 'pinch' });
    expect(splitQuantityPhrase('a pinch')).toMatchObject({ min: null, unit: 'pinch' });
  });

  it('knows Romanian unit words', () => {
    expect(splitQuantityPhrase('2 linguri')).toMatchObject({
      min: 2,
      unit: 'tbsp',
      unitText: 'linguri',
    });
  });

  it('returns nothing for empty or non-numeric text', () => {
    expect(splitQuantityPhrase(null)).toMatchObject({ min: null, max: null, unit: null });
    expect(splitQuantityPhrase('to taste')).toMatchObject({ min: null, unit: null });
  });
});

function ingredient(over: Partial<ExtractedIngredient>): ExtractedIngredient {
  return {
    name: 'Kosher salt',
    quantity: null,
    unit: null,
    preparation: null,
    optional: false,
    confidence: 0.9,
    ...over,
  } as ExtractedIngredient;
}

describe('IngredientNormalizer with phrases in quantity', () => {
  const normalizer = new IngredientNormalizer();

  it('takes the unit from the quantity phrase', () => {
    const row = normalizer.normalize(ingredient({ quantity: '1/4 teaspoon', unit: null }), 0);
    expect(row.quantity?.toNumber()).toBe(0.25);
    expect(row.unit).toBe('tsp');
    expect(row.warnings).toEqual([]);
  });

  it('keeps both ends of a range', () => {
    const row = normalizer.normalize(
      ingredient({ name: 'minced red onion', quantity: '2 to 4 tablespoons' }),
      0,
    );
    expect(row.quantity?.toNumber()).toBe(2);
    expect(row.quantityMax?.toNumber()).toBe(4);
    expect(row.unit).toBe('tbsp');
  });

  it('keeps a unitless range', () => {
    const row = normalizer.normalize(ingredient({ name: 'serrano chilis', quantity: '1 to 2' }), 0);
    expect([row.quantity?.toNumber(), row.quantityMax?.toNumber(), row.unit]).toEqual([1, 2, null]);
  });

  it('prefers an explicit unit over the phrase', () => {
    const row = normalizer.normalize(ingredient({ quantity: '2', unit: 'cups' }), 0);
    expect(row.unit).toBe('cup');
    expect(row.quantityMax).toBeNull();
  });

  it('drops count units when there is no amount', () => {
    const row = normalizer.normalize(
      ingredient({ name: 'Lemon wedges', quantity: null, unit: 'piece', optional: true }),
      0,
    );
    expect(row.unit).toBeNull();
    expect(row.quantity).toBeNull();
  });

  it('keeps a count unit next to an amount', () => {
    const row = normalizer.normalize(
      ingredient({ name: 'Large eggs', quantity: '2', unit: 'piece' }),
      0,
    );
    expect(row.unit).toBe('piece');
  });

  it('accepts "Pinch" as an amount label without a warning', () => {
    const row = normalizer.normalize(ingredient({ name: 'Black pepper', quantity: 'Pinch' }), 0);
    expect(row.unit).toBe('pinch');
    expect(row.warnings).toEqual([]);
  });

  it('fills metric and imperial from a recovered unit', () => {
    const row = normalizer.normalize(ingredient({ quantity: '1 tablespoon', name: 'Lime juice' }), 0);
    expect(row.metricUnit).toBe('tbsp');
    expect(row.imperialUnit).toBe('tbsp');
  });

  it('still converts mass for imperial', () => {
    const row = normalizer.normalize(ingredient({ name: 'Flour', quantity: '200 g' }), 0);
    expect(row.metricUnit).toBe('g');
    expect(row.imperialUnit).toBe('oz');
  });

  it('keeps the source spelling of unit words for non-English output', () => {
    const row = normalizer.normalize(ingredient({ name: 'Sare', quantity: '2 linguri' }), 0, 'ro');
    expect(row.unit).toBe('linguri');
  });
});

describe('reconcileMeasurements with a dropped unit', () => {
  it('uses the model unit when it restates the same number', () => {
    const result = reconcileMeasurements(
      { quantity: 0.25, unit: null },
      { quantity: 0.25, unit: 'tsp' },
      { quantity: 0.25, unit: 'tsp' },
    );
    expect(result.metric).toEqual({ quantity: 0.25, unit: 'tsp' });
  });

  it('keeps a bare count when the model converts it to a weight', () => {
    const result = reconcileMeasurements(
      { quantity: 2, unit: null },
      { quantity: 400, unit: 'g' },
      { quantity: 14, unit: 'oz' },
    );
    expect(result.metric).toEqual({ quantity: 2, unit: null });
  });
});

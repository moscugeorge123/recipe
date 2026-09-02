import { describe, expect, it } from 'vitest';

import {
  convertToGrams,
  parseQuantityNumber,
} from '../../../../src/modules/nutrition/domain/conversions.js';
import {
  addNutrition,
  divideNutrition,
  scaleNutrition,
} from '../../../../src/modules/nutrition/domain/nutrients.js';
import { toNutritionUxStatus } from '@recipe/contracts';

describe('nutrition unit conversions', () => {
  it('converts mass units to grams without guessing', () => {
    expect(convertToGrams({ quantity: 200, unit: 'g', ingredientName: 'pasta' })).toEqual({
      ok: true,
      grams: 200,
      source: 'mass',
    });
    expect(convertToGrams({ quantity: 1, unit: 'kg', ingredientName: 'flour' })).toEqual({
      ok: true,
      grams: 1000,
      source: 'mass',
    });
    expect(convertToGrams({ quantity: 1, unit: 'oz', ingredientName: 'butter' }).ok).toBe(true);
  });

  it('uses known densities for volume and refuses unknown liquids', () => {
    const milk = convertToGrams({ quantity: 1, unit: 'cup', ingredientName: 'milk' });
    expect(milk.ok).toBe(true);
    if (milk.ok) {
      expect(milk.source).toBe('volume-density');
      expect(milk.grams).toBeCloseTo(236.5882365 * 1.03, 4);
    }

    const mystery = convertToGrams({ quantity: 1, unit: 'cup', ingredientName: 'dragon fruit puree' });
    expect(mystery).toEqual({ ok: false, reason: 'no-density' });
  });

  it('uses typical counts only for established foods', () => {
    expect(convertToGrams({ quantity: 2, unit: null, ingredientName: 'egg' })).toEqual({
      ok: true,
      grams: 100,
      source: 'count',
    });
    expect(convertToGrams({ quantity: 2, unit: 'clove', ingredientName: 'garlic' })).toEqual({
      ok: true,
      grams: 6,
      source: 'count',
    });
    expect(convertToGrams({ quantity: 1, unit: null, ingredientName: 'mystery fruit' })).toEqual({
      ok: false,
      reason: 'no-portion',
    });
    expect(convertToGrams({ quantity: 1, unit: 'pinch', ingredientName: 'salt' })).toEqual({
      ok: false,
      reason: 'unknown-unit',
    });
  });

  it('uses USDA portions when density is unknown', () => {
    const converted = convertToGrams({
      quantity: 2,
      unit: 'tbsp',
      ingredientName: 'tahini',
      portions: [{ gramWeight: 15, amount: 1, description: 'tbsp' }],
    });
    expect(converted).toEqual({ ok: true, grams: 30, source: 'portion' });
  });

  it('parses fractional quantities', () => {
    expect(parseQuantityNumber('1/2')).toBe(0.5);
    expect(parseQuantityNumber(0)).toBeNull();
  });
});

describe('nutrition serving and 100g math', () => {
  it('scales per-100g nutrients by grams', () => {
    const scaled = scaleNutrition(
      { calories: 371, proteinGrams: 13, sodiumMilligrams: 6 },
      200 / 100,
    );
    expect(scaled.calories).toBe(742);
    expect(scaled.proteinGrams).toBe(26);
    expect(scaled.sodiumMilligrams).toBe(12);
  });

  it('divides recipe totals into per-portion and per-100g values', () => {
    const totals = addNutrition(
      { calories: 400, proteinGrams: 20, fatGrams: 10 },
      { calories: 200, proteinGrams: 4, fatGrams: 22 },
    );
    expect(divideNutrition(totals, 2)).toEqual({
      calories: 300,
      proteinGrams: 12,
      fatGrams: 16,
    });
    expect(divideNutrition(totals, 600 / 100)?.calories).toBe(100);
    expect(divideNutrition(totals, 0)).toBeNull();
  });
});

describe('nutrition UX status mapping', () => {
  it('maps persistence states onto product UX', () => {
    expect(toNutritionUxStatus('COMPLETED')).toBe('READY');
    expect(toNutritionUxStatus('PARTIAL')).toBe('PARTIAL');
    expect(toNutritionUxStatus('FAILED')).toBe('FAILED');
    expect(toNutritionUxStatus('PENDING')).toBe('PENDING');
    expect(toNutritionUxStatus('PROCESSING')).toBe('PENDING');
    expect(toNutritionUxStatus('NOT_REQUESTED')).toBe('UNAVAILABLE');
    expect(toNutritionUxStatus('NOT_REQUESTED', true)).toBe('PENDING');
    expect(toNutritionUxStatus(undefined)).toBe('UNAVAILABLE');
  });
});

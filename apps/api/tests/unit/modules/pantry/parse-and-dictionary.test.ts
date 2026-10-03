import { parsePantryText } from '../../../../src/modules/pantry/application/parse-pantry-text.js';
import { lookupIngredientDictionary } from '../../../../src/modules/pantry/application/ingredient-dictionary.js';
import { normalizeIngredientName } from '../../../../src/modules/normalization/domain/units.js';
import { describe, expect, it } from 'vitest';

describe('parsePantryText', () => {
  it('splits newlines and commas while keeping thousands', () => {
    const parsed = parsePantryText('olive oil\nsalt, pepper\n1,000 g flour');
    expect(parsed.map((item) => item.rawText)).toEqual([
      'olive oil',
      'salt',
      'pepper',
      '1,000 g flour',
    ]);
  });

  it('extracts a leading quantity and unit', () => {
    const [tomato] = parsePantryText('2 tomatoes');
    expect(tomato?.remainder).toBe('tomatoes');
    expect(tomato?.quantity).toBe(2);
  });

  it('keeps kilograms attached to the number', () => {
    const [flour] = parsePantryText('3kg flour');
    expect(flour?.remainder).toBe('flour');
    expect(flour?.quantity).toBe(3);
    expect(flour?.unit).toBe('kg');
  });
});

describe('ingredient name', () => {
  it('uses one singular form for lemon and lemons', () => {
    expect(normalizeIngredientName('Lemon')).toBe('lemon');
    expect(normalizeIngredientName('Lemons')).toBe('lemon');
    expect(normalizeIngredientName('tomatoes')).toBe('tomato');
    expect(normalizeIngredientName('asparagus')).toBe('asparagus');
  });
});

describe('ingredient dictionary', () => {
  it('covers multilingual pantry staples and misspellings', () => {
    expect(lookupIngredientDictionary('sare')?.canonicalName).toBe('salt');
    expect(lookupIngredientDictionary('ajo')?.canonicalName).toBe('garlic');
    expect(lookupIngredientDictionary('tomatos')?.canonicalName).toBe('tomato');
    expect(lookupIngredientDictionary('chickn')?.canonicalName).toBe('chicken');
    expect(lookupIngredientDictionary('beurre')?.canonicalName).toBe('butter');
  });

  it('uses one name for singular and plural', () => {
    expect(normalizeIngredientName('Lemon')).toBe('lemon');
    expect(normalizeIngredientName('Lemons')).toBe('lemon');
    expect(normalizeIngredientName('tomatoes')).toBe('tomato');
    expect(normalizeIngredientName('asparagus')).toBe('asparagus');
  });
});

import { parsePantryText } from '../../../../src/modules/pantry/application/parse-pantry-text.js';
import { lookupIngredientDictionary } from '../../../../src/modules/pantry/application/ingredient-dictionary.js';
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
});

describe('ingredient dictionary', () => {
  it('covers multilingual pantry staples and misspellings', () => {
    expect(lookupIngredientDictionary('sare')?.canonicalName).toBe('salt');
    expect(lookupIngredientDictionary('ajo')?.canonicalName).toBe('garlic');
    expect(lookupIngredientDictionary('tomatos')?.canonicalName).toBe('tomato');
    expect(lookupIngredientDictionary('chickn')?.canonicalName).toBe('chicken');
    expect(lookupIngredientDictionary('beurre')?.canonicalName).toBe('butter');
  });
});

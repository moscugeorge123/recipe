import { describe, expect, it } from 'vitest';

import {
  isOneEmoji,
  resolveIngredientPresentation,
} from '../../../../src/modules/normalization/domain/presentation.js';

describe('ingredient presentation', () => {
  it('accepts a single emoji grapheme and a Garden Plate token', () => {
    expect(isOneEmoji('🍅')).toBe(true);
    expect(isOneEmoji('🌶️')).toBe(true);
    expect(isOneEmoji('🍅🍅')).toBe(false);
    expect(isOneEmoji('tomato')).toBe(false);
  });

  it('falls back by grocery category when emoji or color is invalid', () => {
    const resolved = resolveIngredientPresentation({
      name: 'chicken thigh',
      category: 'Meat',
      emoji: 'not-an-emoji',
      colorToken: 'hotPink',
    });
    expect(resolved).toEqual({
      category: 'Meat',
      emoji: '🍗',
      colorToken: 'paprikaSoft',
    });
  });
});

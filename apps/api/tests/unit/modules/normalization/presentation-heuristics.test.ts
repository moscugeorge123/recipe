import { describe, expect, it } from 'vitest';

import {
  categorizeIngredient,
  cuisineFromText,
  isIngredientCategory,
  isStepStage,
  stageForIndex,
} from '../../../../src/modules/normalization/domain/presentation-heuristics.js';

describe('categorizeIngredient', () => {
  it('classifies meat, dairy, spices, produce, frozen, and pantry', () => {
    expect(categorizeIngredient('chicken thigh')).toBe('Meat');
    expect(categorizeIngredient('butter')).toBe('Dairy');
    expect(categorizeIngredient('cumin')).toBe('Spices');
    expect(categorizeIngredient('garlic')).toBe('Produce');
    expect(categorizeIngredient('frozen peas')).toBe('Frozen');
    expect(categorizeIngredient('olive oil')).toBe('Pantry');
  });

  it('prefers spices over produce for chilli flakes', () => {
    expect(categorizeIngredient('chilli flakes')).toBe('Spices');
  });
});

describe('cuisineFromText', () => {
  it('returns null when no cuisine keyword matches', () => {
    expect(cuisineFromText('Weeknight pasta', 'A simple garlic oil toss')).toBeNull();
    expect(cuisineFromText('Imported recipe')).toBeNull();
  });

  it('returns a cuisine label from title or description', () => {
    expect(cuisineFromText('Korean fried chicken')).toBe('Korean');
    expect(cuisineFromText('Pasta', 'An Italian classic')).toBe('Italian');
  });
});

describe('stageForIndex', () => {
  it('returns COOK when there is a single step', () => {
    expect(stageForIndex(0, 1)).toBe('COOK');
    expect(stageForIndex(0, 0)).toBe('COOK');
  });

  it('maps early, middle, finish, and last steps', () => {
    expect(stageForIndex(0, 6)).toBe('PREP');
    expect(stageForIndex(1, 6)).toBe('PREP');
    expect(stageForIndex(2, 6)).toBe('COOK');
    expect(stageForIndex(3, 6)).toBe('COOK');
    expect(stageForIndex(4, 6)).toBe('FINISH');
    expect(stageForIndex(5, 6)).toBe('SERVE');
  });
});

describe('enum guards', () => {
  it('accepts valid ingredient categories and step stages', () => {
    expect(isIngredientCategory('Produce')).toBe(true);
    expect(isIngredientCategory('pantry')).toBe(false);
    expect(isStepStage('PREP')).toBe(true);
    expect(isStepStage('prep')).toBe(false);
  });
});

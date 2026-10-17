import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  RecipeNormalizer,
  disambiguateRepeatedNames,
  servingsSanityWarnings,
  withInferredSeasonings,
} from '../../../../src/modules/normalization/application/recipe-normalizer.js';
import { tidyInlineMeasurements } from '../../../../src/modules/normalization/domain/measurement-conversion.js';
import type {
  ExtractedRecipe,
  NormalizedRecipe,
} from '../../../../src/modules/recipes/domain/types.js';
import { RecipeValidator } from '../../../../src/modules/validation/application/recipe-validator.js';

describe('tidyInlineMeasurements', () => {
  it.each([
    ['Sift 100g (3.53 oz) plain flour.', 'Sift 100 g (3½ oz) plain flour.'],
    ['Add 300ml (10.14 fl oz) milk.', 'Add 300 ml (10 fl oz) milk.'],
    ['Stir in 1 tbsp (15 ml) oil.', 'Stir in 1 tbsp (15 ml) oil.'],
    ['Fry for 1 min (1 min) each side.', 'Fry for 1 min each side.'],
    ['Bake for 20 minutes (20 mins).', 'Bake for 20 minutes.'],
    ['Microwave every 30 seconds (30 secs).', 'Microwave every 30 seconds.'],
    ['Cook for 1 hour (60 min).', 'Cook for 1 hour (60 min).'],
    ['Cook for 5 min (10 min).', 'Cook for 5 min (10 min).'],
    ['Bake at 180°C (350°F).', 'Bake at 180°C (350°F).'],
  ])('%s', (input, expected) => {
    expect(tidyInlineMeasurements(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = tidyInlineMeasurements('Whisk 250g (8.82 oz) sugar for 2 mins (2 mins).');
    expect(tidyInlineMeasurements(once)).toBe(once);
  });
});

function extracted(over: Partial<ExtractedRecipe>): ExtractedRecipe {
  return {
    title: 'Chocolate cake',
    sourceLanguage: 'en',
    ingredients: [],
    steps: [],
    ...over,
  };
}

describe('ingredient groups', () => {
  it('keeps the group heading and suffixes repeated names with it', () => {
    const recipe = new RecipeNormalizer().normalize(
      extracted({
        ingredients: [
          { name: 'cocoa powder', quantity: '2', unit: 'tbsp', group: 'For the sponge', confidence: 1 },
          { name: 'cocoa powder', quantity: '5', unit: 'tbsp', group: 'For the buttercream', confidence: 1 },
          { name: 'flour', quantity: '200', unit: 'g', group: 'For the sponge', confidence: 1 },
        ],
        steps: [{ stepOrder: 1, title: 'Mix', instruction: 'Mix the flour and cocoa powder.', confidence: 1 }],
      }),
    );
    expect(recipe.ingredients.map((i) => [i.name, i.group])).toEqual([
      ['Cocoa powder (sponge)', 'For the sponge'],
      ['Cocoa powder (buttercream)', 'For the buttercream'],
      ['Flour', 'For the sponge'],
    ]);
  });

  it('leaves repeated names alone when there is no group', () => {
    const rows = [
      { name: 'Butter', group: null },
      { name: 'Butter', group: null },
    ];
    expect(disambiguateRepeatedNames(rows)).toEqual(rows);
  });
});

describe('inferred seasonings', () => {
  const steps = [
    { stepOrder: 1, title: 'Cook', instruction: 'Cook with a pinch of salt and black pepper.', confidence: 1 },
  ];

  it('adds salt and pepper named in the method but missing from the list', () => {
    const added = withInferredSeasonings(
      extracted({
        ingredients: [{ name: 'eggs', quantity: '2', confidence: 1 }],
        steps,
      }),
    );
    expect(added.map((i) => i.name)).toEqual(['eggs', 'Salt', 'Black pepper']);
    expect(added[1]).toMatchObject({ optional: true, quantity: 'pinch', provenance: 'inferred' });
  });

  it('does not add what the list already has', () => {
    const list = [
      { name: 'Sea salt', quantity: '1', unit: 'tsp', confidence: 1 },
      { name: 'Ground pepper', quantity: '1', unit: 'tsp', confidence: 1 },
    ];
    expect(withInferredSeasonings(extracted({ ingredients: list, steps }))).toHaveLength(2);
  });

  it('ignores bell pepper in the method', () => {
    const added = withInferredSeasonings(
      extracted({
        ingredients: [{ name: 'eggs', quantity: '2', confidence: 1 }],
        steps: [{ stepOrder: 1, title: 'Chop', instruction: 'Chop the bell pepper.', confidence: 1 }],
      }),
    );
    expect(added).toHaveLength(1);
  });

  it('stores the pinch as an optional row without a warning', () => {
    const recipe = new RecipeNormalizer().normalize(
      extracted({ ingredients: [{ name: 'eggs', quantity: '2', confidence: 1 }], steps }),
    );
    const salt = recipe.ingredients.find((i) => i.name === 'Salt');
    expect(salt).toMatchObject({ optional: true, unit: 'pinch', quantity: null });
    expect((recipe.warnings as Array<{ field: string }>).filter((w) => w.field === 'Salt')).toEqual([]);
  });
});

describe('servingsSanityWarnings', () => {
  const grams = (n: number) => [{ metricQuantity: new Prisma.Decimal(n), metricUnit: 'g' }];

  it('flags many servings of a single dish', () => {
    const result = servingsSanityWarnings({
      title: 'Chocolate cake',
      servings: 14,
      calories: 523,
      ingredients: grams(900),
    });
    expect(result.warnings.map((w) => w.code)).toEqual(['SERVINGS_SUSPECT']);
    expect(result.dropCalories).toBe(false);
  });

  it('accepts a batch bake with many portions', () => {
    const result = servingsSanityWarnings({
      title: 'Chocolate chip cookies',
      servings: 24,
      calories: 180,
      ingredients: grams(700),
    });
    expect(result.warnings).toEqual([]);
  });

  it('drops a 61 kcal figure for 800 g of food', () => {
    const result = servingsSanityWarnings({
      title: 'Easy pancakes',
      servings: 12,
      calories: 61,
      ingredients: grams(800),
    });
    expect(result.dropCalories).toBe(true);
  });

  it('keeps low calories for a small dish', () => {
    const result = servingsSanityWarnings({
      title: 'Green tea',
      servings: 2,
      calories: 5,
      ingredients: grams(20),
    });
    expect(result).toEqual({ warnings: [], dropCalories: false });
  });

  it('hides the kcal badge through the normalizer', () => {
    const recipe = new RecipeNormalizer().normalize(
      extracted({
        title: 'Easy pancakes',
        servings: 12,
        calories: 61,
        ingredients: [{ name: 'flour', quantity: '800', unit: 'g', confidence: 1 }],
        steps: [{ stepOrder: 1, title: 'Mix', instruction: 'Mix everything well.', confidence: 1 }],
      }),
    );
    expect(recipe.calories).toBeNull();
    expect((recipe.warnings as Array<{ code: string }>).some((w) => w.code === 'SERVINGS_SUSPECT')).toBe(true);
  });
});

describe('RecipeValidator step/ingredient matching', () => {
  function recipe(over: Partial<NormalizedRecipe>): NormalizedRecipe {
    return {
      title: 'Pancakes',
      description: null,
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      difficulty: null,
      sourceLanguage: 'en',
      calories: null,
      cuisine: null,
      nutrition: null,
      confidence: 0,
      warnings: [],
      categorySlugs: ['breakfast'],
      ingredients: [
        {
          name: 'Plain flour',
          canonicalName: 'all-purpose flour',
          quantity: new Prisma.Decimal(100),
          unit: 'g',
          preparation: null,
          optional: false,
          category: 'Pantry',
          confidence: 1,
          sortOrder: 0,
        },
      ],
      steps: [],
      ...over,
    } as unknown as NormalizedRecipe;
  }

  const step = (instruction: string, ingredientRefs: number[] = []) => ({
    stepOrder: 1,
    title: null,
    instruction,
    durationMinutes: null,
    temperature: null,
    ingredientRefs,
    stage: 'COOK',
    ahead: false,
    confidence: 1,
    provenance: {},
    warnings: [],
  });

  const mismatch = (r: NormalizedRecipe) =>
    new RecipeValidator().validate(r).warnings.filter((w) => w.code === 'STEP_INGREDIENT_MISMATCH');

  it('trusts ingredientRefs', () => {
    expect(mismatch(recipe({ steps: [step('Combine everything in a large bowl.', [0])] }))).toEqual([]);
  });

  it('matches the last word of a multi-word name', () => {
    expect(mismatch(recipe({ steps: [step('Sift the flour into a large bowl.')] }))).toEqual([]);
  });

  it('matches a plural of the ingredient', () => {
    const r = recipe({ steps: [step('Fry the eggs in a hot pan until set.')] });
    r.ingredients[0]!.name = 'Egg';
    r.ingredients[0]!.canonicalName = 'egg';
    expect(mismatch(r)).toEqual([]);
  });

  it('still warns when nothing in the step relates to the list', () => {
    expect(mismatch(recipe({ steps: [step('Preheat the oven and grease a tin.')] }))).toHaveLength(1);
  });

  it('does not match short words by accident', () => {
    const r = recipe({ steps: [step('Preheat the oven and grease a baking tin.')] });
    r.ingredients[0]!.name = 'Oil';
    r.ingredients[0]!.canonicalName = 'oil';
    expect(mismatch(r)).toHaveLength(1);
  });
});

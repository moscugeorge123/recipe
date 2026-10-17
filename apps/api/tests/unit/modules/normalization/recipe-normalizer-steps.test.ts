import { describe, expect, it } from 'vitest';

import {
  RecipeNormalizer,
  orderExtractedSteps,
  shapeExtractedStep,
} from '../../../../src/modules/normalization/application/recipe-normalizer.js';
import type { ExtractedRecipe, ExtractedStep } from '../../../../src/modules/recipes/domain/types.js';

function step(over: Partial<ExtractedStep> & Pick<ExtractedStep, 'stepOrder'>): ExtractedStep {
  return { title: '', instruction: '', confidence: 0.9, ...over };
}

const pancakeSteps: ExtractedStep[] = [
  step({
    stepOrder: 1,
    title: 'Make the batter',
    instruction: 'Whisk the flour, eggs and milk in a bowl until smooth.',
  }),
  step({
    stepOrder: 2,
    title: 'Rest the batter',
    instruction: 'Set aside for 30 mins to rest if you have time, or start cooking straight away.',
    durationMinutes: 30,
    ahead: true,
  }),
  step({ stepOrder: 3, title: 'Prepare the pan', instruction: 'Heat a little oil in a pan.' }),
  step({ stepOrder: 4, title: 'Cook', instruction: 'Pour in some batter and cook for 1 min.' }),
  step({ stepOrder: 5, title: 'Serve', instruction: 'Serve with lemon.' }),
];

describe('orderExtractedSteps', () => {
  it('keeps an optional rest after the step that makes the batter', () => {
    const ordered = orderExtractedSteps(pancakeSteps);
    expect(ordered.map((item) => item.step.title)).toEqual([
      'Make the batter',
      'Rest the batter',
      'Prepare the pan',
      'Cook',
      'Serve',
    ]);
    expect(ordered.find((item) => item.step.title === 'Rest the batter')?.ahead).toBe(false);
  });

  it('keeps a rest after mixing even when the text is not optional', () => {
    const ordered = orderExtractedSteps([
      step({ stepOrder: 1, title: 'Mix the dough', instruction: 'Mix flour and water.' }),
      step({
        stepOrder: 2,
        title: 'Proof the dough',
        instruction: 'Leave to proof for 1 hour.',
        ahead: true,
      }),
    ]);
    expect(ordered.map((item) => item.ahead)).toEqual([false, false]);
  });

  it('still hoists a genuine pre-step to the front', () => {
    const ordered = orderExtractedSteps([
      step({ stepOrder: 1, title: 'Chop the onion', instruction: 'Chop the onion finely.' }),
      step({ stepOrder: 2, title: 'Cook the rice', instruction: 'Boil the rice for 12 minutes.' }),
      step({
        stepOrder: 3,
        title: 'Soak the rice',
        instruction: 'Soak the rice in cold water for 4 hours.',
        durationMinutes: 240,
        ahead: true,
      }),
    ]);
    expect(ordered[0]?.step.title).toBe('Soak the rice');
    expect(ordered[0]?.ahead).toBe(true);
    expect(ordered.slice(1).map((item) => item.step.title)).toEqual(['Chop the onion', 'Cook the rice']);
  });

  it('leaves a pre-step at the top of the source first and flagged', () => {
    const ordered = orderExtractedSteps([
      step({
        stepOrder: 1,
        title: 'Soak the rice',
        instruction: 'Soak the rice for 4 hours.',
        ahead: true,
      }),
      step({ stepOrder: 2, title: 'Boil the rice', instruction: 'Boil the rice.' }),
    ]);
    expect(ordered.map((item) => [item.step.title, item.ahead])).toEqual([
      ['Soak the rice', true],
      ['Boil the rice', false],
    ]);
  });

  it('orders by the model stepOrder, not by array position', () => {
    const ordered = orderExtractedSteps([
      step({ stepOrder: 2, title: 'B', instruction: 'Second.' }),
      step({ stepOrder: 1, title: 'A', instruction: 'First.' }),
    ]);
    expect(ordered.map((item) => item.step.title)).toEqual(['A', 'B']);
  });
});

describe('shapeExtractedStep title/body split', () => {
  it('merges a sentence the model cut after the title', () => {
    const shaped = shapeExtractedStep(
      step({
        stepOrder: 1,
        title: 'Cut the avocados',
        instruction: 'in half. Remove the pit. Scoop the flesh into a bowl.',
      }),
    );
    expect(shaped.titleSplit).toBe(true);
    expect(shaped.title).toBe('Cut the avocados');
    expect(shaped.instruction).toBe(
      'Cut the avocados in half. Remove the pit. Scoop the flesh into a bowl.',
    );
  });

  it('handles an instruction that repeats the title and continues in lower case', () => {
    const shaped = shapeExtractedStep(
      step({ stepOrder: 1, title: 'Cut the avocados', instruction: 'cut the avocados in half.' }),
    );
    expect(shaped.instruction).toBe('Cut the avocados in half.');
    expect(shaped.titleSplit).toBe(true);
  });

  it('drops a long title when merging', () => {
    const shaped = shapeExtractedStep(
      step({
        stepOrder: 1,
        title: 'Add the garlic and the chilli and the onions',
        instruction: 'to the pan and stir.',
      }),
    );
    expect(shaped.title).toBeNull();
    expect(shaped.instruction.startsWith('Add the garlic')).toBe(true);
  });

  it('does not touch a clean title and body', () => {
    const shaped = shapeExtractedStep(
      step({ stepOrder: 1, title: 'Boil the pasta', instruction: 'Cook for 10 minutes.' }),
    );
    expect(shaped).toMatchObject({
      title: 'Boil the pasta',
      instruction: 'Cook for 10 minutes.',
      titleSplit: false,
    });
  });

  it('capitalises a titleless lower-case instruction', () => {
    const shaped = shapeExtractedStep(step({ stepOrder: 1, title: '', instruction: 'stir well.' }));
    expect(shaped.instruction).toBe('Stir well.');
    expect(shaped.title).toBeNull();
  });
});

describe('RecipeNormalizer step output', () => {
  const base = {
    title: 'Easy pancakes',
    sourceLanguage: 'en',
    ingredients: [],
    steps: pancakeSteps,
  } as unknown as ExtractedRecipe;

  it('numbers steps in source order with no ahead flag and no lower-case instruction', () => {
    const recipe = new RecipeNormalizer().normalize(base);
    expect(recipe.steps.map((s) => s.title)).toEqual([
      'Make the batter',
      'Rest the batter',
      'Prepare the pan',
      'Cook',
      'Serve',
    ]);
    expect(recipe.steps.map((s) => s.stepOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(recipe.steps.every((s) => !s.ahead)).toBe(true);
    expect(recipe.steps[1]?.durationMinutes).toBe(30);
    for (const s of recipe.steps) expect(s.instruction).toMatch(/^\P{Ll}/u);
  });

  it('records a STEP_TITLE_SPLIT warning on a merged step', () => {
    const recipe = new RecipeNormalizer().normalize({
      ...base,
      steps: [step({ stepOrder: 1, title: 'Cut the avocados', instruction: 'in half.' })],
    });
    expect(recipe.steps[0]?.warnings).toEqual([expect.objectContaining({ code: 'STEP_TITLE_SPLIT' })]);
  });
});

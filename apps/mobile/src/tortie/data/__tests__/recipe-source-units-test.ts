import { mapRecipeDetail } from '@/features/recipes/mapper';
import type { RecipeDetailDto } from '@/features/recipes/schemas';
import { makeDraft, toRecipePatch } from '@/tortie/data/editor-draft';
import { ingQty, toTDetail } from '@/tortie/data/recipes';

jest.mock('@/tortie/nav-store', () => ({
  useNav: { getState: () => ({ closeEditor: jest.fn() }) },
}));

const step = {
  id: 's1',
  stepOrder: 1,
  title: 'Mix',
  instruction:
    'Whisk 100g (3.53 oz) plain flour with 300ml (10.14 fl oz) milk and 2 tbsp sugar.',
  durationMinutes: null,
  temperature: null,
  temperatureCelsius: null,
  temperatureFahrenheit: null,
  ingredientRefs: [],
  stage: 'PREP',
  ingredientHint: null,
  confidence: 0.9,
  provenance: null,
  warnings: null,
};

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Pancakes',
  description: null,
  servings: 12,
  prepTimeMinutes: 5,
  cookTimeMinutes: 10,
  totalTimeMinutes: 15,
  calories: null,
  nutritionSource: 'estimated',
  cuisine: null,
  difficulty: 'Easy',
  minutes: 15,
  nutrition: null,
  sourceLanguage: 'en',
  confidence: 0.9,
  warnings: [],
  promptVersion: 'recipe-extraction-v9',
  revisionNumber: 0,
  categories: [{ id: 'c1', slug: 'sweet', name: 'Sweet', sortOrder: 3 }],
  ingredients: [
    {
      id: 'i1',
      name: 'Plain flour',
      canonicalName: 'flour',
      quantity: '100',
      unit: 'g',
      metric: { quantity: '100', unit: 'g' },
      imperial: { quantity: '3.5', unit: 'oz' },
      preparation: null,
      optional: false,
      category: 'Pantry',
      confidence: 0.9,
      provenance: null,
      warnings: null,
      sortOrder: 0,
    },
  ],
  steps: [step],
  source: null,
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
} as unknown as RecipeDetailDto;

const view = mapRecipeDetail(dto);

describe('step text follows the unit preference', () => {
  test('metric: no imperial amount in the text', () => {
    expect(toTDetail(view, 'metric').steps[0]?.d).toBe(
      'Whisk 100g plain flour with 300ml milk and 30 ml sugar.',
    );
  });

  test('imperial: no metric amount in the text', () => {
    expect(toTDetail(view, 'imperial').steps[0]?.d).toBe(
      'Whisk 3½ oz plain flour with 10 fl oz milk and 2 tbsp sugar.',
    );
  });
});

describe('editor loads stored source amounts', () => {
  test('source units ignore the display preference', () => {
    const r = toTDetail(view, 'source');
    expect(r.ings.map((x) => ingQty(x))).toEqual(['100 g']);
    expect(r.steps[0]?.d).toContain('100g (3.53 oz)');
  });

  test('an imperial reader never sees converted values in the editor draft', () => {
    const display = makeDraft(toTDetail(view, 'imperial'));
    const editor = makeDraft(toTDetail(view, 'source'));
    expect(display.ings[0]?.txt).toBe('3½ oz Plain flour');
    expect(editor.ings[0]?.txt).toBe('100 g Plain flour');
  });

  test('saving an unchanged recipe round-trips the stored amounts', () => {
    const e0 = makeDraft(toTDetail(view, 'source'));
    const res = toRecipePatch(e0, e0, view, null);
    if (!('body' in res)) throw new Error(res.error);
    expect(res.body.ingredients?.[0]).toMatchObject({
      quantity: 100,
      unit: 'g',
    });
  });

  test('editing only the title keeps amounts that were not touched', () => {
    const e0 = makeDraft(toTDetail(view, 'source'));
    const res = toRecipePatch(
      { ...e0, title: 'Easy pancakes' },
      e0,
      view,
      null,
    );
    if (!('body' in res)) throw new Error(res.error);
    expect(res.body.ingredients?.[0]).toMatchObject({
      quantity: 100,
      unit: 'g',
    });
  });
});

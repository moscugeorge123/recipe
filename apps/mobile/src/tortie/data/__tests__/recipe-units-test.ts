import { mapRecipeDetail } from '@/features/recipes/mapper';
import type { RecipeDetailDto } from '@/features/recipes/schemas';
import { makeDraft, toRecipePatch } from '@/tortie/data/editor-draft';
import { ingQty, toTDetail } from '@/tortie/data/recipes';

jest.mock('@/tortie/nav-store', () => ({
  useNav: { getState: () => ({ closeEditor: jest.fn() }) },
}));

const dto: RecipeDetailDto = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Butter cake',
  description: null,
  servings: 8,
  prepTimeMinutes: 15,
  cookTimeMinutes: 35,
  totalTimeMinutes: 50,
  calories: 380,
  nutritionSource: 'estimated',
  cuisine: null,
  difficulty: 'Medium',
  minutes: 50,
  nutrition: { proteinGrams: 5, carbsGrams: 45, fatGrams: 20 },
  sourceLanguage: 'en',
  confidence: 0.9,
  warnings: [],
  promptVersion: 'recipe-extraction-v9',
  revisionNumber: 0,
  categories: [{ id: 'c1', slug: 'sweet', name: 'Sweet', sortOrder: 3 }],
  ingredients: [
    {
      id: 'i1',
      name: 'Flour',
      canonicalName: 'flour',
      quantity: '1.5',
      unit: 'cup',
      metric: { quantity: '180', unit: 'g' },
      imperial: { quantity: '1.5', unit: 'cup' },
      preparation: null,
      optional: false,
      category: 'Pantry',
      confidence: 0.9,
      provenance: null,
      warnings: null,
      sortOrder: 0,
    },
    {
      id: 'i2',
      name: 'Butter',
      canonicalName: 'butter',
      quantity: '113',
      unit: 'g',
      metric: { quantity: '113', unit: 'g' },
      imperial: { quantity: '4', unit: 'oz' },
      preparation: 'softened',
      optional: false,
      category: 'Dairy',
      confidence: 0.9,
      provenance: null,
      warnings: null,
      sortOrder: 1,
    },
  ],
  steps: [
    {
      id: 's1',
      stepOrder: 1,
      instruction: 'Cream together. Beat until pale and fluffy.',
      durationMinutes: 5,
      temperature: null,
      temperatureCelsius: null,
      temperatureFahrenheit: null,
      ingredientRefs: [1],
      stage: 'PREP',
      ingredientHint: null,
      confidence: 0.9,
      provenance: null,
      warnings: null,
    },
    {
      id: 's2',
      stepOrder: 2,
      instruction: 'Bake the cake. Bake at 180°C (350°F) until golden.',
      durationMinutes: 35,
      temperature: '180°C',
      temperatureCelsius: 180,
      temperatureFahrenheit: 350,
      ingredientRefs: [],
      stage: 'COOK',
      ingredientHint: null,
      confidence: 0.9,
      provenance: null,
      warnings: null,
    },
  ],
  source: null,
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
};

describe('toTDetail units', () => {
  const view = mapRecipeDetail(dto);

  test('metric shows weights, °C and metric-first step text', () => {
    const r = toTDetail(view, 'metric');
    expect(r.ings.map((x) => ingQty(x))).toEqual(['180 g', '115 g']);
    expect(r.ings[1]?.q).toBe(113);
    expect(r.steps[1]?.heat).toBe('180°C');
    expect(r.steps[1]?.d).toBe('Bake at 180°C (350°F) until golden.');
  });

  test('imperial shows cups/oz, °F and imperial-first step text, scaled for servings', () => {
    const r = toTDetail(view, 'imperial');
    expect(r.ings.map((x) => ingQty(x))).toEqual(['1½ cup', '4 oz']);
    expect(r.ings.map((x) => ingQty(x, 2))).toEqual(['3 cup', '8 oz']);
    expect(r.steps[1]?.heat).toBe('350°F');
    expect(r.steps[1]?.d).toBe('Bake at 350°F (180°C) until golden.');
  });

  test('prefers extracted ingredient refs over keyword matching', () => {
    const r = toTDetail(view, 'metric');
    expect(r.steps[0]?.need).toEqual([1]);
    expect(r.steps[1]?.need).toEqual([]);
  });
});

describe('toRecipePatch difficulty', () => {
  const view = mapRecipeDetail(dto);
  const detail = toTDetail(view, 'imperial');

  test('sends an edited level as difficulty', () => {
    const e0 = makeDraft(detail);
    const res = toRecipePatch({ ...e0, level: 'Hard' }, e0, view, null);
    expect('body' in res && res.body.difficulty).toBe('Hard');
  });

  test('omits difficulty when the level is unchanged, and keeps API amounts for untouched rows', () => {
    const e0 = makeDraft(detail);
    const res = toRecipePatch(e0, e0, view, null);
    if (!('body' in res)) throw new Error(res.error);
    expect(res.body).not.toHaveProperty('difficulty');
    expect(res.body.ingredients?.[0]).toMatchObject({
      quantity: 1.5,
      unit: 'cup',
    });
    expect(res.body.ingredients?.[1]).toMatchObject({
      quantity: 113,
      unit: 'g',
    });
  });
});

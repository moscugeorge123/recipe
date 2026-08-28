import { mapRecipeDetail } from '@/features/recipes/mapper';
import type { RecipeDetailDto } from '@/features/recipes/schemas';

const fixture: RecipeDetailDto = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Lemon Chicken Thighs',
  description: 'Weeknight Italian supper',
  servings: null,
  prepTimeMinutes: 10,
  cookTimeMinutes: 25,
  totalTimeMinutes: null,
  calories: 420,
  cuisine: null,
  difficulty: null,
  minutes: null,
  nutrition: null,
  sourceLanguage: 'en',
  confidence: 0.81,
  warnings: [],
  promptVersion: '1',
  ingredients: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Chicken thighs',
      canonicalName: 'chicken thigh',
      quantity: '6',
      unit: null,
      preparation: null,
      optional: false,
      category: 'Meat',
      confidence: 0.9,
      provenance: null,
      warnings: null,
      sortOrder: 0,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Lemon',
      canonicalName: 'lemon',
      quantity: 1,
      unit: null,
      preparation: null,
      optional: false,
      category: 'Produce',
      confidence: 0.9,
      provenance: null,
      warnings: null,
      sortOrder: 1,
    },
  ],
  steps: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      stepOrder: 1,
      instruction: 'Rub the chicken thighs with salt.',
      durationMinutes: 5,
      temperature: null,
      stage: 'PREP',
      ingredientHint: null,
      confidence: 0.8,
      provenance: null,
      warnings: null,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      stepOrder: 2,
      instruction: 'Roast until the skin is glass.',
      durationMinutes: 20,
      temperature: '200C',
      stage: 'SERVE',
      ingredientHint: null,
      confidence: 0.8,
      provenance: null,
      warnings: null,
    },
  ],
  source: {
    id: '66666666-6666-4666-8666-666666666666',
    sourceType: 'INSTAGRAM',
    originalUrl: 'https://instagram.com/p/example',
    normalizedUrl: 'https://instagram.com/p/example',
    metadata: {
      author: '@noor.cooks',
      thumbnailUrl: 'https://img.example/t.jpg',
    },
    author: '@noor.cooks',
    thumbnailUrl: 'https://img.example/t.jpg',
    sourceLabel: 'Instagram',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('mapRecipeDetail', () => {
  test('maps API recipe into RecipeView', () => {
    const view = mapRecipeDetail(fixture);

    expect(view.origin).toBe('api');
    expect(view.minutes).toBe(35);
    expect(view.servings).toBe(4);
    expect(view.difficulty).toBe('Medium');
    expect(view.sourceLabel).toBe('Instagram');
    expect(view.creator).toBe('@noor.cooks');
    expect(view.thumbnailUrl).toBe('https://img.example/t.jpg');
    expect(view.cuisine).toBe('Italian');
    expect(view.ingredients[0]?.category).toBe('Meat');
    expect(view.ingredients[0]?.quantity).toBe(6);
    expect(view.ingredients[1]?.category).toBe('Produce');
    expect(view.steps[0]?.durationSeconds).toBe(300);
    expect(view.steps[0]?.stage).toBe('PREP');
    expect(view.steps[1]?.stage).toBe('SERVE');
    expect(view.steps[0]?.ingredientHint).toBe('6 Chicken thighs');
  });

  test('prefers API cuisine, difficulty, minutes, and source fields', () => {
    const view = mapRecipeDetail({
      ...fixture,
      cuisine: 'Korean',
      difficulty: 'Hard',
      minutes: 12,
      ingredients: fixture.ingredients.map((ing, index) => ({
        ...ing,
        category: index === 0 ? 'Dairy' : 'not-a-category',
      })),
      steps: fixture.steps.map((step, index) => ({
        ...step,
        stage: index === 0 ? 'FINISH' : 'BOIL',
        ingredientHint: index === 0 ? 'hint from api' : null,
      })),
      source: fixture.source
        ? {
            ...fixture.source,
            author: '@api.author',
            thumbnailUrl: 'https://api.example/thumb.jpg',
            sourceLabel: 'Reels',
            metadata: {},
          }
        : null,
    });

    expect(view.cuisine).toBe('Korean');
    expect(view.difficulty).toBe('Hard');
    expect(view.minutes).toBe(12);
    expect(view.sourceLabel).toBe('Reels');
    expect(view.creator).toBe('@api.author');
    expect(view.thumbnailUrl).toBe('https://api.example/thumb.jpg');
    expect(view.ingredients[0]?.category).toBe('Dairy');
    expect(view.ingredients[1]?.category).toBe('Produce');
    expect(view.steps[0]?.stage).toBe('FINISH');
    expect(view.steps[1]?.stage).toBe('SERVE');
    expect(view.steps[0]?.ingredientHint).toBe('hint from api');
  });

  test('falls back to metadata author and thumbnail when source fields are empty', () => {
    const view = mapRecipeDetail({
      ...fixture,
      source: fixture.source
        ? {
            ...fixture.source,
            author: null,
            thumbnailUrl: null,
            sourceLabel: '',
          }
        : null,
    });

    expect(view.sourceLabel).toBe('Instagram');
    expect(view.creator).toBe('@noor.cooks');
    expect(view.thumbnailUrl).toBe('https://img.example/t.jpg');
  });
});

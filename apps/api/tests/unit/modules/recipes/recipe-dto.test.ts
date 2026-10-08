import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { serializeRecipeDetail } from '../../../../src/modules/recipes/api/recipes.controller.js';
import { recipeDetailSchema } from '../../../../src/modules/recipes/api/recipes.schema.js';
import type { RecipeDetailView } from '../../../../src/modules/recipes/application/recipe-service.js';

function detail(overrides: Partial<RecipeDetailView> = {}): RecipeDetailView {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Butter cake',
    description: null,
    servings: 8,
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    totalTimeMinutes: 50,
    difficulty: 'Hard',
    calories: 380,
    nutritionSource: 'estimated',
    cuisine: null,
    nutrition: { proteinGrams: 5, carbsGrams: 45, fatGrams: 20 },
    sourceLanguage: 'en',
    confidence: 0.9,
    warnings: [],
    promptVersion: 'recipe-extraction-v9',
    ingredients: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Flour',
        canonicalName: 'all-purpose flour',
        quantity: new Prisma.Decimal(1.5),
        unit: 'cup',
        metricQuantity: new Prisma.Decimal(180),
        metricUnit: 'g',
        imperialQuantity: new Prisma.Decimal(1.5),
        imperialUnit: 'cup',
        preparation: null,
        optional: false,
        emoji: '🌾',
        colorToken: 'honey50',
        category: 'Pantry',
        confidence: 0.9,
        provenance: {},
        warnings: [],
        sortOrder: 0,
      },
      {
        id: '55555555-5555-4555-8555-555555555556',
        name: 'Butter',
        canonicalName: 'butter',
        quantity: new Prisma.Decimal(4),
        unit: 'oz',
        metricQuantity: null,
        metricUnit: null,
        imperialQuantity: null,
        imperialUnit: null,
        preparation: null,
        optional: false,
        emoji: '🧈',
        colorToken: 'honey50',
        category: 'Dairy',
        confidence: 0.9,
        provenance: {},
        warnings: [],
        sortOrder: 1,
      },
    ],
    steps: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        stepOrder: 1,
        title: 'Bake the cake',
        instruction: 'Bake at 180°C (350°F) for 35 minutes.',
        durationMinutes: 35,
        temperature: '180°C',
        temperatureCelsius: null,
        temperatureFahrenheit: null,
        ingredientRefs: [0, 1],
        stage: 'COOK',
        ahead: false,
        confidence: 0.9,
        provenance: {},
        warnings: [],
      },
    ],
    categories: [
      { id: '77777777-7777-4777-8777-777777777777', slug: 'sweet', name: 'Sweet', sortOrder: 3 },
    ],
    source: {
      id: '11111111-1111-4111-8111-111111111111',
      sourceType: 'GENERIC_WEB',
      originalUrl: 'https://example.com/cake',
      normalizedUrl: 'https://example.com/cake',
      urlHash: 'hash',
      metadata: { author: 'Chef' },
      createdAt: new Date('2026-09-26T00:00:00.000Z'),
    },
    userRecipeId: '33333333-3333-4333-8333-333333333333',
    revisionId: '44444444-4444-4444-8444-444444444444',
    revisionNumber: 0,
    revisionSource: 'IMPORT',
    reviewState: 'READY',
    rating: null,
    ratingAverage: null,
    ratingCount: 0,
    isFavorite: false,
    cookCount: 0,
    createdAt: new Date('2026-09-26T00:00:00.000Z'),
    updatedAt: new Date('2026-09-26T00:00:00.000Z'),
    ...overrides,
  };
}

describe('serializeRecipeDetail', () => {
  it('matches the response schema', () => {
    expect(recipeDetailSchema.safeParse(serializeRecipeDetail(detail())).success).toBe(true);
  });

  it('exposes stored metric/imperial amounts without the raw columns', () => {
    const body = serializeRecipeDetail(detail());
    const [flour] = body.ingredients as Array<Record<string, unknown>>;
    expect(flour).toMatchObject({
      quantity: '1.5',
      unit: 'cup',
      metric: { quantity: '180', unit: 'g' },
      imperial: { quantity: '1.5', unit: 'cup' },
    });
    expect(flour).not.toHaveProperty('metricQuantity');
  });

  it('fills measurements and step temperatures for rows saved before they existed', () => {
    const body = serializeRecipeDetail(detail());
    const [, butter] = body.ingredients as Array<Record<string, unknown>>;
    expect(butter).toMatchObject({
      metric: { quantity: '115', unit: 'g' },
      imperial: { quantity: '4', unit: 'oz' },
    });
    const [step] = body.steps as Array<Record<string, unknown>>;
    expect(step).toMatchObject({
      temperatureCelsius: 180,
      temperatureFahrenheit: 350,
      ingredientRefs: [0, 1],
    });
  });

  it('prefers stored difficulty and nutrition source', () => {
    const body = serializeRecipeDetail(detail());
    expect(body.difficulty).toBe('Hard');
    expect(body.nutritionSource).toBe('estimated');
  });

  it('falls back to time-based difficulty and "stated" for legacy recipes', () => {
    const body = serializeRecipeDetail(detail({ difficulty: null, nutritionSource: null }));
    expect(body.difficulty).toBe('Medium');
    expect(body.nutritionSource).toBe('stated');
    const empty = serializeRecipeDetail(
      detail({ difficulty: null, nutritionSource: null, calories: null }),
    );
    expect(empty.nutritionSource).toBeNull();
  });
});

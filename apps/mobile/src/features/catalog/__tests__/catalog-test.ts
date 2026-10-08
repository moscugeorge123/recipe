import {
  catalogRecipes,
  collectionsForCatalog,
  mergeCookedCounts,
  mergeInboxStatus,
  mergeSavedIds,
} from '@/features/catalog/catalog';
import type { RecipeView } from '@/features/recipes/types';

function recipe(
  overrides: Partial<RecipeView> & Pick<RecipeView, 'id'>,
): RecipeView {
  return {
    origin: 'api',
    title: 'Soup',
    description: null,
    sourceType: 'GENERIC_WEB',
    sourceLabel: 'Website',
    creator: 'Chef',
    originalUrl: null,
    thumbnailUrl: null,
    placeholder: ['#E6D9C4', '#DCCBB0'],
    minutes: 30,
    difficulty: 'Easy',
    servings: 2,
    cuisine: 'Imported',
    calories: null,
    confidence: 0.8,
    warnings: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookCount: 0,
    reviewState: 'READY',
    ...overrides,
  };
}

describe('catalog ownership mapping', () => {
  test('production catalogs do not mix seed recipes into the list', () => {
    const api = [recipe({ id: '11111111-1111-4111-8111-111111111111' })];
    expect(catalogRecipes(api, false).map((item) => item.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(
      catalogRecipes(api, true).some((item) => item.id.startsWith('seed:')),
    ).toBe(true);
  });

  test('omitted API reviewState does not invent inbox ownership', () => {
    const recipes = [
      recipe({
        id: '11111111-1111-4111-8111-111111111111',
        reviewState: undefined,
      }),
    ];
    const inbox = mergeInboxStatus({
      recipes,
      local: {},
      migrationComplete: true,
    });
    expect(inbox['11111111-1111-4111-8111-111111111111']).toBeUndefined();
  });

  test('inbox and saved come from API review/favorite, not seed leftovers after migration', () => {
    const recipes = [
      recipe({
        id: '11111111-1111-4111-8111-111111111111',
        reviewState: 'NEEDS_REVIEW',
        isFavorite: true,
      }),
      recipe({
        id: 'seed:dal',
        origin: 'seed',
        reviewState: 'NEEDS_REVIEW',
        isFavorite: true,
      }),
    ];
    const inbox = mergeInboxStatus({
      recipes,
      local: { 'seed:dal': 'needs_review' },
      migrationComplete: true,
    });
    const saved = mergeSavedIds({
      recipes,
      local: ['seed:dal', '11111111-1111-4111-8111-111111111111'],
      migrationComplete: true,
    });
    expect(inbox['11111111-1111-4111-8111-111111111111']).toBe('needs_review');
    expect(inbox['seed:dal']).toBe('needs_review');
    expect(saved).toEqual(['11111111-1111-4111-8111-111111111111', 'seed:dal']);
  });

  test('cooked counts prefer completed API cookCount and keep seed overlays only', () => {
    const counts = mergeCookedCounts({
      recipes: [
        recipe({
          id: '11111111-1111-4111-8111-111111111111',
          cookCount: 3,
        }),
      ],
      local: {
        '11111111-1111-4111-8111-111111111111': 99,
        'seed:dal': 2,
      },
    });
    expect(counts['11111111-1111-4111-8111-111111111111']).toBe(3);
    expect(counts['seed:dal']).toBe(2);
  });

  test('queued collections replace leftover demo rows after migration', () => {
    const collections = collectionsForCatalog({
      leftover: [
        { id: 'sunday', name: 'Sunday cooking', recipeIds: ['seed:dal'] },
      ],
      queued: [
        {
          clientId: 'col-1',
          name: 'Weeknights',
          recipeIds: ['11111111-1111-4111-8111-111111111111'],
          createdAt: 1,
        },
      ],
      migrationComplete: true,
    });
    expect(collections).toEqual([
      {
        id: 'col-1',
        name: 'Weeknights',
        recipeIds: ['11111111-1111-4111-8111-111111111111'],
      },
    ]);
  });

  test('API collections win over leftover and same-name queued rows', () => {
    const collections = collectionsForCatalog({
      leftover: [
        { id: 'sunday', name: 'Sunday cooking', recipeIds: ['seed:dal'] },
      ],
      queued: [
        {
          clientId: 'col-1',
          name: 'Weeknights',
          recipeIds: [],
          createdAt: 1,
        },
      ],
      api: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Weeknights',
          recipeIds: ['11111111-1111-4111-8111-111111111111'],
        },
      ],
      migrationComplete: true,
    });
    expect(collections).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Weeknights',
        recipeIds: ['11111111-1111-4111-8111-111111111111'],
      },
    ]);
  });
});

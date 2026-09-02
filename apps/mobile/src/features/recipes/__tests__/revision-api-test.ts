import {
  listCategories,
  listRecipeRevisions,
  restoreRecipeRevision,
} from '@/features/recipes/api';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const source = {
  id: 'source-1',
  sourceType: 'INSTAGRAM',
  originalUrl: 'https://example.com/post',
  normalizedUrl: 'https://example.com/post',
  metadata: {},
  author: 'Chef',
  thumbnailUrl: null,
  sourceLabel: 'Instagram',
  createdAt: '2026-08-31T00:00:00.000Z',
};

describe('recipe revision and category API contracts', () => {
  afterEach(() => jest.restoreAllMocks());

  it('parses readable revision history including the original badge state', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'revision-0',
            revisionNumber: 0,
            source: 'IMPORT',
            createdAt: '2026-08-31T00:00:00.000Z',
            title: 'Original',
            isOriginal: true,
            summary: 'Original imported recipe',
            changes: ['Original imported recipe'],
          },
        ],
        meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
      }),
    );
    await expect(listRecipeRevisions('recipe-1')).resolves.toEqual([
      expect.objectContaining({ revisionNumber: 0, isOriginal: true }),
    ]);
  });

  it('restores through the non-destructive endpoint and maps the new head', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          id: 'recipe-1',
          title: 'Original',
          description: null,
          servings: 2,
          prepTimeMinutes: 5,
          cookTimeMinutes: 10,
          totalTimeMinutes: 15,
          calories: null,
          cuisine: null,
          difficulty: 'Easy',
          minutes: 15,
          nutrition: null,
          sourceLanguage: 'en',
          confidence: 0.8,
          warnings: [],
          promptVersion: 'v8',
          userRecipeId: 'user-recipe-1',
          revisionId: 'revision-2',
          revisionNumber: 2,
          revisionSource: 'RESTORE',
          reviewState: 'READY',
          categories: [
            { id: 'cat-dinner', slug: 'dinner', name: 'Dinner', sortOrder: 2 },
          ],
          isFavorite: false,
          rating: null,
          cookCount: 0,
          nutritionStatus: 'NOT_REQUESTED',
          ingredients: [
            {
              id: 'ingredient-1',
              name: 'Pasta',
              canonicalName: 'pasta',
              quantity: '200',
              unit: 'g',
              preparation: null,
              optional: false,
              emoji: '🍝',
              colorToken: 'peach',
              category: 'Pantry',
              confidence: 0.8,
              provenance: {},
              warnings: [],
              sortOrder: 0,
            },
          ],
          steps: [
            {
              id: 'step-1',
              stepOrder: 1,
              instruction: 'Cook',
              durationMinutes: 10,
              temperature: null,
              stage: 'COOK',
              ingredientHint: null,
              confidence: 0.8,
              provenance: {},
              warnings: [],
            },
          ],
          source,
          createdAt: '2026-08-31T00:00:00.000Z',
          updatedAt: '2026-08-31T01:00:00.000Z',
        },
      }),
    );
    const restored = await restoreRecipeRevision('recipe-1', 'revision-0', 1);
    expect(restored.revisionNumber).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/recipes/recipe-1/revisions/revision-0/restore'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevisionNumber: 1 }),
      }),
    );
  });

  it('preserves stable category slugs from the profile API', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'cat-breakfast',
            slug: 'breakfast',
            name: 'Morning',
            sortOrder: 0,
            recipeCount: 1,
            isDefault: true,
          },
        ],
        meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
      }),
    );
    await expect(listCategories()).resolves.toEqual([
      expect.objectContaining({
        slug: 'breakfast',
        name: 'Morning',
        isDefault: true,
      }),
    ]);
  });
});

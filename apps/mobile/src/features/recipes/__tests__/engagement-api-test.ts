import { putRecipeFavorite, putRecipeRating } from '@/features/recipes/api';
import { recipeKeys } from '@/features/recipes/hooks/use-recipes';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('engagement API helpers', () => {
  afterEach(() => jest.restoreAllMocks());

  test('favorite PUT is idempotent at the client path', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            id: 'recipe-1',
            userRecipeId: 'ur-1',
            isFavorite: true,
            rating: null,
            ratingAverage: null,
            ratingCount: 0,
            cookCount: 0,
            updatedAt: '2026-08-31T00:00:00.000Z',
          },
        }),
      ),
    );

    await putRecipeFavorite('recipe-1');
    await putRecipeFavorite('recipe-1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      '/recipes/recipe-1/favorite',
    );
    expect((fetchSpy.mock.calls[0]?.[1] as { method?: string }).method).toBe(
      'PUT',
    );
  });

  test('rating helper rejects out-of-range values via the server contract', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } },
          400,
        ),
      );
    await expect(putRecipeRating('recipe-1', 6)).rejects.toThrow();
  });

  test('recipe query keys stay stable for home sorts', () => {
    expect(recipeKeys.list(1, 8, { sort: 'latest' })).toEqual([
      'recipes',
      1,
      8,
      { sort: 'latest' },
    ]);
    expect(recipeKeys.list(1, 12, { sort: 'engagement' })).toEqual([
      'recipes',
      1,
      12,
      { sort: 'engagement' },
    ]);
    expect(recipeKeys.notes('recipe-1')).toEqual([
      'recipes',
      'detail',
      'recipe-1',
      'notes',
    ]);
  });
});

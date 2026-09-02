import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useRecipeFavorite } from '@/features/recipes/hooks/use-engagement';
import type { RecipeView } from '@/features/recipes/types';
import { renderWithProviders } from '@/test/render-with-providers';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const recipe: RecipeView = {
  id: '11111111-1111-4111-8111-111111111111',
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
  rating: null,
  cookCount: 0,
};

function Heart() {
  const [current, setCurrent] = useState(recipe);
  const favorite = useRecipeFavorite(current);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          favorite.isFavorite ? 'Remove from saved' : 'Save recipe'
        }
        onPress={() => {
          favorite.toggle();
          setCurrent((value) => ({ ...value, isFavorite: !value.isFavorite }));
        }}
      >
        <Text>{favorite.isFavorite ? '♥' : '♡'}</Text>
      </Pressable>
    </View>
  );
}

describe('useRecipeFavorite', () => {
  afterEach(() => jest.restoreAllMocks());

  test('duplicate taps while a request is in flight do not send a second write', async () => {
    let resolveFavorite: ((value: Response) => void) | undefined;
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFavorite = resolve;
        }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<Heart />);

    await user.press(screen.getByLabelText('Save recipe'));
    await user.press(screen.getByLabelText('Remove from saved'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    resolveFavorite?.(
      jsonResponse({
        data: {
          id: recipe.id,
          userRecipeId: 'ur-1',
          isFavorite: true,
          rating: null,
          ratingAverage: null,
          ratingCount: 0,
          cookCount: 0,
          updatedAt: '2026-08-31T00:00:00.000Z',
        },
      }),
    );
  });
});

import { screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RecipeCard } from '@/features/home/recipe-card';
import type { RecipeView } from '@/features/recipes/types';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const recipe: RecipeView = {
  id: '11111111-1111-4111-8111-111111111111',
  origin: 'api',
  title: 'Charred Broccoli Soup',
  description: null,
  sourceType: 'INSTAGRAM',
  sourceLabel: 'Instagram',
  creator: '@test.cooks',
  originalUrl: null,
  thumbnailUrl: null,
  placeholder: ['#E6D9C4', '#DCCBB0'],
  minutes: 30,
  difficulty: 'Easy',
  servings: 4,
  cuisine: 'Imported',
  calories: null,
  confidence: 0.9,
  warnings: [],
  ingredients: [],
  steps: [],
  categories: [
    { id: 'cat-dinner', slug: 'dinner', name: 'Dinner', sortOrder: 0 },
  ],
  isFavorite: false,
  rating: 4,
  cookCount: 3,
};

describe('RecipeCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows category chips, stars, cook count, and a 44px favorite target', async () => {
    await renderWithProviders(
      <RecipeCard recipe={recipe} showEngagement width={168} />,
    );

    expect(screen.getByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText('Dinner')).toBeOnTheScreen();
    expect(screen.getByText(/4.*cooked 3 times|3× cooked/)).toBeOnTheScreen();
    const heart = screen.getByTestId(`recipe-favorite-${recipe.id}`);
    expect(heart).toHaveStyle({ height: 44, width: 44 });
    expect(screen.getByLabelText(/4 stars/)).toBeOnTheScreen();
  });

  test('favorite tap does not open the recipe', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({
        data: {
          id: recipe.id,
          userRecipeId: 'ur-1',
          isFavorite: true,
          rating: 4,
          ratingAverage: 4,
          ratingCount: 1,
          cookCount: 3,
          updatedAt: '2026-08-31T00:00:00.000Z',
        },
      }),
    );
    const user = userEvent.setup();
    await renderWithProviders(
      <RecipeCard recipe={recipe} showEngagement width={168} />,
    );

    await user.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(router.push).not.toHaveBeenCalled();
  });
});

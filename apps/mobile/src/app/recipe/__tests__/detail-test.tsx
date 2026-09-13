import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import RecipeDetailScreen from '@/app/recipe/[id]';
import {
  RECIPE_DETAIL_MAX_UNIQUE_GETS,
  isFanOutDetailRequest,
  uniqueRecipeDetailGets,
} from '@/features/recipes/detail-request-budget';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

const recipeId = '11111111-1111-4111-8111-111111111111';
const params = jest.mocked(useLocalSearchParams);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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

function ingredient(
  index: number,
  name: string,
  canonicalName: string,
): Record<string, unknown> {
  return {
    id: `ing-${index}`,
    name,
    canonicalName,
    quantity: '1',
    unit: null,
    preparation: null,
    optional: false,
    emoji: '🥣',
    colorToken: 'peach',
    category: 'Pantry',
    confidence: 0.9,
    provenance: {},
    warnings: [],
    sortOrder: index,
  };
}

function recipeDto(overrides: Record<string, unknown> = {}) {
  return {
    id: recipeId,
    title: 'Charred Broccoli Soup',
    description: null,
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    calories: null,
    cuisine: 'Italian',
    difficulty: 'Easy',
    minutes: 30,
    nutrition: null,
    sourceLanguage: 'en',
    confidence: 0.9,
    warnings: [],
    promptVersion: 'v8',
    userRecipeId: 'ur-1',
    revisionId: 'rev-1',
    revisionNumber: 1,
    revisionSource: 'IMPORT',
    reviewState: 'READY',
    categories: [
      { id: 'cat-dinner', slug: 'dinner', name: 'Dinner', sortOrder: 0 },
    ],
    isFavorite: false,
    rating: null,
    ratingAverage: null,
    ratingCount: 0,
    cookCount: 2,
    nutritionStatus: 'COMPLETED',
    ingredients: [
      ingredient(0, 'Olive oil', 'olive oil'),
      ingredient(1, 'Broccoli', 'broccoli'),
      ingredient(2, 'Garlic cloves', 'garlic cloves'),
    ],
    steps: [
      {
        id: 'step-1',
        stepOrder: 1,
        instruction: 'Char the broccoli.',
        durationMinutes: 10,
        temperature: null,
        stage: 'COOK',
        ingredientHint: null,
        confidence: 0.9,
        provenance: {},
        warnings: [],
      },
    ],
    source,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  };
}

function pantryItem(id: string, name: string, canonicalName: string) {
  return {
    id,
    name,
    canonicalName,
    rawText: name,
    locale: 'en',
    promptVersion: 'v1',
    quantity: null,
    unit: null,
    category: 'Pantry',
    emoji: '🥣',
    colorToken: 'peach',
    storageLocation: 'PANTRY',
    expiresAt: null,
    classification: { status: 'CLASSIFIED', canonicalName },
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  };
}

function nutritionDto() {
  return {
    recipeId,
    revisionId: 'rev-1',
    snapshotId: 'snap-1',
    status: 'READY',
    calculationStatus: 'COMPLETED',
    updating: false,
    provider: 'usda-fdc',
    calculatedAt: '2026-08-31T12:00:00.000Z',
    servings: 4,
    coverage: { matched: 3, total: 3, percent: 100 },
    unmatchedIngredients: [],
    totals: {
      calories: 400,
      proteinGrams: 12,
      carbohydrateGrams: 40,
      fatGrams: 18,
    },
    perPortion: {
      calories: 100,
      proteinGrams: 3,
      carbohydrateGrams: 10,
      fatGrams: 4.5,
    },
    per100g: {
      calories: 50,
      proteinGrams: 1.5,
      carbohydrateGrams: 5,
      fatGrams: 2,
    },
    matches: [],
    failureReason: null,
  };
}

function mockDetailFetch(options?: {
  nutritionError?: boolean;
  notesError?: boolean;
  extraIngredients?: number;
  favorite?: boolean;
  rating?: number | null;
  cookCount?: number;
}) {
  const extras = Array.from(
    { length: options?.extraIngredients ?? 0 },
    (_, index) => ingredient(index + 3, `Spice ${index}`, `spice ${index}`),
  );
  let favorite = options?.favorite ?? false;
  let rating = options?.rating ?? null;
  const cookCount = options?.cookCount ?? 2;
  const baseIngredients = [
    ...(recipeDto().ingredients as unknown[]),
    ...extras,
  ];

  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/shopping-list/from-recipe') && method === 'POST') {
        return jsonResponse({ data: [] }, 201);
      }
      if (url.includes('/pantry') && method === 'GET') {
        return jsonResponse({
          data: [pantryItem('p-1', 'Olive oil', 'olive oil')],
          meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        });
      }
      if (url.includes('/nutrition') && method === 'GET') {
        if (options?.nutritionError) {
          return jsonResponse(
            { error: { code: 'INTERNAL', message: 'down' } },
            500,
          );
        }
        return jsonResponse({ data: nutritionDto() });
      }
      if (url.includes('/notes') && method === 'GET') {
        if (options?.notesError) {
          return jsonResponse(
            { error: { code: 'INTERNAL', message: 'down' } },
            500,
          );
        }
        return jsonResponse({
          data: [
            {
              id: 'note-1',
              recipeId,
              body: 'A little more lemon.',
              cookSessionId: null,
              createdAt: '2026-08-31T00:00:00.000Z',
              updatedAt: '2026-08-31T00:00:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
        });
      }
      if (url.includes('/favorite') && method === 'PUT') {
        favorite = true;
        return jsonResponse({
          data: {
            id: recipeId,
            userRecipeId: 'ur-1',
            isFavorite: true,
            rating,
            ratingAverage: rating,
            ratingCount: rating ? 1 : 0,
            cookCount,
            updatedAt: '2026-08-31T00:00:00.000Z',
          },
        });
      }
      if (url.includes('/rating') && method === 'PUT') {
        rating = 4;
        return jsonResponse({
          data: {
            id: recipeId,
            userRecipeId: 'ur-1',
            isFavorite: favorite,
            rating: 4,
            ratingAverage: 4,
            ratingCount: 1,
            cookCount,
            updatedAt: '2026-08-31T00:00:00.000Z',
          },
        });
      }
      if (url.includes(`/recipes/${recipeId}`) && method === 'GET') {
        return jsonResponse({
          data: recipeDto({
            isFavorite: favorite,
            rating,
            cookCount,
            ingredients: baseIngredients,
          }),
        });
      }
      return jsonResponse({ data: [] });
    });
}

describe('RecipeDetailScreen', () => {
  beforeEach(async () => {
    params.mockReturnValue({ id: recipeId });
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps identity, start cooking, pantry, nutrition, collections', async () => {
    mockDetailFetch();
    await renderWithProviders(<RecipeDetailScreen />);

    expect(await screen.findByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText('Dinner')).toBeOnTheScreen();
    expect(screen.queryByText(/cooked/i)).toBeNull();
    expect(screen.queryByText('YOUR RATING')).toBeNull();
    expect(screen.queryByText('NOTES')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Start cooking' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('4 servings')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Decrease servings' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Increase servings' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/YOU HAVE/)).toBeNull();
    expect(screen.queryByText(/TO BUY/)).toBeNull();
    expect(screen.getByText('Olive oil')).toBeOnTheScreen();
    expect(screen.getByText('NUTRITION')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add to cookbooks' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();

    const json = JSON.stringify(screen.toJSON());
    const cookbooks = json.indexOf('Add to cookbooks');
    const nutrition = json.indexOf('NUTRITION');
    const start = json.indexOf('Start cooking');
    const decreaseServings = json.indexOf('Decrease servings');
    expect(cookbooks).toBeGreaterThan(-1);
    expect(nutrition).toBeGreaterThan(cookbooks);
    expect(start).toBeGreaterThan(nutrition);
    expect(decreaseServings).toBeGreaterThan(nutrition);
  });

  test('nutrition failure still leaves the recipe and start cooking visible', async () => {
    mockDetailFetch({ nutritionError: true });
    await renderWithProviders(<RecipeDetailScreen />);

    expect(await screen.findByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Start cooking' }),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText(/couldn’t load nutrition/i),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Retry nutrition' }),
    ).toBeOnTheScreen();
  });

  test('favorite updates optimistically', async () => {
    mockDetailFetch();
    const user = userEvent.setup();
    await renderWithProviders(<RecipeDetailScreen />);

    await screen.findByText('Charred Broccoli Soup');
    await user.press(screen.getByRole('button', { name: 'Pin recipe' }));
    expect(
      await screen.findByRole('button', { name: 'Unpin recipe' }),
    ).toBeOnTheScreen();
  });

  test('nutrition modes stay on the recipe page', async () => {
    mockDetailFetch();
    const user = userEvent.setup();
    await renderWithProviders(<RecipeDetailScreen />);

    expect(await screen.findByText('100')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Per 100g' }));
    expect(screen.getByText('50')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Start cooking' }),
    ).toBeOnTheScreen();
  });

  test('exposes 44px favorite and start-cooking targets', async () => {
    mockDetailFetch();
    await renderWithProviders(<RecipeDetailScreen />);
    await screen.findByText('Charred Broccoli Soup');
    expect(screen.getByRole('button', { name: 'Pin recipe' })).toHaveStyle({
      minHeight: 44,
    });
    expect(
      screen.getByRole('button', { name: 'Start cooking' }),
    ).toBeOnTheScreen();
  });

  test('does not fan out unbounded requests as ingredients grow', async () => {
    const fetchSpy = mockDetailFetch({ extraIngredients: 12 });
    await renderWithProviders(<RecipeDetailScreen />);
    await screen.findByText('Charred Broccoli Soup');
    await screen.findByText('NUTRITION');

    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(urls.some(isFanOutDetailRequest)).toBe(false);
    expect(uniqueRecipeDetailGets(urls).length).toBeLessThanOrEqual(
      RECIPE_DETAIL_MAX_UNIQUE_GETS,
    );
    const recipeGets = urls.filter(
      (url) =>
        url.includes(`/recipes/${recipeId}`) &&
        !url.includes('/nutrition') &&
        !url.includes('/notes') &&
        !url.includes('/favorite') &&
        !url.includes('/rating'),
    );
    expect(recipeGets.length).toBeGreaterThan(0);
    expect(recipeGets.length).toBeLessThan(4);
  });
});

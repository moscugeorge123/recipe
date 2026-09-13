import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import DiscoverScreen from '@/app/(tabs)/discover';
import ExploreScreen from '@/app/(tabs)/explore';
import GroceriesScreen from '@/app/(tabs)/groceries';
import RecipesScreen from '@/app/(tabs)/index';
import KitchenScreen from '@/app/(tabs)/kitchen';
import YouScreen from '@/app/(tabs)/you';
import ReviewScreen from '@/app/import/review/[id]';
import PantryScreen from '@/app/pantry';
import ShopScreen from '@/app/shop';
import RecipeHistoryScreen from '@/app/recipe/[id]/history';
import { NutritionPanelView } from '@/features/nutrition/nutrition-panel';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    router: {
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
    },
    useLocalSearchParams: jest.fn(),
    Redirect: ({ href }: { href: string }) => <Text>{`Redirect ${href}`}</Text>,
  };
});

const params = jest.mocked(useLocalSearchParams);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const emptyList = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
};

describe('platform journeys', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    usePreferencesStore.getState().reset();
    usePreferencesStore.getState().completeOnboarding();
    useKitchenStore.setState({
      inboxStatus: {},
      savedIds: [],
      wantIds: [],
      cookedCounts: {},
      recipeNotes: {},
      collections: [],
      pantryStaples: [],
      pendingSync: [],
      kitchenMigration: null,
    });
    params.mockReturnValue({ id: '11111111-1111-4111-8111-111111111111' });
  });

  test('import review shows a retryable load error without losing the shell', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await renderWithProviders(<ReviewScreen />);

    expect(
      await screen.findByText('Review', {}, { timeout: 4000 }),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText(
        /couldn’t load this recipe/i,
        {},
        { timeout: 4000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test('revision history retry stays on the history screen', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await renderWithProviders(<RecipeHistoryScreen />);

    expect(await screen.findByText('Revision history')).toBeOnTheScreen();
    expect(
      await screen.findByText(/could not load history/i),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
    expect(
      screen.getByText(/Restoring never deletes newer versions/),
    ).toBeOnTheScreen();
  });

  test('kitchen redirects to Recipes', async () => {
    await renderWithProviders(<KitchenScreen />);
    expect(screen.getByText('Redirect /')).toBeOnTheScreen();
  });

  test('explore redirects to Discover', async () => {
    await renderWithProviders(<ExploreScreen />);
    expect(screen.getByText('Redirect /discover')).toBeOnTheScreen();
  });

  test('discover is an empty placeholder', async () => {
    await renderWithProviders(<DiscoverScreen />);
    expect(screen.getByRole('header', { name: 'Discover' })).toBeOnTheScreen();
    expect(screen.getByText('Nothing here yet.')).toBeOnTheScreen();
  });

  test('you redirects to Profile', async () => {
    await renderWithProviders(<YouScreen />);
    expect(screen.getByText('Redirect /profile')).toBeOnTheScreen();
  });

  test('pantry redirects to Groceries', async () => {
    await renderWithProviders(<PantryScreen />);
    expect(screen.getByText('Redirect /groceries')).toBeOnTheScreen();
  });

  test('shop redirects to Groceries', async () => {
    await renderWithProviders(<ShopScreen />);
    expect(screen.getByText('Redirect /groceries')).toBeOnTheScreen();
  });

  test('recipes tab shows the orange wordmark instead of Home feed sections', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(emptyList));
    await renderWithProviders(<RecipesScreen />);
    expect(
      await screen.findByRole('header', { name: 'Recipe' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('LAST UPLOADED')).toBeNull();
    expect(screen.queryByText('MY RECIPES')).toBeNull();
  });

  test('nutrition toggle stays on the panel without dropping macros', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={{
          recipeId: '11111111-1111-4111-8111-111111111111',
          revisionId: 'revision-1',
          snapshotId: 'snapshot-1',
          status: 'READY',
          calculationStatus: 'COMPLETED',
          updating: false,
          provider: 'usda-fdc',
          calculatedAt: '2026-08-31T12:00:00.000Z',
          servings: 2,
          coverage: { matched: 1, total: 1, percent: 100 },
          unmatchedIngredients: [],
          totals: {
            calories: 200,
            proteinGrams: 8,
            carbohydrateGrams: 20,
            fatGrams: 10,
          },
          perPortion: {
            calories: 100,
            proteinGrams: 4,
            carbohydrateGrams: 10,
            fatGrams: 5,
            saturatedFatGrams: 1,
            fiberGrams: 2,
            sugarGrams: 3,
            sodiumMilligrams: 80,
          },
          per100g: {
            calories: 50,
            proteinGrams: 2,
            carbohydrateGrams: 5,
            fatGrams: 2.5,
            saturatedFatGrams: 0.5,
            fiberGrams: 1,
            sugarGrams: 1.5,
            sodiumMilligrams: 40,
          },
          matches: [],
          failureReason: null,
        }}
        isLoading={false}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('100')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Per 100g' }));
    expect(screen.getByText('50')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Per portion' }),
    ).toBeOnTheScreen();
  });

  test('groceries pantry organize keeps typed text, previews, and saves', async () => {
    let saved = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/pantry/organize') && method === 'POST') {
        return jsonResponse({
          data: {
            items: [
              {
                rawText: 'olive oil',
                name: 'Olive oil',
                canonicalName: 'olive oil',
                category: 'Pantry',
                emoji: '🫒',
                colorToken: 'peach',
                quantity: null,
                unit: null,
                confidence: 0.95,
                source: 'dictionary',
                status: 'CLASSIFIED',
                locale: 'en',
                promptVersion: 'ingredient-enrichment-v1',
              },
            ],
            unresolved: [],
            meta: {
              promptVersion: 'ingredient-enrichment-v1',
              cacheHits: 0,
              dictionaryHits: 1,
              aiItemCount: 0,
              modelsUsed: [],
              escalatedCount: 0,
              fallbackCount: 0,
              truncated: false,
              aiAvailable: false,
            },
          },
        });
      }
      if (url.includes('/pantry/items') && method === 'POST') {
        saved = true;
        return jsonResponse(
          {
            data: [
              {
                id: 'p-1',
                name: 'Olive oil',
                canonicalName: 'olive oil',
                rawText: 'olive oil',
                locale: 'en',
                promptVersion: 'ingredient-enrichment-v1',
                quantity: null,
                unit: null,
                category: 'Pantry',
                emoji: '🫒',
                colorToken: 'peach',
                storageLocation: 'PANTRY',
                expiresAt: null,
                classification: {
                  status: 'CLASSIFIED',
                  source: 'dictionary',
                },
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
              },
            ],
          },
          201,
        );
      }
      if (url.includes('/pantry') && method === 'GET') {
        return jsonResponse({
          data: saved
            ? [
                {
                  id: 'p-1',
                  name: 'Olive oil',
                  canonicalName: 'olive oil',
                  rawText: 'olive oil',
                  locale: 'en',
                  promptVersion: 'ingredient-enrichment-v1',
                  quantity: null,
                  unit: null,
                  category: 'Pantry',
                  emoji: '🫒',
                  colorToken: 'peach',
                  storageLocation: 'PANTRY',
                  expiresAt: null,
                  classification: {
                    status: 'CLASSIFIED',
                    source: 'dictionary',
                  },
                  createdAt: '2026-09-01T00:00:00.000Z',
                  updatedAt: '2026-09-01T00:00:00.000Z',
                },
              ]
            : [],
          meta: {
            page: 1,
            pageSize: 100,
            total: saved ? 1 : 0,
            totalPages: saved ? 1 : 0,
          },
        });
      }
      if (url.includes('/shopping-list') && method === 'GET') {
        return jsonResponse({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        });
      }
      return jsonResponse(emptyList);
    });

    const user = userEvent.setup();
    await renderWithProviders(<GroceriesScreen />);

    expect(
      await screen.findByRole('header', { name: 'Grocery List' }),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Pantry' }));
    await user.press(screen.getByRole('button', { name: 'Add to pantry' }));
    expect(
      screen.getByText(/Nothing saved yet. Organize a list and accept it./),
    ).toBeOnTheScreen();

    await act(async () => {
      await Promise.resolve();
    });

    await user.type(screen.getByLabelText('Pantry ingredients'), 'olive oil');
    expect(screen.getByLabelText('Pantry ingredients').props.value).toBe(
      'olive oil',
    );

    await user.press(screen.getByRole('button', { name: 'Organize' }));
    expect(await screen.findByText('PREVIEW')).toBeOnTheScreen();
    expect(screen.getByText('Olive oil')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pantry ingredients').props.value).toBe(
      'olive oil',
    );

    await user.press(screen.getByRole('button', { name: 'Accept and save' }));
    await waitFor(() => {
      expect(screen.getByText('IN YOUR PANTRY')).toBeOnTheScreen();
    });
    expect(await screen.findAllByText('Olive oil')).not.toHaveLength(0);
  });
});

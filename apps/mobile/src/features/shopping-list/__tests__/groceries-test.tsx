import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import GroceriesScreen from '@/app/(tabs)/groceries';
import { renderWithProviders } from '@/test/render-with-providers';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const lemon = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lemon',
  canonicalName: 'lemon',
  quantity: 2,
  unit: null,
  category: 'Produce',
  emoji: '🍋',
  done: false,
  fromRecipeCount: 1,
  source: 'MANUAL',
  sourceRecipeId: null,
  sourceMealPlanEntryId: null,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const emptyMeta = { page: 1, pageSize: 100, total: 0, totalPages: 0 };

describe('GroceriesScreen shopping list', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    useMealPlanWeekStore.getState().reset();
    useMealPlanWeekStore.getState().setWeekStart('2026-09-07');
    jest.spyOn(Share, 'share').mockResolvedValue({
      action: 'sharedAction',
    } as never);
  });

  test('groups aisles with ReciMe labels and patches done on the circle', async () => {
    let done = false;
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/shopping-list/items/') && method === 'PATCH') {
          done = true;
          return jsonResponse({ data: { ...lemon, done: true } });
        }
        if (url.includes('/shopping-list') && method === 'GET') {
          return jsonResponse({
            data: [{ ...lemon, done }],
            meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          });
        }
        if (url.includes('/pantry') && method === 'GET') {
          return jsonResponse({ data: [], meta: emptyMeta });
        }
        return jsonResponse({ data: [], meta: emptyMeta });
      });

    const user = userEvent.setup();
    await renderWithProviders(<GroceriesScreen />);

    expect(
      await screen.findByRole('header', { name: 'Grocery List' }),
    ).toBeOnTheScreen();
    expect(await screen.findByText('FRESH PRODUCE')).toBeOnTheScreen();
    expect(screen.getByText('Lemon')).toBeOnTheScreen();
    expect(screen.queryByText('Onions')).toBeNull();
    expect(screen.queryByText('Cumin seeds')).toBeNull();

    await user.press(screen.getByRole('checkbox', { name: 'Check Lemon' }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([input, init]) =>
            String(input).includes('/shopping-list/items/') &&
            (init?.method ?? 'GET').toUpperCase() === 'PATCH',
        ),
      ).toBe(true);
    });
  });

  test('share and clear purchased call the API', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/shopping-list/clear-done') && method === 'POST') {
          return jsonResponse({ data: { deleted: true, count: 1 } });
        }
        if (url.includes('/shopping-list') && method === 'GET') {
          return jsonResponse({
            data: [{ ...lemon, done: true }],
            meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          });
        }
        return jsonResponse({ data: [], meta: emptyMeta });
      });

    const user = userEvent.setup();
    await renderWithProviders(<GroceriesScreen />);
    await screen.findByText('Lemon');

    await user.press(screen.getByRole('button', { name: 'Share list' }));
    expect(Share.share).toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'More' }));
    await user.press(screen.getByRole('button', { name: 'Clear purchased' }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([input]) =>
          String(input).includes('/shopping-list/clear-done'),
        ),
      ).toBe(true);
    });
  });

  test('hides meal-plan groceries from other weeks', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/meal-plan')) {
        return jsonResponse({
          data: [
            {
              id: 'entry-in',
              date: '2026-09-09',
              slot: 'DINNER',
              kind: 'RECIPE',
              recipeId: 'recipe-1',
              note: null,
              sortOrder: 0,
              createdAt: '2026-09-12T00:00:00.000Z',
              updatedAt: '2026-09-12T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/shopping-list')) {
        return jsonResponse({
          data: [
            lemon,
            {
              ...lemon,
              id: '22222222-2222-4222-8222-222222222222',
              name: 'This-week garlic',
              source: 'MEAL_PLAN',
              sourceMealPlanEntryId: 'entry-in',
            },
            {
              ...lemon,
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Next-week lime',
              source: 'MEAL_PLAN',
              sourceMealPlanEntryId: 'entry-out',
            },
            {
              ...lemon,
              id: '44444444-4444-4444-8444-444444444444',
              name: 'Recipe flour',
              source: 'RECIPE',
              sourceRecipeId: 'recipe-1',
            },
          ],
          meta: { page: 1, pageSize: 100, total: 4, totalPages: 1 },
        });
      }
      return jsonResponse({ data: [], meta: emptyMeta });
    });

    await renderWithProviders(<GroceriesScreen />);
    expect(await screen.findByText('This-week garlic')).toBeOnTheScreen();
    expect(screen.getByText('Lemon')).toBeOnTheScreen();
    expect(screen.getByText('Recipe flour')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByText('Next-week lime')).toBeNull();
    });
  });
});

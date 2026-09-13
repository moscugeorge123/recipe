import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import AddGroceriesScreen from '@/app/groceries/add';
import { renderWithProviders } from '@/test/render-with-providers';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
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

describe('AddGroceriesScreen', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    mockBack.mockReset();
    await AsyncStorage.clear();
  });

  test('organizes typed text into emoji chips then posts shopping items', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/pantry/organize') && method === 'POST') {
          return jsonResponse({
            data: {
              items: [
                {
                  rawText: 'lemon',
                  name: 'Lemon',
                  canonicalName: 'lemon',
                  category: 'Produce',
                  emoji: '🍋',
                  colorToken: 'peach',
                  quantity: 1,
                  unit: null,
                  confidence: 0.9,
                  source: 'dictionary',
                  status: 'CLASSIFIED',
                  locale: 'en',
                  promptVersion: 'v1',
                },
              ],
              unresolved: [],
              meta: {
                promptVersion: 'v1',
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
        if (url.includes('/shopping-list/items') && method === 'POST') {
          return jsonResponse(
            {
              data: [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  name: 'Lemon',
                  canonicalName: 'lemon',
                  quantity: 1,
                  unit: null,
                  category: 'Produce',
                  emoji: '🍋',
                  done: false,
                  fromRecipeCount: 0,
                  source: 'MANUAL',
                  sourceRecipeId: null,
                  sourceMealPlanEntryId: null,
                  createdAt: '2026-09-12T00:00:00.000Z',
                  updatedAt: '2026-09-12T00:00:00.000Z',
                },
              ],
            },
            201,
          );
        }
        return jsonResponse({ data: [] });
      });

    const user = userEvent.setup();
    await renderWithProviders(<AddGroceriesScreen />);

    await act(() =>
      fireEvent.changeText(screen.getByLabelText('Type or paste'), 'lemon'),
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Lemon')).toBeOnTheScreen();
    expect(screen.getByText('🍋')).toBeOnTheScreen();
    await waitFor(() => {
      const posted = fetchSpy.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/shopping-list/items') &&
          (init?.method ?? '').toUpperCase() === 'POST' &&
          !String(input).includes('/pantry/items'),
      );
      expect(posted).toBe(true);
    });
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).includes('/pantry/items'),
      ),
    ).toBe(false);

    await user.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { AddMealScreen } from '@/features/meal-plan/add-meal';
import { renderWithProviders } from '@/test/render-with-providers';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

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

const recipeId = '11111111-1111-4111-8111-111111111111';

function mealEntry(kind: 'NOTE' | 'RECIPE') {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    date: '2026-09-09',
    slot: 'DINNER',
    kind,
    recipeId: kind === 'RECIPE' ? recipeId : null,
    note: kind === 'NOTE' ? 'Leftovers' : null,
    sortOrder: 0,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  };
}

describe('AddMealScreen', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    mockBack.mockReset();
    await AsyncStorage.clear();
    params.mockReturnValue({
      date: '2026-09-09',
      slot: 'DINNER',
    });
  });

  test('note submit posts a NOTE entry and does not call shopping add', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/meal-plan/entries') && method === 'POST') {
          return jsonResponse({ data: mealEntry('NOTE') }, 201);
        }
        return jsonResponse(emptyList);
      });

    const user = userEvent.setup();
    await renderWithProviders(<AddMealScreen />);
    await user.press(screen.getByRole('tab', { name: 'Add note' }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();

    await act(() =>
      fireEvent.changeText(screen.getByLabelText('Note'), 'Leftovers'),
    );
    await user.press(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      const posted = fetchSpy.mock.calls.find(
        ([input, init]) =>
          String(input).includes('/meal-plan/entries') &&
          (init?.method ?? '').toUpperCase() === 'POST',
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(String(posted?.[1]?.body ?? '{}')) as {
        kind?: string;
        note?: string;
      };
      expect(body.kind).toBe('NOTE');
      expect(body.note).toBe('Leftovers');
    });
    expect(
      fetchSpy.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/shopping-list') &&
          (init?.method ?? 'GET').toUpperCase() !== 'GET',
      ),
    ).toBe(false);
    expect(mockBack).toHaveBeenCalled();
  });

  test('recipe submit posts a RECIPE entry so shopping items come from meal plan', async () => {
    params.mockReturnValue({
      date: '2026-09-09',
      slot: 'DINNER',
      recipeId,
    });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/meal-plan/entries') && method === 'POST') {
          return jsonResponse({ data: mealEntry('RECIPE') }, 201);
        }
        return jsonResponse(emptyList);
      });

    const user = userEvent.setup();
    await renderWithProviders(<AddMealScreen />);
    await user.press(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      const posted = fetchSpy.mock.calls.find(
        ([input, init]) =>
          String(input).includes('/meal-plan/entries') &&
          (init?.method ?? '').toUpperCase() === 'POST',
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(String(posted?.[1]?.body ?? '{}')) as {
        kind?: string;
        recipeId?: string;
      };
      expect(body.kind).toBe('RECIPE');
      expect(body.recipeId).toBe(recipeId);
    });
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).includes('/shopping-list/from-recipe'),
      ),
    ).toBe(false);
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).includes('/pantry/items'),
      ),
    ).toBe(false);
    expect(
      fetchSpy.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/shopping-list') &&
          (init?.method ?? 'GET').toUpperCase() !== 'GET',
      ),
    ).toBe(false);
    expect(mockBack).toHaveBeenCalled();
  });
});

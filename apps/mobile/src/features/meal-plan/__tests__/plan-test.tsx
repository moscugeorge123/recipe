import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import MealPlanScreen from '@/app/(tabs)/plan';
import { renderWithProviders } from '@/test/render-with-providers';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/features/catalog/use-catalog', () => ({
  useCatalog: () => ({
    get: (id: string) =>
      id === '11111111-1111-4111-8111-111111111111'
        ? { title: 'Charred Broccoli Soup' }
        : undefined,
    collections: [],
  }),
}));

const params = jest.mocked(useLocalSearchParams);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MealPlanScreen', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    mockPush.mockReset();
    await AsyncStorage.clear();
    useMealPlanWeekStore.getState().reset();
    useMealPlanWeekStore.getState().setWeekStart('2026-09-07');
    params.mockReturnValue({});
  });

  test('empty week shows Let’s plan your week', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ data: [] }));
    await renderWithProviders(<MealPlanScreen />);
    expect(await screen.findByText('Let’s plan your week')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Previous week' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeOnTheScreen();
  });

  test('day plus opens the slot popover then the add screen', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ data: [] }));
    const user = userEvent.setup();
    await renderWithProviders(<MealPlanScreen />);
    await screen.findByText('Let’s plan your week');
    await user.press(screen.getByRole('button', { name: 'Add to Wed' }));
    await user.press(screen.getByRole('menuitem', { name: 'Dinner' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/plan/add',
      params: { date: '2026-09-09', slot: 'DINNER' },
    });
  });
});

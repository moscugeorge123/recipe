import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import RecipesScreen from '@/app/(tabs)/index';
import { MiseTabBar } from '@/components/nav/tab-bar';
import { useCookStore } from '@/stores/cook-store';
import { useKitchenStore } from '@/stores/kitchen-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { renderWithProviders } from '@/test/render-with-providers';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const emptyListBody = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
};

function mockOkLists() {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => mockJsonResponse(emptyListBody));
}

describe('RecipesScreen', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.removeItem('mise.kitchen.migration.v1');
    await AsyncStorage.removeItem('mise.kitchen.v1');
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
    usePreferencesStore.getState().reset();
    usePreferencesStore.getState().completeOnboarding();
    useCookStore.getState().exit();
    useCookStore.setState({ terminalStatus: null });
    useUiStore.getState().closeCapture();
  });

  test('renders the Recipe wordmark and profile, without Home feed sections', async () => {
    mockOkLists();

    await renderWithProviders(<RecipesScreen />);

    expect(
      await screen.findByRole('header', { name: 'Recipe' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeOnTheScreen();
    expect(screen.queryByText(/Sam\./)).toBeNull();
    expect(screen.queryByText(/RECIPE INBOX/)).toBeNull();
    expect(screen.queryByText('TONIGHT')).toBeNull();
    expect(screen.queryByText('FROM YOUR KITCHEN')).toBeNull();
    expect(screen.queryByText(/LAST UPLOADED/)).toBeNull();
    expect(screen.queryByText(/MY RECIPES/)).toBeNull();
  });

  test('opens profile from the header person button', async () => {
    mockOkLists();
    const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
    const user = userEvent.setup();

    await renderWithProviders(<RecipesScreen />);

    await user.press(await screen.findByRole('button', { name: 'Profile' }));

    expect(push).toHaveBeenCalledWith('/profile');
  });

  test('shows ReciMe tab labels', async () => {
    await renderWithProviders(<MiseTabBar />);

    expect(screen.getByRole('tab', { name: 'Recipes' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Meal Plan' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Groceries' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Discover' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Home' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Kitchen' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Explore' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'You' })).toBeNull();
  });

  test('shows resume and stop, and clears the session after confirming stop', async () => {
    mockOkLists();
    useCookStore.getState().start('seed:harissa');
    const user = userEvent.setup();

    await renderWithProviders(<RecipesScreen />);

    expect(await screen.findByText('COOKING NOW')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stop cooking?')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Stop cooking' }));

    expect(screen.queryByText('COOKING NOW')).toBeNull();
    expect(useCookStore.getState().recipeId).toBeNull();
  });

  test('shows an API cook session and hides it after stop marks it finished', async () => {
    const session = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recipeId: '11111111-1111-4111-8111-111111111111',
      status: 'IN_PROGRESS',
      currentStepIndex: 1,
      startedAt: '2026-08-30T12:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      totalDurationMs: 90_000,
      steps: [
        {
          stepIndex: 0,
          visitCount: 1,
          durationMs: 45_000,
          firstEnteredAt: '2026-08-30T12:00:00.000Z',
          lastEnteredAt: '2026-08-30T12:00:45.000Z',
        },
        {
          stepIndex: 1,
          visitCount: 1,
          durationMs: 45_000,
          firstEnteredAt: '2026-08-30T12:00:45.000Z',
          lastEnteredAt: '2026-08-30T12:01:30.000Z',
        },
      ],
      recipe: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Charred Broccoli Soup',
        stepCount: 4,
      },
    };
    let inProgress = true;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/cook-sessions') && method === 'PATCH') {
        inProgress = false;
        return mockJsonResponse({
          data: {
            ...session,
            status: 'STOPPED',
            finishedAt: '2026-08-30T12:30:00.000Z',
          },
        });
      }
      if (url.includes('/cook-sessions')) {
        return mockJsonResponse({
          data: inProgress ? [session] : [],
          meta: {
            page: 1,
            pageSize: 1,
            total: inProgress ? 1 : 0,
            totalPages: inProgress ? 1 : 0,
          },
        });
      }
      return mockJsonResponse(emptyListBody);
    });
    useCookStore.setState({
      recipeId: session.recipeId,
      sessionId: session.id,
      stepIndex: 1,
      startedAt: Date.parse(session.startedAt),
      timer: null,
    });
    const user = userEvent.setup();

    await renderWithProviders(<RecipesScreen />);

    expect(await screen.findByText('COOKING NOW')).toBeOnTheScreen();
    expect(screen.getByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText('Step 2 of 4')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stop cooking?')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Stop cooking' }));

    await waitFor(() => {
      expect(screen.queryByText('COOKING NOW')).toBeNull();
    });
    expect(useCookStore.getState().recipeId).toBeNull();
    expect(inProgress).toBe(false);
  });

  test('hides COOKING NOW after the cook is marked completed', async () => {
    mockOkLists();
    useCookStore.getState().start('seed:harissa');
    useCookStore.getState().setTerminalStatus('COMPLETED');

    await renderWithProviders(<RecipesScreen />);

    expect(
      await screen.findByRole('header', { name: 'Recipe' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('COOKING NOW')).toBeNull();
  });
});

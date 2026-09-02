import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { writeCachedRecipeList } from '@/features/recipes/list-cache';
import type { RecipeListItemView } from '@/features/recipes/types';
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

function listItem(
  overrides: Partial<RecipeListItemView> &
    Pick<RecipeListItemView, 'id' | 'title'>,
): RecipeListItemView {
  return {
    description: null,
    confidence: 0.9,
    sourceLanguage: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    calories: null,
    cuisine: 'Italian',
    difficulty: 'Easy',
    minutes: 30,
    sourceType: 'INSTAGRAM',
    sourceLabel: 'Instagram',
    creator: '@test.cooks',
    originalUrl: null,
    thumbnailUrl: null,
    ingredientCount: 6,
    stepCount: 4,
    isFavorite: false,
    rating: null,
    cookCount: 0,
    reviewState: 'READY',
    ...overrides,
  };
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

describe('HomeScreen', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.removeItem('mise.home.recipes.v1.latest');
    await AsyncStorage.removeItem('mise.home.recipes.v1.engagement');
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

  test('renders the greeting and inbox without tonight or kitchen', async () => {
    mockOkLists();

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.queryByText(/RECIPE INBOX/)).toBeNull();
    expect(screen.queryByText('TONIGHT')).toBeNull();
    expect(screen.queryByText('FROM YOUR KITCHEN')).toBeNull();
    expect(screen.getByText(/LAST UPLOADED/)).toBeOnTheScreen();
    expect(screen.getByText(/MY RECIPES/)).toBeOnTheScreen();
    expect(
      await screen.findByRole('button', { name: 'Add your first recipe' }),
    ).toBeOnTheScreen();
  });

  test('opens capture from the empty latest-added section', async () => {
    mockOkLists();
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    await user.press(
      await screen.findByRole('button', { name: 'Add your first recipe' }),
    );

    expect(useUiStore.getState().captureOpen).toBe(true);
  });

  test('keeps the shell online-offline and does not invent seed inbox ownership', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.queryByText(/RECIPE INBOX/)).toBeNull();
    expect(screen.queryByText('TONIGHT')).toBeNull();
    expect(screen.queryByText('FROM YOUR KITCHEN')).toBeNull();
    expect(
      (
        await screen.findAllByText(
          /couldn’t load this section/i,
          {},
          { timeout: 4000 },
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Retry' }).length,
    ).toBeGreaterThan(0);
  });

  test('retries loading latest recipes', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    const retries = await screen.findAllByRole(
      'button',
      { name: 'Retry' },
      { timeout: 4000 },
    );
    const callsBeforeRetry = fetchSpy.mock.calls.length;
    await user.press(retries[0]!);

    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  test('renders last uploaded and my recipes from independent backend sorts', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/cook-sessions')) {
        return mockJsonResponse({
          data: [],
          meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
        });
      }
      if (url.includes('/pantry')) {
        return mockJsonResponse(emptyListBody);
      }
      if (url.includes('sort=engagement')) {
        return mockJsonResponse({
          data: [
            listItem({
              id: '22222222-2222-4222-8222-222222222222',
              title: 'Miso Butter Noodles',
              isFavorite: true,
              cookCount: 1,
              rating: 5,
              categories: [
                {
                  id: 'cat-dinner',
                  slug: 'dinner',
                  name: 'Dinner',
                  sortOrder: 0,
                },
              ],
            }),
            listItem({
              id: '11111111-1111-4111-8111-111111111111',
              title: 'Charred Broccoli Soup',
              cookCount: 4,
            }),
          ],
          meta: { page: 1, pageSize: 12, total: 2, totalPages: 1 },
        });
      }
      return mockJsonResponse({
        data: [
          listItem({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Charred Broccoli Soup',
            createdAt: '2026-08-30T12:00:00.000Z',
          }),
          listItem({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Miso Butter Noodles',
            createdAt: '2026-08-20T12:00:00.000Z',
          }),
          listItem({
            id: '33333333-3333-4333-8333-333333333333',
            title: 'Tomato Toast',
            createdAt: '2026-08-10T12:00:00.000Z',
          }),
        ],
        meta: { page: 1, pageSize: 8, total: 3, totalPages: 1 },
      });
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('LAST UPLOADED')).toBeOnTheScreen();
    expect(screen.getByText('MY RECIPES')).toBeOnTheScreen();
    expect(
      (await screen.findAllByText('Charred Broccoli Soup')).length,
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText('Miso Butter Noodles')).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText('Tomato Toast')).toBeOnTheScreen();
    expect(screen.getAllByText('Dinner').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1× cooked/).length).toBeGreaterThan(0);
  });

  test('shows resume and stop, and clears the session after confirming stop', async () => {
    mockOkLists();
    useCookStore.getState().start('seed:harissa');
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

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

    await renderWithProviders(<HomeScreen />);

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

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.queryByText('COOKING NOW')).toBeNull();
  });

  test('hides COOKING NOW after complete even if the API still lists in-progress', async () => {
    const session = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recipeId: '11111111-1111-4111-8111-111111111111',
      status: 'IN_PROGRESS',
      currentStepIndex: 3,
      startedAt: '2026-08-30T12:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      totalDurationMs: 90_000,
      steps: [],
      recipe: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Charred Broccoli Soup',
        stepCount: 4,
      },
    };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/cook-sessions')) {
        return mockJsonResponse({
          data: [session],
          meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
        });
      }
      return mockJsonResponse(emptyListBody);
    });
    useCookStore.setState({
      recipeId: session.recipeId,
      sessionId: session.id,
      stepIndex: 3,
      startedAt: Date.parse(session.startedAt),
      timer: null,
      terminalStatus: 'COMPLETED',
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.queryByText('COOKING NOW')).toBeNull();
  });

  test('keeps My recipes visible when Last uploaded fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/cook-sessions')) {
        return mockJsonResponse({
          data: [],
          meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
        });
      }
      if (url.includes('sort=engagement')) {
        return mockJsonResponse({
          data: [
            listItem({
              id: '22222222-2222-4222-8222-222222222222',
              title: 'Miso Butter Noodles',
              isFavorite: true,
            }),
          ],
          meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
        });
      }
      if (url.includes('sort=latest')) {
        return Promise.reject(new Error('offline'));
      }
      return mockJsonResponse(emptyListBody);
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('MY RECIPES')).toBeOnTheScreen();
    expect(await screen.findByText('Miso Butter Noodles')).toBeOnTheScreen();
    expect(
      await screen.findByText(
        /couldn’t load this section/i,
        {},
        { timeout: 4000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('LAST UPLOADED')).toBeOnTheScreen();
  });

  test('shows a stale last-uploaded cache when the network is down', async () => {
    await writeCachedRecipeList('latest', {
      items: [
        listItem({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Charred Broccoli Soup',
        }),
      ],
      meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/cook-sessions')) {
        return mockJsonResponse({
          data: [],
          meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
        });
      }
      return Promise.reject(new Error('offline'));
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText(/Showing last loaded recipes/)).toBeOnTheScreen();
  });
});

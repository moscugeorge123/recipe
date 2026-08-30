import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';
import type { RecipeListItemView } from '@/features/recipes/types';
import { useCookStore } from '@/stores/cook-store';
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
    ...overrides,
  };
}

const emptyListBody = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
};

describe('HomeScreen', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
    usePreferencesStore.getState().completeOnboarding();
    useCookStore.getState().exit();
    useCookStore.setState({ terminalStatus: null });
    useUiStore.getState().closeCapture();
    jest.restoreAllMocks();
  });

  test('renders the greeting and inbox without tonight or kitchen', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockJsonResponse(emptyListBody));

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.getByText(/RECIPE INBOX/)).toBeOnTheScreen();
    expect(screen.queryByText('TONIGHT')).toBeNull();
    expect(screen.queryByText('FROM YOUR KITCHEN')).toBeNull();
    expect(
      await screen.findByText(/haven’t added any recipes yet/i),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add your first recipe' }),
    ).toBeOnTheScreen();
  });

  test('opens capture from the empty latest-added section', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockJsonResponse(emptyListBody));
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    await user.press(
      await screen.findByRole('button', { name: 'Add your first recipe' }),
    );

    expect(useUiStore.getState().captureOpen).toBe(true);
  });

  test('renders seed inbox even when the API is down', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.getByText(/RECIPE INBOX/)).toBeOnTheScreen();
    expect(screen.queryByText('TONIGHT')).toBeNull();
    expect(screen.queryByText('FROM YOUR KITCHEN')).toBeNull();
    expect(
      await screen.findByText(
        /couldn’t load your latest recipes/i,
        {},
        { timeout: 4000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test('retries loading latest recipes', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    const retry = await screen.findByRole(
      'button',
      { name: 'Retry' },
      { timeout: 4000 },
    );
    const callsBeforeRetry = fetchSpy.mock.calls.length;
    await user.press(retry);

    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  test('renders the three most recently added recipes', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
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
          listItem({
            id: '44444444-4444-4444-8444-444444444444',
            title: 'Old Stew',
            createdAt: '2026-01-01T12:00:00.000Z',
          }),
        ],
        meta: { page: 1, pageSize: 50, total: 4, totalPages: 1 },
      }),
    );

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText('LATEST ADDED')).toBeOnTheScreen();
    expect(screen.getByText('Miso Butter Noodles')).toBeOnTheScreen();
    expect(screen.getByText('Tomato Toast')).toBeOnTheScreen();
    expect(screen.queryByText('Old Stew')).toBeNull();
  });

  test('shows resume and stop, and clears the session after confirming stop', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockJsonResponse(emptyListBody));
    useCookStore.getState().start('seed:harissa');
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const stop = buttons?.find((button) => button.text === 'Stop');
        stop?.onPress?.();
      });
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('COOKING NOW')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Stop' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Stop cooking?',
      'This will mark the recipe as finished and hide it from Home.',
      expect.any(Array),
    );
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
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const stop = buttons?.find((button) => button.text === 'Stop');
        stop?.onPress?.();
      });
    const user = userEvent.setup();

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('COOKING NOW')).toBeOnTheScreen();
    expect(screen.getByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.getByText('Step 2 of 4')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Stop' }));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('COOKING NOW')).toBeNull();
    });
    expect(useCookStore.getState().recipeId).toBeNull();
    expect(inProgress).toBe(false);
  });

  test('hides COOKING NOW after the cook is marked completed', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockJsonResponse(emptyListBody));
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
});

import { screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { usePreferencesStore } from '@/stores/preferences-store';
import { renderWithProviders } from '@/test/render-with-providers';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HomeScreen', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
    usePreferencesStore.getState().completeOnboarding();
    jest.restoreAllMocks();
  });

  test('renders the greeting and tonight section', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      }),
    );

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(/Sam\./)).toBeOnTheScreen();
    expect(screen.getByText('TONIGHT')).toBeOnTheScreen();
    expect(screen.getByText(/RECIPE INBOX/)).toBeOnTheScreen();
  });

  test('renders seed recipes even when the API is down', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('TONIGHT')).toBeOnTheScreen();
    expect(screen.getByText('FROM YOUR KITCHEN')).toBeOnTheScreen();
  });
});

import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import ImportErrorScreen from '@/app/import/error';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

const params = jest.mocked(useLocalSearchParams);

describe('ImportErrorScreen', () => {
  test('maps rate-limit copy without showing a request id', async () => {
    params.mockReturnValue({ code: 'TOO_MANY_REQUESTS' });

    await renderWithProviders(<ImportErrorScreen />);

    expect(await screen.findByText(/busy/i)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.queryByText(/request/i)).toBeNull();
  });

  test('shows Daisy in the error pose', async () => {
    params.mockReturnValue({ code: 'EXTRACTION_FAILED' });

    await renderWithProviders(<ImportErrorScreen />);

    expect(
      await screen.findByText("We couldn't read that one. Try again?"),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('daisy-mascot', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('daisy-cards')).toBeNull();
  });
});

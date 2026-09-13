import { screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import OnboardingScreen from '@/app/onboarding';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { colors } from '@/theme/tokens';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.getState().reset();
    useUiStore.getState().closeCapture();
  });

  test('keeps three steps with black Next/Skip and orange accents', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<OnboardingScreen />);

    expect(screen.getByText('RECIME')).toBeOnTheScreen();
    expect(
      screen.getByText('Turn recipes you find anywhere into dinner.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Skip')).toHaveStyle({ color: colors.cta });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveStyle({
      backgroundColor: colors.cta,
    });

    await user.press(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByText("Let's find something delicious."),
    ).toBeOnTheScreen();
    expect(screen.getByText('Italian')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Try it on something now.')).toBeOnTheScreen();
    expect(screen.getByText('Instagram')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Capture a recipe' }),
    ).toBeOnTheScreen();
  });

  test('Skip finishes onboarding without opening capture', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<OnboardingScreen />);

    await user.press(screen.getByRole('button', { name: 'Skip' }));

    expect(usePreferencesStore.getState().hasOnboarded).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(useUiStore.getState().captureOpen).toBe(false);
  });
});

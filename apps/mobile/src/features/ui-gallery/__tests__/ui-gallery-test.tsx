import { screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import ProfileScreen from '@/app/profile';
import { UiGallery } from '@/features/ui-gallery/ui-gallery';
import { usePreferencesStore } from '@/stores/preferences-store';
import { renderWithProviders } from '@/test/render-with-providers';

describe('component gallery', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  test('settings opens the gallery', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
    const user = userEvent.setup();

    await renderWithProviders(<ProfileScreen />);
    await user.press(
      await screen.findByRole('button', { name: 'Component gallery' }),
    );

    expect(push).toHaveBeenCalledWith('/ui-gallery');
  });

  test('renders the shared components', async () => {
    await renderWithProviders(<UiGallery />);

    expect(
      await screen.findByRole('header', { name: 'Component gallery' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Wild Sage & Sea Salt Boule')).toBeOnTheScreen();
    expect(screen.getByText('Plan to pantry sync')).toBeOnTheScreen();
    expect(screen.getByText('Cook mode active')).toBeOnTheScreen();
    expect(screen.getByLabelText('Back')).toBeOnTheScreen();
  });
});

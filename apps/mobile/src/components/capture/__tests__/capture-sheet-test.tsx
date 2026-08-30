import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

import { CaptureSheet } from '@/components/capture/capture-sheet';
import { SUPPORTED_CAPTURE_SOURCES } from '@/features/capture/sources';
import { useUiStore } from '@/stores/ui-store';
import { renderWithProviders } from '@/test/render-with-providers';

describe('CaptureSheet', () => {
  beforeEach(() => {
    useUiStore.getState().closeCapture();
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('');
    jest.spyOn(router, 'push').mockImplementation(() => undefined);
  });

  test('shows supported sources and hides TikTok, Facebook and Share sheet', async () => {
    useUiStore.getState().openCapture();

    await renderWithProviders(<CaptureSheet />);

    for (const source of SUPPORTED_CAPTURE_SOURCES) {
      expect(
        await screen.findByRole('button', { name: source }),
      ).toBeOnTheScreen();
    }

    expect(screen.queryByRole('button', { name: 'TikTok' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Facebook' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share sheet' })).toBeNull();
  });

  test('hides clipboard when it is empty or not a usable recipe source', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('hi there');
    useUiStore.getState().openCapture();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Instagram' }),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(Clipboard.getStringAsync).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Use clipboard' })).toBeNull();
    expect(screen.queryByText('Clipboard')).toBeNull();
  });

  test('shows clipboard for a supported platform link and uses it', async () => {
    jest
      .mocked(Clipboard.getStringAsync)
      .mockResolvedValue('https://www.instagram.com/reel/C8xk2Rp9Lm/');
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Use clipboard' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/instagram.com\/reel/i)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Use clipboard' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/preview',
      params: {
        source: 'Instagram',
        url: 'https://www.instagram.com/reel/C8xk2Rp9Lm/',
      },
    });
  });

  test('hides clipboard for an unsupported platform link', async () => {
    jest
      .mocked(Clipboard.getStringAsync)
      .mockResolvedValue('https://www.tiktok.com/@cook/video/1');
    useUiStore.getState().openCapture();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'YouTube' }),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(Clipboard.getStringAsync).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Use clipboard' })).toBeNull();
  });

  test('shows clipboard for a website link', async () => {
    jest
      .mocked(Clipboard.getStringAsync)
      .mockResolvedValue('https://www.seriouseats.com/pistachio-pasta');
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Use clipboard' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Use clipboard' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/preview',
      params: {
        source: 'Website',
        url: 'https://www.seriouseats.com/pistachio-pasta',
      },
    });
  });

  test('shows clipboard for long text and opens paste with it', async () => {
    const paste =
      'Toast the pistachios, blend with lemon, garlic and pasta water, then toss through rigatoni until glossy.';
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue(paste);
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Use clipboard' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Use clipboard' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/manual',
      params: { paste },
    });
  });
});

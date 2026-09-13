import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

import { CaptureSheet } from '@/components/capture/capture-sheet';
import { useUiStore } from '@/stores/ui-store';
import { colors } from '@/theme/tokens';
import { renderWithProviders } from '@/test/render-with-providers';

const mockCreate = jest.fn();

jest.mock('@/features/collections/hooks', () => ({
  useCreateCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
}));

describe('CaptureSheet', () => {
  beforeEach(() => {
    useUiStore.getState().closeCapture();
    mockCreate.mockReset();
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('');
    jest.spyOn(router, 'push').mockImplementation(() => undefined);
  });

  test('opens Add a Recipe and Add a Cookbook', async () => {
    useUiStore.getState().openCapture();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add a Cookbook' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Import from anywhere')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'TikTok' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Facebook' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share sheet' })).toBeNull();
  });

  test('Add a Recipe shows social import and a 2x2 of methods', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    );

    expect(
      screen.getByRole('button', { name: 'Import from social media' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Photo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Text' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Web' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Write from scratch' }),
    ).toBeOnTheScreen();
  });

  test('social import opens preview with an empty URL', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Import from social media' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/preview',
      params: { source: 'Instagram', url: '' },
    });
  });

  test('Web opens preview with an empty URL', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    );
    await user.press(screen.getByRole('button', { name: 'Web' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/preview',
      params: { source: 'Website', url: '' },
    });
  });

  test('Photo opens manual import', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    );
    await user.press(screen.getByRole('button', { name: 'Photo' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/manual',
      params: {},
    });
  });

  test('Write from scratch opens manual import', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Write from scratch' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/import/manual',
      params: {},
    });
  });

  test('Add a Cookbook opens the 0/50 form with gray Create until typed', async () => {
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Cookbook' }),
    );

    expect(await screen.findByText('0/50')).toBeOnTheScreen();
    expect(
      screen.getByPlaceholderText('e.g. Weeknight Dinner'),
    ).toBeOnTheScreen();
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    expect(create).toHaveStyle({ backgroundColor: colors.ctaDisabled });

    await user.type(screen.getByLabelText('Cookbook name'), 'Weeknight Dinner');
    expect(screen.getByText('16/50')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create' })).toHaveStyle({
      backgroundColor: colors.cta,
    });
  });

  test('creates a cookbook from the FAB sheet', async () => {
    mockCreate.mockResolvedValue({ name: 'Weeknight Dinner' });
    useUiStore.getState().openCapture();
    const user = userEvent.setup();

    await renderWithProviders(<CaptureSheet />);
    await user.press(
      await screen.findByRole('button', { name: 'Add a Cookbook' }),
    );
    await user.type(screen.getByLabelText('Cookbook name'), 'Weeknight Dinner');
    await user.press(screen.getByRole('button', { name: 'Create' }));

    expect(mockCreate).toHaveBeenCalledWith({ name: 'Weeknight Dinner' });
  });

  test('hides clipboard when it is empty or not a usable recipe source', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('hi there');
    useUiStore.getState().openCapture();

    await renderWithProviders(<CaptureSheet />);

    expect(
      await screen.findByRole('button', { name: 'Add a Recipe' }),
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
      await screen.findByRole('button', { name: 'Add a Recipe' }),
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

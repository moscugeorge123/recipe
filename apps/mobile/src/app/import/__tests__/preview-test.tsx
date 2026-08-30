import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ImportPreviewScreen from '@/app/import/preview';
import { createExtraction } from '@/features/extraction/api';
import { fetchLinkPreview } from '@/features/link-preview/api';
import type { LinkPreview } from '@/features/link-preview/schemas';
import { useUiStore } from '@/stores/ui-store';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/features/link-preview/api', () => ({
  fetchLinkPreview: jest.fn(),
}));

jest.mock('@/features/extraction/api', () => ({
  createExtraction: jest.fn(),
}));

const fetchPreview = jest.mocked(fetchLinkPreview);
const createJob = jest.mocked(createExtraction);
const params = jest.mocked(useLocalSearchParams);

const fakePreview: LinkPreview = {
  url: 'https://example.com/fake-recipe',
  sourceType: 'GENERIC_WEB',
  title: 'Fake Pasta Recipe',
  author: 'fixture-chef',
  description: 'A simple weeknight pasta from the fake provider fixture.',
  thumbnails: [
    { url: 'https://example.com/fake-thumb.jpg' },
    { url: 'https://example.com/fake-thumb-2.jpg' },
    { url: 'https://example.com/fake-thumb-3.jpg' },
  ],
};

describe('ImportPreviewScreen', () => {
  beforeEach(() => {
    fetchPreview.mockReset();
    createJob.mockReset();
    jest.mocked(router.replace).mockReset();
    jest.mocked(router.push).mockReset();
    params.mockReturnValue({
      source: 'Website',
      url: 'https://example.com/fake-recipe',
    });
  });

  test('does not call the preview API when there is no URL', async () => {
    params.mockReturnValue({ source: 'Instagram', url: '' });

    await renderWithProviders(<ImportPreviewScreen />);

    expect(
      await screen.findByRole('button', { name: 'Turn into a recipe' }),
    ).toBeDisabled();
    expect(fetchPreview).not.toHaveBeenCalled();
  });

  test('shows loading placeholders while preview is in flight', async () => {
    fetchPreview.mockImplementation(
      (_url, signal) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (signal?.aborted) {
            abort();
            return;
          }
          signal?.addEventListener('abort', abort);
        }),
    );

    const view = await renderWithProviders(<ImportPreviewScreen />);

    expect(await screen.findByText('video still')).toBeOnTheScreen();
    expect(screen.queryByText('@fixture-chef')).toBeNull();
    expect(screen.queryByText('Fake Pasta Recipe')).toBeNull();
    view.unmount();
  });

  test('renders unfurled metadata and extracts with the second thumbnail', async () => {
    fetchPreview.mockResolvedValue(fakePreview);
    createJob.mockResolvedValue({ jobId: 'job-1', status: 'queued' });
    const user = userEvent.setup();

    await renderWithProviders(<ImportPreviewScreen />);

    expect(await screen.findByText('@fixture-chef')).toBeOnTheScreen();
    expect(screen.getByText('Fake Pasta Recipe')).toBeOnTheScreen();
    expect(
      screen.queryByText(
        'A simple weeknight pasta from the fake provider fixture.',
      ),
    ).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Thumbnail 2' }));
    await user.press(
      screen.getByRole('button', { name: 'Turn into a recipe' }),
    );

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledWith({
        url: 'https://example.com/fake-recipe',
        selectedThumbnailUrl: 'https://example.com/fake-thumb-2.jpg',
      });
    });
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/import/extract/[jobId]',
      params: {
        jobId: 'job-1',
        url: 'https://example.com/fake-recipe',
        thumbnailUrl: 'https://example.com/fake-thumb-2.jpg',
      },
    });
  });

  test('shows starting state while extract is in flight', async () => {
    fetchPreview.mockResolvedValue(fakePreview);
    createJob.mockImplementation(
      () =>
        new Promise(() => {
          /* hang until unmount */
        }),
    );
    const user = userEvent.setup();

    const view = await renderWithProviders(<ImportPreviewScreen />);
    await user.press(
      await screen.findByRole('button', { name: 'Turn into a recipe' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Starting…' }),
    ).toBeDisabled();
    view.unmount();
  });

  test('still allows extract when preview fails', async () => {
    fetchPreview.mockRejectedValue(new Error('offline'));
    createJob.mockResolvedValue({ jobId: 'job-2', status: 'queued' });
    const user = userEvent.setup();

    await renderWithProviders(<ImportPreviewScreen />);

    expect(
      await screen.findByText(/couldn't unfurl this link/i),
    ).toBeOnTheScreen();
    expect(useUiStore.getState().toast?.text).toMatch(/preview/i);

    await user.press(
      screen.getByRole('button', { name: 'Turn into a recipe' }),
    );

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledWith({
        url: 'https://example.com/fake-recipe',
      });
    });
  });

  test('sends an instant-complete job through extract so Daisy can play', async () => {
    fetchPreview.mockResolvedValue(fakePreview);
    createJob.mockResolvedValue({
      jobId: 'job-fast',
      status: 'completed',
      recipeId: 'rec-9',
    });
    const user = userEvent.setup();

    await renderWithProviders(<ImportPreviewScreen />);
    await user.press(
      await screen.findByRole('button', { name: 'Turn into a recipe' }),
    );

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/import/extract/[jobId]',
        params: {
          jobId: 'job-fast',
          url: 'https://example.com/fake-recipe',
          thumbnailUrl: 'https://example.com/fake-thumb.jpg',
        },
      });
    });
    expect(router.replace).not.toHaveBeenCalledWith('/import/review/rec-9');
  });
});

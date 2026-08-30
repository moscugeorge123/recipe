import { screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ExtractScreen from '@/app/import/extract/[jobId]';
import { getExtractionJob } from '@/features/extraction/api';
import type { JobStatusDto } from '@/features/extraction/schemas';
import { usePreferencesStore } from '@/stores/preferences-store';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/features/extraction/api', () => ({
  getExtractionJob: jest.fn(),
  cancelExtraction: jest.fn(),
}));

const getJob = jest.mocked(getExtractionJob);
const params = jest.mocked(useLocalSearchParams);

function job(overrides: Partial<JobStatusDto> = {}): JobStatusDto {
  return {
    id: 'job-1',
    status: 'EXTRACTING_RECIPE',
    progress: 40,
    currentStage: 'EXTRACTING_RECIPE',
    recipeId: null,
    error: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('ExtractScreen', () => {
  beforeEach(() => {
    getJob.mockReset();
    jest.mocked(router.replace).mockReset();
    usePreferencesStore.getState().reset();
    params.mockReturnValue({
      jobId: 'job-1',
      url: 'https://instagram.com/reel/DKxVeryLongId4f2',
    });
  });

  test('shows Daisy while a job is in flight', async () => {
    getJob.mockResolvedValue(
      job({ status: 'TRANSCRIBING', currentStage: 'TRANSCRIBING' }),
    );

    await renderWithProviders(<ExtractScreen />);

    expect(await screen.findByText(/instagram\.com\/reel/)).toBeOnTheScreen();
    // The signature intro holds the importing beat before the analyzing copy.
    expect(await screen.findByText('Fetching your recipe…')).toBeOnTheScreen();
    expect(
      screen.getByTestId('daisy-mascot', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('READING POST')).toBeNull();
    expect(screen.queryByText('Post captured')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Cancel import' }),
    ).toBeOnTheScreen();
  });

  test('reaches the analyzing copy once the intro finishes', async () => {
    usePreferencesStore.getState().setReduceMotion('reduce');
    getJob.mockResolvedValue(
      job({ status: 'TRANSCRIBING', currentStage: 'TRANSCRIBING' }),
    );

    await renderWithProviders(<ExtractScreen />);

    expect(
      await screen.findByText('Reading the ingredients…'),
    ).toBeOnTheScreen();
  });

  test('leaves for review after the success hold', async () => {
    usePreferencesStore.getState().setReduceMotion('reduce');
    getJob.mockResolvedValue(
      job({
        status: 'COMPLETED',
        currentStage: 'COMPLETED',
        recipeId: 'rec-1',
        progress: 100,
      }),
    );

    await renderWithProviders(<ExtractScreen />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/import/review/rec-1');
    });
  });
});

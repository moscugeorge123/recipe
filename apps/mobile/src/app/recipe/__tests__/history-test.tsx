import { screen, userEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import RecipeHistoryScreen from '@/app/recipe/[id]/history';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

const mockRefetch = jest.fn();
const mockUseRecipeRevisions = jest.fn();
jest.mock('@/features/recipes/hooks/use-recipe-editor', () => ({
  useRecipeRevisions: (...args: unknown[]) => mockUseRecipeRevisions(...args),
}));

const params = jest.mocked(useLocalSearchParams);

describe('RecipeHistoryScreen', () => {
  beforeEach(() => {
    params.mockReturnValue({ id: 'recipe-1' });
    mockRefetch.mockReset();
    mockUseRecipeRevisions.mockReset();
  });

  test('shows original badge, summaries, and opens a revision', async () => {
    mockUseRecipeRevisions.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'revision-1',
          revisionNumber: 1,
          source: 'USER_EDIT',
          createdAt: '2026-08-31T01:00:00.000Z',
          title: 'Corrected pasta',
          isOriginal: false,
          summary: 'Changed title',
          changes: ['Changed title'],
        },
        {
          id: 'revision-0',
          revisionNumber: 0,
          source: 'IMPORT',
          createdAt: '2026-08-31T00:00:00.000Z',
          title: 'Imported pasta',
          isOriginal: true,
          summary: 'Original imported recipe',
          changes: ['Original imported recipe'],
        },
      ],
      refetch: mockRefetch,
    });
    const user = userEvent.setup();
    await renderWithProviders(<RecipeHistoryScreen />);

    expect(screen.getByText('ORIGINAL')).toBeOnTheScreen();
    expect(screen.getByText('Original imported recipe')).toBeOnTheScreen();
    expect(screen.getByText('Changed title')).toBeOnTheScreen();
    expect(screen.getByText(/Edited/)).toBeOnTheScreen();
    await user.press(screen.getByLabelText('Open original import, revision 0'));
    expect(router.push).toHaveBeenCalledWith(
      '/recipe/recipe-1/revision/revision-0',
    );
  });

  test('shows a timeline skeleton while history loads', async () => {
    mockUseRecipeRevisions.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: mockRefetch,
    });
    await renderWithProviders(<RecipeHistoryScreen />);
    expect(screen.getByLabelText('Loading revision history')).toBeOnTheScreen();
    expect(screen.queryByText('Loading history…')).toBeNull();
  });

  test('offers retry when history fails to load', async () => {
    mockUseRecipeRevisions.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: mockRefetch,
    });
    const user = userEvent.setup();
    await renderWithProviders(<RecipeHistoryScreen />);

    expect(screen.getByText(/Could not load history/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('keeps summaries on screen while history refreshes', async () => {
    mockUseRecipeRevisions.mockReturnValue({
      isLoading: false,
      isFetching: true,
      isError: false,
      data: [
        {
          id: 'revision-1',
          revisionNumber: 1,
          source: 'USER_EDIT',
          createdAt: '2026-08-31T01:00:00.000Z',
          title: 'Corrected pasta',
          isOriginal: false,
          summary: 'Renamed to “Corrected pasta”',
          changes: ['Renamed to “Corrected pasta”'],
        },
      ],
      refetch: mockRefetch,
    });
    await renderWithProviders(<RecipeHistoryScreen />);

    expect(screen.getByText('Renamed to “Corrected pasta”')).toBeOnTheScreen();
    expect(screen.queryByText('Loading history…')).toBeNull();
  });
});

import { screen, userEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import RecipeRevisionScreen from '@/app/recipe/[id]/revision/[revisionId]';
import { ApiError } from '@/services/api-client';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

const mockMutate = jest.fn();
const mockRestoreState: { error: unknown } = { error: null };

jest.mock('@/features/recipes/hooks/use-recipe-editor', () => ({
  useRecipeRevision: () => ({
    data: {
      id: 'recipe-1',
      title: 'Imported pasta',
      description: 'A quick pasta',
      revisionId: 'revision-0',
      revisionNumber: 0,
      summary: 'Original imported recipe',
      changes: ['Original imported recipe'],
      categories: [{ id: 'cat-dinner', name: 'Dinner' }],
      ingredients: [{ id: 'ing-1', emoji: '🍝', name: 'Pasta' }],
      steps: [{ id: 'step-1', stepOrder: 1, instruction: 'Boil pasta' }],
    },
    isLoading: false,
  }),
  useRestoreRecipe: () => ({
    mutate: mockMutate,
    isPending: false,
    error: mockRestoreState.error,
  }),
}));

jest.mock('@/features/recipes/hooks/use-recipe', () => ({
  useRecipe: () => ({ data: { revisionNumber: 1 } }),
}));

const params = jest.mocked(useLocalSearchParams);

describe('RecipeRevisionScreen', () => {
  beforeEach(() => {
    params.mockReturnValue({ id: 'recipe-1', revisionId: 'revision-0' });
    mockMutate.mockReset();
    mockRestoreState.error = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('confirms restore and creates a new head from the original', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<RecipeRevisionScreen />);

    expect(screen.getByText('ORIGINAL')).toBeOnTheScreen();
    expect(screen.getByText('Original imported recipe')).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', { name: 'Restore as new revision' }),
    );

    expect(
      await screen.findByText('Restore original recipe?'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/Nothing already in history will be deleted/),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Restore' }));
    expect(mockMutate).toHaveBeenCalledWith(
      { revisionId: 'revision-0', expectedRevisionNumber: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  test('keeps the current recipe when restore is cancelled', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<RecipeRevisionScreen />);
    await user.press(
      screen.getByRole('button', { name: 'Restore as new revision' }),
    );

    await user.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test('explains a restore conflict without discarding history', async () => {
    mockRestoreState.error = new ApiError(
      'changed',
      409,
      {},
      'RECIPE_REVISION_CONFLICT',
    );
    await renderWithProviders(<RecipeRevisionScreen />);

    expect(screen.getByText(/This recipe changed elsewhere/)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Restore as new revision' }),
    ).toBeOnTheScreen();
  });
});

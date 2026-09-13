import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import { RecipesLibrary } from '@/features/recipes/recipes-library';
import type { CollectionSummary } from '@/features/collections/types';
import type { RecipeListItemView } from '@/features/recipes/types';
import { renderWithProviders } from '@/test/render-with-providers';

const mockPush = jest.fn();
const mockCreate = jest.fn();

const collectionsState: {
  items: CollectionSummary[];
  isSuccess: boolean;
  isLoading: boolean;
  isError: boolean;
} = {
  items: [],
  isSuccess: true,
  isLoading: false,
  isError: false,
};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

jest.mock('@/features/catalog/use-catalog', () => ({
  useCatalog: () => ({
    get: () => undefined,
    collections: [],
  }),
}));

jest.mock('@/features/home/cooking-now-card', () => ({
  CookingNowCard: () => null,
}));

jest.mock('@/features/collections/hooks', () => ({
  useCollections: () => ({
    data: { items: collectionsState.items },
    isSuccess: collectionsState.isSuccess,
    isLoading: collectionsState.isLoading,
    isError: collectionsState.isError,
    isFetching: false,
    refetch: jest.fn(),
  }),
  useCreateCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
  useRenameCollection: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useDeleteCollection: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useAddCollectionRecipe: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/lib/haptics', () => ({
  hapticMedium: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useRecipes: () => ({
    data: {
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Charred Broccoli Soup',
          description: null,
          confidence: 0.9,
          sourceLanguage: 'en',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          servings: 2,
          prepTimeMinutes: 10,
          cookTimeMinutes: 20,
          totalTimeMinutes: 30,
          calories: null,
          cuisine: 'Italian',
          difficulty: 'Easy',
          minutes: 30,
          sourceType: 'GENERIC_WEB',
          sourceLabel: 'Website',
          creator: 'Chef',
          originalUrl: null,
          thumbnailUrl: null,
          ingredientCount: 3,
          stepCount: 4,
        } satisfies RecipeListItemView,
      ],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

function cookbook(name = 'Appetizers'): CollectionSummary {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name,
    description: null,
    recipeCount: 2,
    recipeIds: ['a', 'b'],
    coverPreviews: [{ recipeId: 'a', title: 'Crostini', thumbnailUrl: null }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('RecipesLibrary', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockCreate.mockReset().mockResolvedValue({ name: 'Uncategorized' });
    collectionsState.items = [cookbook()];
    collectionsState.isSuccess = true;
    collectionsState.isLoading = false;
    collectionsState.isError = false;
  });

  test('switches from Cookbooks to All Recipes', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<RecipesLibrary />);

    expect(screen.getByText('Appetizers')).toBeOnTheScreen();
    expect(screen.getByText('2 recipes')).toBeOnTheScreen();
    expect(screen.queryByText('Charred Broccoli Soup')).toBeNull();
    expect(screen.queryByText('Inbox')).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.queryByText('Want')).toBeNull();
    expect(screen.queryByText('Cooked')).toBeNull();

    await user.press(screen.getByRole('tab', { name: 'All Recipes' }));

    expect(screen.getByText('Charred Broccoli Soup')).toBeOnTheScreen();
    expect(screen.queryByText('Appetizers')).toBeNull();
  });

  test('creates Uncategorized when the cookbook list is empty', async () => {
    collectionsState.items = [];
    await renderWithProviders(<RecipesLibrary />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Uncategorized' });
    });
  });

  test('does not create Uncategorized when cookbooks already exist', async () => {
    await renderWithProviders(<RecipesLibrary />);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('shows filter only on All Recipes', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<RecipesLibrary />);

    expect(screen.queryByLabelText('Sort and filter')).toBeNull();
    expect(screen.getByLabelText('Search titles')).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'All Recipes' }));

    expect(screen.getByLabelText('Sort and filter')).toBeOnTheScreen();
  });

  test('opens options on long press of a cookbook card', async () => {
    await renderWithProviders(<RecipesLibrary />);

    fireEvent(
      screen.getByLabelText('Open Appetizers'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'longpress' } },
    );

    expect(await screen.findByText('Options')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Rename Appetizers' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add recipe' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Delete Appetizers' }),
    ).toBeOnTheScreen();
  });
});

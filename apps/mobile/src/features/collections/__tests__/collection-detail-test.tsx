import { screen, userEvent } from '@testing-library/react-native';

import { CollectionDetail } from '@/features/collections/collection-detail';
import { renderWithProviders } from '@/test/render-with-providers';
import type { CollectionDetail as CollectionDetailModel } from '@/features/collections/types';
import type { RecipeListItemView } from '@/features/recipes/types';

const mockReorder = jest.fn();
const mockRemoveRecipe = jest.fn();
const mockDelete = jest.fn();
const mockRename = jest.fn();
const mockAdd = jest.fn();
const mockRefetch = jest.fn();

const mockQueryState: {
  data?: CollectionDetailModel;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: mockRefetch,
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useRecipes: () => ({ data: { items: [] } }),
}));

jest.mock('@/features/home/recipe-card', () => ({
  RecipeCard: () => null,
}));

jest.mock('@/features/collections/hooks', () => ({
  useCollection: () => mockQueryState,
  useRenameCollection: () => ({ mutateAsync: mockRename, isPending: false }),
  useDeleteCollection: () => ({
    mutateAsync: mockDelete,
    isPending: false,
  }),
  useAddCollectionRecipe: () => ({ mutateAsync: mockAdd, isPending: false }),
  useRemoveCollectionRecipe: () => ({
    mutateAsync: mockRemoveRecipe,
    isPending: false,
  }),
  useReorderCollectionRecipes: () => ({
    mutateAsync: mockReorder,
    isPending: false,
  }),
}));

function listItem(
  id: string,
  title: string,
  sortOrder: number,
): RecipeListItemView & { sortOrder: number } {
  return {
    id,
    title,
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
    sortOrder,
  };
}

function detail(
  recipes: (RecipeListItemView & { sortOrder: number })[],
): CollectionDetailModel {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Friends Dinners',
    description: null,
    recipeCount: recipes.length,
    recipeIds: recipes.map((item) => item.id),
    coverPreviews: recipes.slice(0, 3).map((item) => ({
      recipeId: item.id,
      title: item.title,
      thumbnailUrl: null,
    })),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    recipes,
  };
}

function setQuery(
  next: Partial<typeof mockQueryState> & { data?: CollectionDetailModel },
): void {
  mockQueryState.data = next.data;
  mockQueryState.isLoading = next.isLoading ?? false;
  mockQueryState.isError = next.isError ?? false;
  mockQueryState.refetch = next.refetch ?? mockRefetch;
}

describe('CollectionDetail', () => {
  beforeEach(() => {
    mockReorder.mockReset().mockResolvedValue({});
    mockRemoveRecipe.mockReset().mockResolvedValue({});
    mockDelete.mockReset().mockResolvedValue({});
    mockRename.mockReset().mockResolvedValue({});
    mockAdd.mockReset().mockResolvedValue({});
    setQuery({
      data: detail([
        listItem('11111111-1111-4111-8111-111111111111', 'Soup', 0),
        listItem('33333333-3333-4333-8333-333333333333', 'Tart', 1),
      ]),
    });
  });

  test('shows an empty collection state', async () => {
    setQuery({ data: detail([]) });
    await renderWithProviders(
      <CollectionDetail collectionId={mockQueryState.data!.id} />,
    );
    expect(
      screen.getByText('Nothing in this collection yet.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add a recipe' }),
    ).toBeOnTheScreen();
  });

  test('shows an error state with retry', async () => {
    setQuery({ data: undefined, isError: true });
    const user = userEvent.setup();
    await renderWithProviders(
      <CollectionDetail collectionId="22222222-2222-4222-8222-222222222222" />,
    );
    expect(
      screen.getByText('Couldn’t load this collection.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('reorders recipes with 44px move controls', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <CollectionDetail collectionId="22222222-2222-4222-8222-222222222222" />,
    );
    await user.press(screen.getByRole('button', { name: 'Move Soup down' }));
    expect(mockReorder).toHaveBeenCalledWith([
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
    ]);
  });

  test('confirms destructive delete without deleting recipes', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <CollectionDetail collectionId="22222222-2222-4222-8222-222222222222" />,
    );
    await user.press(
      screen.getByRole('button', { name: 'Delete Friends Dinners' }),
    );
    expect(
      await screen.findByText(/Recipes stay in your kitchen/),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Keep' }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

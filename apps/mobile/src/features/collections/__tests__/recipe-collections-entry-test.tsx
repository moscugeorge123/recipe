import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { RecipeCollectionsEntry } from '@/features/recipes/components/recipe-collections-entry';
import { ApiError } from '@/services/api-client';
import { renderWithProviders } from '@/test/render-with-providers';

const recipeId = '11111111-1111-4111-8111-111111111111';
const appetizersId = '22222222-2222-4222-8222-222222222222';

const mockListCollections = jest.fn();
const mockAddCollectionRecipe = jest.fn();
const mockRemoveCollectionRecipe = jest.fn();
const mockCreateCollection = jest.fn();
const mockGetCollection = jest.fn();
const mockRenameCollection = jest.fn();
const mockDeleteCollection = jest.fn();
const mockReorderCollectionRecipes = jest.fn();

jest.mock('@/features/collections/api', () => ({
  listCollections: (...args: unknown[]) => mockListCollections(...args),
  addCollectionRecipe: (...args: unknown[]) => mockAddCollectionRecipe(...args),
  removeCollectionRecipe: (...args: unknown[]) =>
    mockRemoveCollectionRecipe(...args),
  createCollection: (...args: unknown[]) => mockCreateCollection(...args),
  getCollection: (...args: unknown[]) => mockGetCollection(...args),
  renameCollection: (...args: unknown[]) => mockRenameCollection(...args),
  deleteCollection: (...args: unknown[]) => mockDeleteCollection(...args),
  reorderCollectionRecipes: (...args: unknown[]) =>
    mockReorderCollectionRecipes(...args),
}));

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: appetizersId,
    name: 'Appetizers',
    description: null,
    recipeCount: 0,
    recipeIds: [] as string[],
    coverPreviews: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('RecipeCollectionsEntry', () => {
  beforeEach(() => {
    mockListCollections.mockReset();
    mockAddCollectionRecipe.mockReset();
    mockRemoveCollectionRecipe.mockReset();
    mockCreateCollection.mockReset();
    mockListCollections.mockResolvedValue({
      items: [summary()],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
  });

  test('shows current membership and prevents duplicate adds', async () => {
    mockListCollections.mockResolvedValue({
      items: [summary({ recipeIds: [recipeId], recipeCount: 1 })],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    await renderWithProviders(<RecipeCollectionsEntry recipeId={recipeId} />);
    expect(await screen.findByText('Appetizers')).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', { name: 'Add to a collection' }),
    );
    const row = await screen.findByRole('checkbox', { name: 'Appetizers' });
    expect(row.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    await user.press(row);
    expect(mockAddCollectionRecipe).not.toHaveBeenCalled();
    expect(mockRemoveCollectionRecipe).toHaveBeenCalledWith(
      appetizersId,
      recipeId,
    );
  });

  test('keeps the sheet and typed name while create-and-add is in flight', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    mockCreateCollection.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<RecipeCollectionsEntry recipeId={recipeId} />);
    await user.press(
      screen.getByRole('button', { name: 'Add to a collection' }),
    );
    await user.type(screen.getByLabelText('New collection'), 'Friends Dinners');
    await user.press(screen.getByRole('button', { name: 'Create and add' }));
    expect(screen.getByLabelText('New collection').props.value).toBe(
      'Friends Dinners',
    );
    expect(screen.getByText('File this recipe')).toBeOnTheScreen();
    resolveCreate(
      summary({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Friends Dinners',
      }),
    );
    await waitFor(() =>
      expect(mockCreateCollection).toHaveBeenCalledWith({
        name: 'Friends Dinners',
        recipeIds: [recipeId],
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('New collection').props.value).toBe(''),
    );
  });

  test('rolls membership back when add fails', async () => {
    mockAddCollectionRecipe.mockRejectedValue(
      new ApiError('offline', 500, {}, 'INTERNAL_SERVER_ERROR'),
    );
    const user = userEvent.setup();
    await renderWithProviders(<RecipeCollectionsEntry recipeId={recipeId} />);
    await user.press(
      screen.getByRole('button', { name: 'Add to a collection' }),
    );
    const row = await screen.findByRole('checkbox', { name: 'Appetizers' });
    expect(row.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
    await user.press(row);
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Appetizers' }).props
          .accessibilityState,
      ).toEqual(expect.objectContaining({ checked: false })),
    );
    expect(mockAddCollectionRecipe).toHaveBeenCalled();
  });
});

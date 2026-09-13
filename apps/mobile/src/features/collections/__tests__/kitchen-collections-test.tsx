import { screen, userEvent } from '@testing-library/react-native';

import { KitchenCollections } from '@/features/collections/kitchen-collections';
import { renderWithProviders } from '@/test/render-with-providers';

const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockRename = jest.fn();
const mockDelete = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

jest.mock('@/features/catalog/use-catalog', () => ({
  useCatalog: () => ({
    get: () => undefined,
    collections: [],
  }),
}));

jest.mock('@/features/collections/hooks', () => ({
  useCollections: () => ({
    data: {
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Appetizers',
          description: null,
          recipeCount: 2,
          recipeIds: ['a', 'b'],
          coverPreviews: [
            { recipeId: 'a', title: 'Crostini', thumbnailUrl: null },
          ],
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    },
    isError: false,
  }),
  useCreateCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
  useRenameCollection: () => ({
    mutateAsync: mockRename,
    isPending: false,
  }),
  useDeleteCollection: () => ({
    mutateAsync: mockDelete,
    isPending: false,
  }),
}));

describe('KitchenCollections', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockCreate.mockReset();
    mockRename.mockReset();
    mockDelete.mockReset();
  });

  test('navigates to collection detail instead of toasting', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<KitchenCollections />);
    await user.press(screen.getByRole('button', { name: 'Open Appetizers' }));
    expect(mockPush).toHaveBeenCalledWith(
      '/collection/22222222-2222-4222-8222-222222222222',
    );
  });

  test('creates a cookbook from the new-cookbook sheet', async () => {
    mockCreate.mockResolvedValue({ name: 'Friends Dinners' });
    const user = userEvent.setup();
    await renderWithProviders(<KitchenCollections />);
    await user.press(screen.getByRole('button', { name: 'New cookbook' }));
    await user.type(screen.getByLabelText('Cookbook name'), 'Friends Dinners');
    await user.press(screen.getByRole('button', { name: 'Create' }));
    expect(mockCreate).toHaveBeenCalledWith({ name: 'Friends Dinners' });
  });

  test('confirms delete without destroying recipes', async () => {
    mockDelete.mockResolvedValue({ deleted: true });
    const user = userEvent.setup();
    await renderWithProviders(<KitchenCollections />);
    await user.press(screen.getByRole('button', { name: 'Delete Appetizers' }));
    expect(
      await screen.findByText(/Recipes stay in your kitchen/),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Keep' }));
    expect(mockDelete).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Delete Appetizers' }));
    await user.press(
      await screen.findByRole('button', { name: 'Delete cookbook' }),
    );
    expect(mockDelete).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
    );
  });
});

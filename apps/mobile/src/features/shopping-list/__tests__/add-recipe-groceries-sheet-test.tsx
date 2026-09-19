import { screen, userEvent } from '@testing-library/react-native';

import type { RecipeIngredientView } from '@/features/recipes/types';
import { AddRecipeGroceriesSheet } from '@/features/shopping-list/add-recipe-groceries-sheet';
import { renderWithProviders } from '@/test/render-with-providers';
import { colors } from '@/theme/tokens';

const recipeId = '11111111-1111-4111-8111-111111111111';

function ingredient(
  id: string,
  name: string,
  category: RecipeIngredientView['category'],
  overrides: Partial<RecipeIngredientView> = {},
): RecipeIngredientView {
  return {
    id,
    name,
    canonicalName: name.toLowerCase(),
    emoji: '🥣',
    quantity: 1,
    unit: null,
    preparation: null,
    optional: false,
    category,
    confidence: 0.9,
    ...overrides,
  };
}

const ingredients: RecipeIngredientView[] = [
  ingredient('ing-oil', 'Olive oil', 'Pantry', {
    quantity: 2,
    unit: 'tbsp',
    emoji: '🫒',
  }),
  ingredient('ing-broccoli', 'Broccoli', 'Produce', { emoji: '🥦' }),
  ingredient('ing-garlic', 'Garlic cloves', 'Produce', {
    quantity: 3,
    emoji: '🧄',
  }),
  ingredient('ing-milk', 'Milk', 'Dairy', { unit: 'cup', emoji: '🥛' }),
];

describe('AddRecipeGroceriesSheet', () => {
  test('groups by aisle, mutes pantry, and highlights items already on the list', async () => {
    await renderWithProviders(
      <AddRecipeGroceriesSheet
        visible
        recipeId={recipeId}
        ingredients={ingredients}
        pantryKeys={['olive oil']}
        groceryItems={[{ name: 'Broccoli', canonicalName: 'broccoli' }]}
        multiplier={1}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByText('FRESH PRODUCE')).toBeOnTheScreen();
    expect(screen.getByText('DAIRY')).toBeOnTheScreen();
    expect(screen.getByText('PANTRY')).toBeOnTheScreen();

    expect(screen.getByLabelText('Olive oil, in pantry')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Olive oil' })).toBeNull();

    const onList = screen.getByRole('checkbox', {
      name: 'Broccoli, on your list',
    });
    expect(onList).toHaveStyle({ backgroundColor: colors.paprikaSoft });
    expect(onList.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Garlic cloves' }),
    ).toBeOnTheScreen();
  });

  test('treats checked-off grocery items as already on the list', async () => {
    await renderWithProviders(
      <AddRecipeGroceriesSheet
        visible
        recipeId={recipeId}
        ingredients={ingredients}
        pantryKeys={[]}
        groceryItems={[
          { name: 'Broccoli', canonicalName: 'broccoli', done: true },
        ]}
        multiplier={1}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Broccoli, on your list' }),
    ).toHaveStyle({ backgroundColor: colors.paprikaSoft });
  });

  test('cancel closes without confirming', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <AddRecipeGroceriesSheet
        visible
        recipeId={recipeId}
        ingredients={ingredients}
        pantryKeys={['olive oil']}
        groceryItems={[]}
        multiplier={1}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('confirms only selected non-pantry items with scaled qty and recipe source', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <AddRecipeGroceriesSheet
        visible
        recipeId={recipeId}
        ingredients={ingredients}
        pantryKeys={['olive oil']}
        groceryItems={[{ name: 'Broccoli', canonicalName: 'broccoli' }]}
        multiplier={2}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    await user.press(screen.getByRole('checkbox', { name: 'Milk' }));
    await user.press(screen.getByRole('button', { name: 'Add to groceries' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toEqual([
      {
        name: 'Broccoli',
        quantity: 2,
        category: 'Produce',
        emoji: '🥦',
        sourceRecipeId: recipeId,
      },
      {
        name: 'Garlic cloves',
        quantity: 6,
        category: 'Produce',
        emoji: '🧄',
        sourceRecipeId: recipeId,
      },
    ]);
  });
});

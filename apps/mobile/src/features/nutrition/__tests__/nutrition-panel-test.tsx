import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { NutritionPanelView } from '@/features/nutrition/nutrition-panel';
import type { NutritionView } from '@/features/nutrition/types';
import { renderWithProviders } from '@/test/render-with-providers';

function view(overrides: Partial<NutritionView> = {}): NutritionView {
  return {
    recipeId: 'recipe-1',
    revisionId: 'revision-1',
    snapshotId: 'snapshot-1',
    status: 'READY',
    calculationStatus: 'COMPLETED',
    updating: false,
    provider: 'usda-fdc',
    calculatedAt: '2026-08-31T12:00:00.000Z',
    servings: 2,
    coverage: { matched: 3, total: 3, percent: 100 },
    unmatchedIngredients: [],
    totals: {
      calories: 600,
      proteinGrams: 20,
      carbohydrateGrams: 80,
      fatGrams: 18,
    },
    perPortion: {
      calories: 300,
      proteinGrams: 10,
      carbohydrateGrams: 40,
      fatGrams: 9,
      saturatedFatGrams: 3,
      fiberGrams: 4,
      sugarGrams: 6,
      sodiumMilligrams: 400,
    },
    per100g: {
      calories: 150,
      proteinGrams: 5,
      carbohydrateGrams: 20,
      fatGrams: 4.5,
      saturatedFatGrams: 1.5,
      fiberGrams: 2,
      sugarGrams: 3,
      sodiumMilligrams: 200,
    },
    matches: [],
    failureReason: null,
    ...overrides,
  };
}

describe('NutritionPanelView', () => {
  test('toggles per portion and per 100g without losing details', async () => {
    const retry = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={view()}
        isLoading={false}
        onRetry={retry}
      />,
    );

    expect(screen.getByText('300')).toBeTruthy();
    await user.press(screen.getByText('More detail'));
    expect(screen.getByText('Saturated fat')).toBeTruthy();
    expect(screen.getByText('3g')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Per 100g' }));
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('Saturated fat')).toBeTruthy();
    expect(screen.getByText('1.5g')).toBeTruthy();
  });

  test('shows a skeleton on the first calculation', async () => {
    await renderWithProviders(
      <NutritionPanelView
        nutrition={undefined}
        isLoading
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Calculating nutrition')).toBeTruthy();
  });

  test('keeps previous values visible while updating', async () => {
    await renderWithProviders(
      <NutritionPanelView
        nutrition={view({ status: 'PENDING', updating: true })}
        isLoading={false}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByText('Updating')).toBeTruthy();
    expect(screen.getByText('300')).toBeTruthy();
  });

  test('explains partial coverage', async () => {
    await renderWithProviders(
      <NutritionPanelView
        nutrition={view({
          status: 'PARTIAL',
          calculationStatus: 'PARTIAL',
          coverage: { matched: 2, total: 3, percent: 67 },
          unmatchedIngredients: ['Mystery fruit'],
        })}
        isLoading={false}
        onRetry={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/Based on 2 of 3 ingredients · skipped Mystery fruit/),
    ).toBeTruthy();
  });

  test('offers calculate when unavailable', async () => {
    const retry = jest.fn();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={view({
          status: 'UNAVAILABLE',
          calculationStatus: null,
          snapshotId: null,
          totals: null,
          perPortion: null,
          per100g: null,
        })}
        isLoading={false}
        onRetry={retry}
      />,
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Calculate nutrition' }),
    );
    expect(retry).toHaveBeenCalled();
  });

  test('offers retry when failed', async () => {
    const retry = jest.fn();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={view({
          status: 'FAILED',
          calculationStatus: 'FAILED',
          failureReason: 'No ingredients could be matched',
          totals: null,
          perPortion: null,
          per100g: null,
        })}
        isLoading={false}
        onRetry={retry}
      />,
    );
    expect(screen.getByText('No ingredients could be matched')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry nutrition' }));
    expect(retry).toHaveBeenCalled();
  });

  test('offers retry when the nutrition request fails', async () => {
    const retry = jest.fn();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={undefined}
        isLoading={false}
        isError
        onRetry={retry}
      />,
    );
    expect(screen.getByText(/couldn’t load nutrition/i)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry nutrition' }));
    expect(retry).toHaveBeenCalled();
  });

  test('maps a 429 to a retry without blocking the recipe', async () => {
    const retry = jest.fn();
    await renderWithProviders(
      <NutritionPanelView
        nutrition={undefined}
        isLoading={false}
        isError
        error={{ code: 'TOO_MANY_REQUESTS' }}
        onRetry={retry}
      />,
    );
    expect(screen.getByText(/busy/i)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry nutrition' }));
    expect(retry).toHaveBeenCalled();
  });
});

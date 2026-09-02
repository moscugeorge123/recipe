import { screen, userEvent } from '@testing-library/react-native';

import { HomeRecipeSection } from '@/features/home/home-recipe-section';
import type { RecipeListItemView } from '@/features/recipes/types';
import { usePreferencesStore } from '@/stores/preferences-store';
import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

function listItem(
  overrides: Partial<RecipeListItemView> &
    Pick<RecipeListItemView, 'id' | 'title'>,
): RecipeListItemView {
  return {
    description: null,
    confidence: 0.9,
    sourceLanguage: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    calories: null,
    cuisine: 'Italian',
    difficulty: 'Easy',
    minutes: 30,
    sourceType: 'INSTAGRAM',
    sourceLabel: 'Instagram',
    creator: '@test.cooks',
    originalUrl: null,
    thumbnailUrl: null,
    ingredientCount: 6,
    stepCount: 4,
    isFavorite: false,
    rating: null,
    cookCount: 0,
    reviewState: 'READY',
    ...overrides,
  };
}

const emptyProps = {
  title: 'LAST UPLOADED' as const,
  emptyTitle: 'No recipes yet',
  emptyActionLabel: 'Add your first recipe',
  fromCache: false,
  onRetry: () => undefined,
  layout: 'horizontal' as const,
};

describe('HomeRecipeSection', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  test('renders recipes in exact server order', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        title="MY RECIPES"
        emptyTitle="empty"
        emptyActionLabel="Add"
        isLoading={false}
        isError={false}
        isFetching={false}
        fromCache={false}
        onRetry={() => undefined}
        layout="grid"
        items={[
          listItem({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'First server recipe',
          }),
          listItem({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Second server recipe',
          }),
          listItem({
            id: '33333333-3333-4333-8333-333333333333',
            title: 'Third server recipe',
          }),
        ]}
      />,
    );

    const cards = screen.getAllByTestId(/recipe-card-/);
    expect(cards.map((node) => node.props.testID)).toEqual([
      'recipe-card-11111111-1111-4111-8111-111111111111',
      'recipe-card-22222222-2222-4222-8222-222222222222',
      'recipe-card-33333333-3333-4333-8333-333333333333',
    ]);
  });

  test('shows a loading skeleton', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading
        isError={false}
        isFetching={false}
        items={[]}
      />,
    );
    expect(screen.getByText('LAST UPLOADED')).toBeOnTheScreen();
    expect(screen.queryByText('No recipes yet')).toBeNull();
  });

  test('shows an error with retry', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading={false}
        isError
        isFetching={false}
        items={[]}
      />,
    );
    expect(screen.getByText(/couldn’t load this section/i)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test('keeps cached recipes visible with a stale indicator', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        title="LAST UPLOADED"
        emptyTitle="empty"
        emptyActionLabel="Add"
        isLoading={false}
        isError
        isFetching={false}
        fromCache
        layout="horizontal"
        onRetry={() => undefined}
        items={[
          listItem({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Cached soup',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Cached soup')).toBeOnTheScreen();
    expect(screen.getByTestId('stale-indicator')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test('loading skeleton uses the same section shell as content', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading
        isError={false}
        isFetching={false}
        items={[]}
      />,
    );
    expect(screen.getByTestId('home-section-LAST UPLOADED')).toBeOnTheScreen();
    expect(screen.getByTestId('content-skeleton-cards')).toBeOnTheScreen();
  });

  test('replaces the skeleton with recipe cards', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading={false}
        isError={false}
        isFetching={false}
        items={[
          listItem({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Loaded soup',
          }),
        ]}
      />,
    );
    expect(screen.getByTestId('home-section-LAST UPLOADED')).toBeOnTheScreen();
    expect(screen.queryByTestId('content-skeleton-cards')).toBeNull();
    expect(screen.getByText('Loaded soup')).toBeOnTheScreen();
  });

  test('shows the empty CTA', async () => {
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading={false}
        isError={false}
        isFetching={false}
        items={[]}
      />,
    );
    expect(screen.getByText('No recipes yet')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add your first recipe' }),
    ).toBeOnTheScreen();
  });

  test('retry remains immediate with reduced motion', async () => {
    usePreferencesStore.getState().setReduceMotion('reduce');
    const onRetry = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <HomeRecipeSection
        {...emptyProps}
        isLoading={false}
        isError
        isFetching={false}
        items={[]}
        onRetry={onRetry}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

import { useKitchenStore } from '@/stores/kitchen-store';
import { useShopStore } from '@/stores/shop-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { RecipeIngredientView } from '@/features/recipes/types';

describe('kitchen store', () => {
  beforeEach(() => {
    useKitchenStore.setState({
      inboxStatus: { 'seed:gnocchi': 'ready', 'seed:galette': 'needs_review' },
      savedIds: ['seed:harissa', 'seed:dal'],
      wantIds: ['seed:congee'],
      cookedCounts: { 'seed:dal': 2 },
      servingsByRecipe: {},
      recentSearches: [],
    });
  });

  test('confirmReviewed drops inbox and adds saved', () => {
    useKitchenStore.getState().confirmReviewed('seed:galette');
    const state = useKitchenStore.getState();
    expect(state.inboxStatus['seed:galette']).toBeUndefined();
    expect(state.savedIds).toContain('seed:galette');
  });

  test('setServings clamps between 1 and 12', () => {
    useKitchenStore.getState().setServings('seed:dal', 0);
    expect(useKitchenStore.getState().servingsByRecipe['seed:dal']).toBe(1);
    useKitchenStore.getState().setServings('seed:dal', 99);
    expect(useKitchenStore.getState().servingsByRecipe['seed:dal']).toBe(12);
  });
});

describe('shop store', () => {
  beforeEach(() => {
    useShopStore.setState({
      items: [
        {
          id: 'shop-lemon',
          name: 'Lemon',
          quantity: 2,
          unit: '',
          category: 'Produce',
          fromRecipeCount: 1,
          done: false,
        },
      ],
      shoppingMode: false,
    });
  });

  test('addIngredients merges by name', () => {
    const ings: RecipeIngredientView[] = [
      {
        id: '1',
        name: 'Lemon',
        quantity: 1,
        unit: '',
        optional: false,
        preparation: null,
        category: 'Produce',
        confidence: 1,
      },
      {
        id: '2',
        name: 'Basil',
        quantity: 1,
        unit: 'handful',
        optional: false,
        preparation: null,
        category: 'Produce',
        confidence: 1,
      },
    ];
    useShopStore.getState().addIngredients(ings, 'Test');
    const items = useShopStore.getState().items;
    const lemon = items.find((item) => item.name === 'Lemon');
    expect(lemon?.quantity).toBe(3);
    expect(lemon?.fromRecipeCount).toBe(2);
    expect(items.some((item) => item.name === 'Basil')).toBe(true);
  });
});

describe('preferences store', () => {
  test('reset restores defaults', () => {
    usePreferencesStore.getState().setDisplayName('Alex');
    usePreferencesStore.getState().completeOnboarding();
    usePreferencesStore.getState().reset();
    expect(usePreferencesStore.getState().displayName).toBe('Sam');
    expect(usePreferencesStore.getState().hasOnboarded).toBe(false);
  });
});

import { useKitchenStore } from '@/stores/kitchen-store';
import { useShopStore } from '@/stores/shop-store';
import { usePreferencesStore } from '@/stores/preferences-store';

describe('kitchen store', () => {
  beforeEach(() => {
    useKitchenStore.setState({
      inboxStatus: { 'seed:gnocchi': 'ready', 'seed:galette': 'needs_review' },
      savedIds: ['seed:harissa', 'seed:dal'],
      wantIds: ['seed:congee'],
      cookedCounts: { 'seed:dal': 2 },
      recipeNotes: {},
      servingsByRecipe: {},
      pendingSync: [],
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

  test('addCollection queues a collection.upsert for Agent 9', () => {
    useKitchenStore.getState().addCollection('Weeknights');
    const state = useKitchenStore.getState();
    expect(state.collections.some((item) => item.name === 'Weeknights')).toBe(
      true,
    );
    expect(
      state.pendingSync.some(
        (item) =>
          item.kind === 'collection.upsert' && item.status === 'pending',
      ),
    ).toBe(true);
  });

  test('addRecipeNote prepends trimmed notes per recipe', () => {
    useKitchenStore.getState().addRecipeNote('seed:dal', '  more heat  ');
    useKitchenStore.getState().addRecipeNote('seed:dal', '');
    useKitchenStore.getState().addRecipeNote('seed:dal', 'less lemon');
    const notes = useKitchenStore.getState().recipeNotes['seed:dal'] ?? [];
    expect(notes.map((note) => note.text)).toEqual(['less lemon', 'more heat']);
  });
});

describe('shop store', () => {
  test('does not seed a demo grocery list', () => {
    useShopStore.setState({ items: [], shoppingMode: false });
    expect(useShopStore.getState().items).toEqual([]);
    useShopStore.getState().addIngredients(
      [
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
      ],
      'Test',
    );
    expect(useShopStore.getState().items).toEqual([]);
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

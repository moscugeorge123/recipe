import {
  allVisibleSelected,
  bulkGroceryAdds,
  collectionMembership,
  grocerySelectionToast,
  shareSelectionToast,
  toggleSelection,
} from '@/tortie/data/selection';

describe('cookbook multi-select', () => {
  test('toggles in insertion order and exits on the last id', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleSelection(['a'], 'a')).toBeNull();
  });

  test('select all is about the visible list only', () => {
    expect(allVisibleSelected(['a', 'b', 'c'], ['a', 'b'])).toBe(true);
    expect(allVisibleSelected(['a'], ['a', 'b'])).toBe(false);
    expect(allVisibleSelected(['a'], [])).toBe(false);
  });

  test('collection membership is tri-state across the selection', () => {
    expect(collectionMembership(['a', 'b'], ['a', 'b'])).toBe('on');
    expect(collectionMembership(['a'], ['a', 'b'])).toBe('partial');
    expect(collectionMembership(['c'], ['a', 'b'])).toBe('off');
    expect(collectionMembership(['a'], [])).toBe('off');
  });

  test('groceries keys the name before the comma and dedupes the batch', () => {
    const add = bulkGroceryAdds(
      [
        {
          id: 'r1',
          title: 'Garlic Soup Tonight',
          ings: [
            { n: 'garlic, sliced', q: 2, u: 'cloves', category: 'Produce' },
            { n: 'olive oil', q: 1, u: 'tbsp', category: 'Pantry' },
          ],
        },
        {
          id: 'r2',
          title: 'Green Beans',
          ings: [
            { n: 'garlic', q: 1, u: 'clove', category: 'Produce' },
            { n: 'lemon', q: 1, u: null, category: 'Produce' },
          ],
        },
      ],
      ['Fresh garlic'],
    );
    expect(add.map((item) => item.name)).toEqual(['Olive oil', 'Lemon']);
    expect(add[0]).toMatchObject({
      quantity: 1,
      unit: 'tbsp',
      emoji: '🛒',
      sourceRecipeId: 'r1',
      category: 'Pantry',
    });
    expect(add[1]).toMatchObject({ sourceRecipeId: 'r2', emoji: '🛒' });
  });

  test('groceries skips a key that contains a name already on the list', () => {
    const add = bulkGroceryAdds(
      [
        {
          id: 'r1',
          title: 'Toast',
          ings: [{ n: 'sourdough', q: 1, u: 'slice', category: 'Bakery' }],
        },
      ],
      ['sour'],
    );
    expect(add).toEqual([]);
  });

  test('toasts match the handoff copy', () => {
    expect(grocerySelectionToast(0)).toBe('Already on your list');
    expect(grocerySelectionToast(3)).toBe('3 items added to groceries');
    expect(shareSelectionToast(1)).toBe('Link copied');
    expect(shareSelectionToast(2)).toBe('Links to 2 recipes copied');
  });
});
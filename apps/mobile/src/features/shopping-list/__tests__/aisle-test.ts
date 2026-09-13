import {
  AISLE_DISPLAY,
  formatGroceryQty,
  groupByAisle,
  shoppingListShareText,
} from '@/features/shopping-list/aisle';

describe('aisle display map', () => {
  test('maps stored categories to ReciMe aisle labels', () => {
    expect(AISLE_DISPLAY.Produce).toBe('Fresh Produce');
    expect(AISLE_DISPLAY.Meat).toBe('Meat & Seafood');
    expect(AISLE_DISPLAY.Spices).toBe('Herbs & Spices');
  });

  test('groups items by stored category and formats qty', () => {
    const groups = groupByAisle([
      { name: 'Lemon', category: 'Produce' },
      { name: 'Butter', category: 'Dairy' },
      { name: 'Mystery', category: null },
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      'Fresh Produce',
      'Dairy',
      'Pantry',
    ]);
    expect(formatGroceryQty(2, null)).toBe('2');
    expect(formatGroceryQty(200, 'g')).toBe('200 g');
    expect(formatGroceryQty(4, 'piece')).toBe('4');
    expect(formatGroceryQty(4, 'pieces')).toBe('4');
  });

  test('share text uses aisle labels without demo seeds', () => {
    const text = shoppingListShareText([
      {
        name: 'Lemon',
        quantity: 2,
        unit: null,
        category: 'Produce',
        done: false,
      },
    ]);
    expect(text).toContain('Fresh Produce');
    expect(text).toContain('Lemon — 2');
    expect(text).not.toContain('Onions');
  });
});

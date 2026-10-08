import { cookAgainList } from '@/tortie/data/cook-again';

describe('cookAgainList', () => {
  test('keeps only recipes that were cooked, most cooked first', () => {
    const again = cookAgainList([
      { id: 'udon', cooked: 0 },
      { id: 'soup', cooked: 1 },
      { id: 'dal', cooked: 3 },
    ]);
    expect(again.map((recipe) => recipe.id)).toEqual(['dal', 'soup']);
  });

  test('is empty when nothing has been cooked', () => {
    expect(cookAgainList([{ id: 'udon', cooked: 0 }])).toEqual([]);
  });
});

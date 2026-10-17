import {
  convertAmount,
  ingredientAmount,
  preferUnits,
  scaleStepText,
} from '@/features/recipes/units';

describe('metric never keeps spoons or pounds (Q34)', () => {
  test.each([
    [1, 'tsp', 5, 'ml'],
    [0.5, 'tsp', 2.5, 'ml'],
    [1, 'tbsp', 15, 'ml'],
    [2, 'tbsp', 30, 'ml'],
    [1, 'cup', 235, 'ml'],
    [4, 'oz', 115, 'g'],
    [2, 'lb', 905, 'g'],
    [8, 'fl oz', 235, 'ml'],
    [1, 'stick', 115, 'g'],
  ] as const)('%d %s → metric', (quantity, unit, q, u) => {
    expect(convertAmount(quantity, unit, 'metric')).toEqual({
      quantity: q,
      unit: u,
    });
  });

  test.each(['tbs', 'Tbsp.', 'T', 'table spoon', 'TBSP'])(
    'alias %s resolves to a tablespoon',
    (alias) => {
      expect(convertAmount(1, alias, 'metric')).toEqual({
        quantity: 15,
        unit: 'ml',
      });
    },
  );

  test.each([
    ['t', 5],
    ['tsp.', 5],
    ['c', 235],
    ['lbs.', 455],
  ])('alias %s converts', (alias, q) => {
    expect(convertAmount(1, alias, 'metric').quantity).toBe(q);
  });

  test('imperial converts metric the other way and keeps native units', () => {
    expect(convertAmount(15, 'ml', 'imperial')).toEqual({
      quantity: 1,
      unit: 'tbsp',
    });
    expect(convertAmount(2, 'tbsp', 'imperial')).toEqual({
      quantity: 2,
      unit: 'tbsp',
    });
  });

  test('uncountable units pass through unchanged', () => {
    for (const unit of ['pinch', 'clove', 'to taste', 'piece']) {
      expect(convertAmount(1, unit, 'metric')).toEqual({ quantity: 1, unit });
    }
  });

  test('an API metric view that still carries a spoon is converted', () => {
    expect(
      ingredientAmount(
        {
          quantity: 2,
          unit: 'tbsp',
          metric: { quantity: 2, unit: 'tbsp' },
          imperial: { quantity: 2, unit: 'tbsp' },
        },
        'metric',
      ),
    ).toEqual({ quantity: 30, unit: 'ml' });
  });
});

describe('mass and volume amounts in step text (Q16)', () => {
  const text =
    'Put 100g (3.53 oz) flour, 300ml (10.14 fl oz) milk and 2 tbsp (30ml) oil in a bowl.';

  test('pairs collapse to the preferred system', () => {
    expect(preferUnits(text, 'metric')).toBe(
      'Put 100g flour, 300ml milk and 30 ml oil in a bowl.',
    );
    expect(preferUnits(text, 'imperial')).toBe(
      'Put 3½ oz flour, 10 fl oz milk and 2 tbsp oil in a bowl.',
    );
  });

  test('lone amounts convert; words and counts are left alone', () => {
    expect(
      preferUnits('Add 1 lb beef and 2 eggs, 3 large onions.', 'metric'),
    ).toBe('Add 455 g beef and 2 eggs, 3 large onions.');
    expect(
      preferUnits('Add 200 g beef to 1 egg in a gram pan', 'imperial'),
    ).toBe('Add 7 oz beef to 1 egg in a gram pan');
  });

  test('ranges convert together', () => {
    expect(preferUnits('Add 2-3 tbsp water.', 'metric')).toBe(
      'Add 30–44 ml water.',
    );
  });

  test('scaleStepText multiplies amounts, not counts or times', () => {
    expect(
      scaleStepText(
        'Mix 200 g flour, 2 eggs and ½ cup milk for 10 minutes.',
        0.5,
      ),
    ).toBe('Mix 100 g flour, 2 eggs and ¼ cup milk for 10 minutes.');
    expect(scaleStepText('Add 2 tbsp oil.', 3)).toBe('Add 6 tbsp oil.');
    expect(scaleStepText('Add 2-3 cups.', 2)).toBe('Add 4-6 cups.');
    expect(scaleStepText('Add 200 g.', 1)).toBe('Add 200 g.');
  });
});

import {
  convertAmount,
  ingredientAmount,
  preferUnits,
  stepHeat,
} from '@/features/recipes/units';

describe('ingredientAmount', () => {
  const flour = {
    quantity: 1.5,
    unit: 'cup',
    metric: { quantity: 180, unit: 'g' },
    imperial: { quantity: 1.5, unit: 'cup' },
  };

  test('uses the API amount for the chosen system', () => {
    expect(ingredientAmount(flour, 'metric')).toEqual({
      quantity: 180,
      unit: 'g',
    });
    expect(ingredientAmount(flour, 'imperial')).toEqual({
      quantity: 1.5,
      unit: 'cup',
    });
  });

  test('converts locally when the API sent no measurements', () => {
    expect(ingredientAmount({ quantity: 4, unit: 'oz' }, 'metric')).toEqual({
      quantity: 115,
      unit: 'g',
    });
    expect(
      ingredientAmount(
        { quantity: 250, unit: 'ml', metric: null, imperial: null },
        'imperial',
      ),
    ).toEqual({ quantity: 1, unit: 'cup' });
  });

  test('keeps counts as written', () => {
    expect(
      ingredientAmount(
        {
          quantity: 2,
          unit: 'cloves',
          metric: { quantity: 2, unit: 'cloves' },
          imperial: { quantity: 2, unit: 'cloves' },
        },
        'imperial',
      ),
    ).toEqual({ quantity: 2, unit: 'cloves' });
    expect(ingredientAmount({ quantity: 3, unit: null }, 'imperial')).toEqual({
      quantity: 3,
      unit: null,
    });
  });
});

describe('convertAmount', () => {
  test.each([
    [200, 'g', 'imperial', 7, 'oz'],
    [500, 'g', 'imperial', 1, 'lb'],
    [1, 'lb', 'metric', 455, 'g'],
    [3, 'lb', 'metric', 1.35, 'kg'],
    [1, 'cup', 'metric', 235, 'ml'],
    [5, 'ml', 'imperial', 1, 'tsp'],
    [30, 'ml', 'imperial', 2, 'tbsp'],
    [1, 'litre', 'imperial', 4.25, 'cup'],
  ] as const)('%d %s → %s', (quantity, unit, system, q, u) => {
    expect(convertAmount(quantity, unit, system)).toEqual({
      quantity: q,
      unit: u,
    });
  });

  test('leaves spoons, counts, unknown units and missing amounts alone', () => {
    expect(convertAmount(2, 'tbsp', 'metric')).toEqual({
      quantity: 2,
      unit: 'tbsp',
    });
    expect(convertAmount(1, 'pinch', 'imperial')).toEqual({
      quantity: 1,
      unit: 'pinch',
    });
    expect(convertAmount(null, 'g', 'imperial')).toEqual({
      quantity: null,
      unit: 'g',
    });
  });
});

describe('stepHeat', () => {
  test('shows the preferred scale, falling back to the step text', () => {
    const step = {
      temperature: '180°C',
      temperatureCelsius: 180,
      temperatureFahrenheit: 350,
    };
    expect(stepHeat(step, 'metric')).toBe('180°C');
    expect(stepHeat(step, 'imperial')).toBe('350°F');
    expect(stepHeat({ temperature: 'medium heat' }, 'imperial')).toBe(
      'medium heat',
    );
    expect(stepHeat({ temperature: null }, 'metric')).toBe('');
  });
});

describe('preferUnits', () => {
  test('puts the preferred system first in dual measurements', () => {
    const text = 'Bake at 180°C (350°F), then cut into 2 cm (¾ in) cubes.';
    expect(preferUnits(text, 'metric')).toBe(text);
    expect(preferUnits(text, 'imperial')).toBe(
      'Bake at 350°F (180°C), then cut into ¾ in (2 cm) cubes.',
    );
    expect(preferUnits('Preheat to 425°F (220°C).', 'metric')).toBe(
      'Preheat to 220°C (425°F).',
    );
    expect(preferUnits('Slice into 1-inch (2.5 cm) pieces', 'metric')).toBe(
      'Slice into 2.5 cm (1-inch) pieces',
    );
  });

  test('leaves text without pairs untouched', () => {
    const text = 'Cook 2 in a pan (covered) for 10 minutes.';
    expect(preferUnits(text, 'imperial')).toBe(text);
  });
});

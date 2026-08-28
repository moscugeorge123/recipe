import { formatTimer, parseIngredientHint } from '@/features/cook/parse-hint';

describe('parseIngredientHint', () => {
  test('splits quantity and name', () => {
    expect(parseIngredientHint('90 g Pistachios')).toEqual([
      { qty: '90 g', name: 'Pistachios' },
    ]);
  });

  test('splits pipe-separated chips', () => {
    expect(parseIngredientHint('2 Garlic cloves|3 tbsp Olive oil')).toEqual([
      { qty: '2', name: 'Garlic cloves' },
      { qty: '3 tbsp', name: 'Olive oil' },
    ]);
  });

  test('returns empty for null', () => {
    expect(parseIngredientHint(null)).toEqual([]);
  });
});

describe('formatTimer', () => {
  test('pads seconds', () => {
    expect(formatTimer(125)).toBe('2:05');
    expect(formatTimer(0)).toBe('0:00');
  });
});

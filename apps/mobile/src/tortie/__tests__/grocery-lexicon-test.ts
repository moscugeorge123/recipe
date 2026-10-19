import { AISLES, emoOf, lexOf, noAmountLabel } from '@/tortie/lib/fmt';

describe('grocery lexicon', () => {
  test('black pepper and plain pepper are spices, not produce', () => {
    expect(lexOf('Black pepper')?.[2]).toBe(3);
    expect(lexOf('Pepper')?.[2]).toBe(3);
    expect(lexOf('Pepper')?.[1]).not.toBe('🌶️');
  });
  test('bell pepper stays produce', () => {
    expect(lexOf('Red bell pepper')?.[2]).toBe(0);
  });
  test('radish and jicama are produce with a root emoji', () => {
    const L = lexOf('Red radish or jicama');
    expect(L?.[2]).toBe(0);
    expect(L?.[1]).toBe('🥕');
  });
  test('oils and vinegar get their own aisle, not Dry goods', () => {
    expect(AISLES[emoOf('Olive oil').aisle]).toBe('Oils & condiments');
    expect(AISLES[emoOf('Red wine vinegar').aisle]).toBe('Oils & condiments');
  });
  test('lemon wedges keep the lemon emoji', () => {
    expect(lexOf('Lemon wedges')?.[1]).toBe('🍋');
  });
});

describe('noAmountLabel', () => {
  test('seasonings are to taste, others as needed', () => {
    expect(noAmountLabel('Salt')).toBe('to taste');
    expect(noAmountLabel('Olive oil')).toBe('to taste');
    expect(noAmountLabel('Parmesan')).toBe('as needed');
  });
});

import { blankDraft } from '@/tortie/data/editor-draft';
import { openingServings } from '@/tortie/data/recipe-ui';
import { ingQty, type TIng } from '@/tortie/data/recipes';
import { useTortiePrefs } from '@/tortie/prefs-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('@/tortie/nav-store', () => ({
  useNav: { getState: () => ({ closeEditor: jest.fn() }) },
}));

const ing = (q: number | null, u: string): TIng => ({
  q,
  u,
  n: 'x',
  emo: '',
  tint: '',
});

describe('default servings (Q33)', () => {
  test('a recipe opens at the default unless the user picked a count', () => {
    expect(openingServings(undefined, 2, 12)).toBe(2);
    expect(openingServings(undefined, 4, 6)).toBe(4);
    expect(openingServings(8, 2, 12)).toBe(8);
    expect(openingServings(undefined, undefined, 12)).toBe(12);
    expect(openingServings(undefined, 20, 12)).toBe(12);
  });

  test('a new recipe starts at the default servings', () => {
    useTortiePrefs.getState().set({ defaultServings: 4 });
    expect(blankDraft().base).toBe(4);
    useTortiePrefs.getState().set({ defaultServings: 2 });
    expect(blankDraft().base).toBe(2);
    expect(blankDraft(6).base).toBe(6);
  });

  test('scaling 12 → 2 keeps whole items sensible and scales weights', () => {
    const scale = 2 / 12;
    expect(ingQty(ing(2, ''), scale)).toBe('½');
    expect(ingQty(ing(1, ''), scale)).toBe('½');
    expect(ingQty(ing(6, ''), scale)).toBe('1');
    expect(ingQty(ing(12, ''), scale)).toBe('2');
    expect(ingQty(ing(100, 'g'), scale)).toBe('17 g');
    expect(ingQty(ing(3, 'clove'), 2)).toBe('6 clove');
    expect(ingQty(ing(null, 'to taste'), scale)).toBe('to taste');
    expect(ingQty(ing(6, 'tbsp'), 0.5)).toBe('3 tbsp');
  });
});

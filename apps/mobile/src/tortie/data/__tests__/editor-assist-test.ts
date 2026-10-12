import {
  FIELD_MARK,
  fromAssistDraft,
  toAssistDraft,
  type Draft,
} from '@/tortie/data/editor-draft';

const base: Draft = {
  id: 'r1',
  isNew: false,
  title: 'Garlic butter pasta',
  desc: 'Weeknight pasta.',
  level: 'Easy',
  base: 2,
  time: 20,
  ings: [
    { k: 'i0', txt: '200 g spaghetti', src: 0 },
    { k: 'i1', txt: '2 tbsp butter', src: 1 },
    { k: 'n1', txt: '  ' },
  ],
  steps: [
    {
      k: 's0',
      t: 'Boil',
      d: 'Cook the pasta.',
      m: 10,
      auto: false,
      det: null,
      ahead: false,
      src: 0,
    },
    {
      k: 's1',
      t: 'Toss',
      d: 'Melt the butter and toss.',
      m: 2,
      auto: false,
      det: null,
      ahead: false,
      src: 1,
    },
  ],
};

describe('Ask Tortie draft mapping', () => {
  test('sends row keys as ids and skips empty rows', () => {
    const out = toAssistDraft(base);
    expect(out.ingredients).toEqual([
      { id: 'i0', text: '200 g spaghetti' },
      { id: 'i1', text: '2 tbsp butter' },
    ]);
    expect(out.steps.map((s) => s.id)).toEqual(['s0', 's1']);
    expect(out).toMatchObject({
      servings: 2,
      totalMinutes: 20,
      difficulty: 'Easy',
    });
  });

  test('round-trips with no changes', () => {
    const { changed } = fromAssistDraft(base, toAssistDraft(base));
    expect(changed).toEqual([]);
  });

  test('marks edited, added and field changes; keeps untouched rows as-is', () => {
    const out = toAssistDraft(base);
    const { next, changed } = fromAssistDraft(base, {
      ...out,
      servings: 4,
      ingredients: [
        out.ingredients[0]!,
        { id: 'i1', text: '2 tbsp olive oil' },
        { id: null, text: '2 cloves garlic, sliced' },
      ],
      steps: [
        out.steps[0]!,
        { ...out.steps[1]!, body: 'Warm the oil with the garlic and toss.' },
      ],
    });

    expect(next.ings[0]).toBe(base.ings[0]);
    expect(next.ings[1]).toEqual({ k: 'i1', txt: '2 tbsp olive oil', src: 1 });
    const added = next.ings[2]!;
    expect(added.src).toBeUndefined();
    expect(next.steps[0]).toBe(base.steps[0]);
    expect(next.steps[1]).toMatchObject({
      k: 's1',
      src: 1,
      d: 'Warm the oil with the garlic and toss.',
    });
    expect(next.base).toBe(4);
    expect(changed.sort()).toEqual(
      [FIELD_MARK.base, 'i1', added.k, 's1'].sort(),
    );
  });

  test('ignores an unknown difficulty and whitespace-only title changes', () => {
    const { next, changed } = fromAssistDraft(
      { ...base, title: ' Garlic butter pasta ' },
      { ...toAssistDraft(base), difficulty: 'Weekend' },
    );
    expect(next.level).toBe('Easy');
    expect(next.title).toBe(' Garlic butter pasta ');
    expect(changed).toEqual([]);
  });
});

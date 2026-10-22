import { inheritHeadings } from '@/tortie/data/editor-draft';
import { sectionsOf } from '@/tortie/data/recipes';

jest.mock('@/tortie/nav-store', () => ({
  useNav: { getState: () => ({ closeEditor: jest.fn() }) },
}));

describe('sectionsOf', () => {
  test('splits a layered cake into consecutive headed runs', () => {
    const ings = [
      { n: 'Eggs', g: 'For the sponge' },
      { n: 'Sugar', g: 'For the sponge' },
      { n: 'Butter', g: 'For the cream' },
      { n: 'Walnuts', g: 'For the filling' },
    ];
    const out = sectionsOf(ings, (x) => x.g);
    expect(out.map((s) => s.head)).toEqual([
      'For the sponge',
      'For the cream',
      'For the filling',
    ]);
    // Rows keep their index in the full list, so step refs and notes still line up.
    expect(out[1]!.rows).toEqual([{ x: ings[2], i: 2 }]);
  });

  test('a list without headings is one headless run', () => {
    const out = sectionsOf(['a', 'b'], () => null);
    expect(out).toEqual([
      {
        head: null,
        rows: [
          { x: 'a', i: 0 },
          { x: 'b', i: 1 },
        ],
      },
    ]);
  });
});

describe('inheritHeadings', () => {
  test('a row added in the editor joins the section above it', () => {
    expect(
      inheritHeadings([
        'Make the sponge',
        undefined,
        'Make the cream',
        undefined,
      ]),
    ).toEqual([
      'Make the sponge',
      'Make the sponge',
      'Make the cream',
      'Make the cream',
    ]);
  });

  test('a row added first joins the section below it', () => {
    expect(inheritHeadings([undefined, 'For the sponge'])).toEqual([
      'For the sponge',
      'For the sponge',
    ]);
  });

  test('a recipe without sections stays without', () => {
    expect(inheritHeadings([undefined, null, undefined])).toEqual([
      null,
      null,
      null,
    ]);
  });
});

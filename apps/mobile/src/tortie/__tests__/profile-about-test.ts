import {
  aboutLinks,
  appLanguageOptions,
  recipeLanguageOptions,
} from '@/tortie/screens/profile';

describe('aboutLinks', () => {
  test('shows only the version when no links are configured', () => {
    expect(aboutLinks('1.2.3', {})).toEqual([
      { icon: 'notes', label: 'Version', sub: '1.2.3' },
    ]);
  });

  test('adds configured links', () => {
    const rows = aboutLinks('1.0.0', {
      terms: 'https://t',
      support: 'mailto:a@b.c',
    });
    expect(rows.map((r) => r.label)).toEqual(['Version', 'Terms', 'Support']);
  });
});

describe('language options', () => {
  test('app languages start with the device option', () => {
    const o = appLanguageOptions('Device');
    expect(o[0]).toEqual({ value: 'system', label: 'Device' });
    expect(o.find((x) => x.value === 'ro')?.label).toBe('Română');
  });

  test('recipe languages start with the as-saved option and list all 11', () => {
    const o = recipeLanguageOptions('As saved');
    expect(o[0]).toEqual({ value: 'original', label: 'As saved' });
    expect(o).toHaveLength(12);
  });
});

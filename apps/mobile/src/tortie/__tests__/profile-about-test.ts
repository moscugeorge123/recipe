import { aboutLinks } from '@/tortie/screens/profile';

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

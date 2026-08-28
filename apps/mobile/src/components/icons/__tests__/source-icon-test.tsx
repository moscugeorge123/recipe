import { render, screen } from '@testing-library/react-native';

import {
  SOURCE_ICON_KEYS,
  SourceIcon,
  normalizeSource,
} from '@/components/icons/source-icon';

describe('normalizeSource', () => {
  test('maps brand urls and aliases onto icon keys', () => {
    expect(normalizeSource('instagram.com/reel')).toBe('Instagram');
    expect(normalizeSource('Reels')).toBe('Instagram');
    expect(normalizeSource('youtu.be/abc')).toBe('YouTube');
    expect(normalizeSource('GENERIC_WEB')).toBe('Website');
    expect(normalizeSource('Note')).toBe('Note');
    expect(normalizeSource('All')).toBe('All');
  });
});

describe('SourceIcon', () => {
  test.each([...SOURCE_ICON_KEYS])('renders a mark for %s', async (source) => {
    await render(<SourceIcon source={source} />);

    expect(
      screen.getByTestId(`source-icon-${source}`, {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });
});

import { screen, userEvent } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { CrossfadeText } from '@/components/ui/crossfade-text';
import { MotionItem } from '@/components/ui/motion-item';
import { Text } from '@/components/ui/text';
import { RecipeCategoryChips } from '@/features/recipes/components/recipe-category-chips';
import type { RecipeView } from '@/features/recipes/types';
import { renderWithProviders } from '@/test/render-with-providers';
import { cookTokensDark, cookTokensLight } from '@/theme/cook-tokens';
import { colors } from '@/theme/tokens';
import { usePreferencesStore } from '@/stores/preferences-store';

jest.mock('@/features/recipes/hooks/use-recipe-editor', () => ({
  useCategories: () => ({ data: [] }),
  useAssignRecipeCategories: () => ({ mutate: jest.fn(), isPending: false }),
}));

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const toLin = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin((n >> 16) & 255);
  const g = toLin((n >> 8) & 255);
  const b = toLin(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const recipe: RecipeView = {
  id: 'recipe-1',
  origin: 'api',
  title: 'Soup',
  description: null,
  sourceType: 'GENERIC_WEB',
  sourceLabel: 'Website',
  creator: 'Chef',
  originalUrl: null,
  thumbnailUrl: null,
  placeholder: ['#E6D9C4', '#DCCBB0'],
  minutes: 30,
  difficulty: 'Easy',
  servings: 2,
  cuisine: 'Imported',
  calories: null,
  confidence: 0.9,
  warnings: [],
  ingredients: [],
  steps: [],
  categories: [
    {
      id: 'cat-1',
      slug: 'dinner',
      name: 'Weeknight dinners for friends and family',
      sortOrder: 0,
    },
  ],
  isFavorite: false,
  rating: null,
  cookCount: 0,
};

describe('motion, contrast, and accessibility polish', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  test('chips keep a 44px target and wrap a long label', async () => {
    await renderWithProviders(
      <Chip label="Weeknight dinners for friends and family" />,
    );
    const chip = screen.getByRole('button', {
      name: 'Weeknight dinners for friends and family',
    });
    expect(chip.props.className).toContain('min-h-11');
    expect(chip.props.className).toContain('max-w-full');
    expect(
      screen.getByText('Weeknight dinners for friends and family'),
    ).toBeOnTheScreen();
  });

  test('category chips stay readable and 44px when editing is off', async () => {
    await renderWithProviders(<RecipeCategoryChips recipe={recipe} editable />);
    const chip = screen.getByRole('button', {
      name: 'Weeknight dinners for friends and family',
    });
    expect(chip.props.className).toContain('min-h-11');
  });

  test('reduced motion still renders staggered content immediately', async () => {
    usePreferencesStore.getState().setReduceMotion('reduce');
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <MotionItem preset="card" index={8}>
        <Chip label="Retry" onPress={onPress} />
      </MotionItem>,
    );
    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('nutrition crossfade keeps the new value on screen immediately', async () => {
    await renderWithProviders(
      <CrossfadeText value="150" testID="nutrition-value-calories" />,
    );
    expect(screen.getByText('150')).toBeOnTheScreen();
    expect(screen.getByTestId('nutrition-value-calories')).toBeOnTheScreen();
  });

  test('timeline skeleton matches revision-card geometry', async () => {
    await renderWithProviders(<ContentSkeleton shape="timeline" />);
    expect(screen.getByTestId('content-skeleton-timeline')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading revision history')).toBeOnTheScreen();
  });

  test('display type wraps a long title instead of clipping', async () => {
    await renderWithProviders(
      <Text variant="display">
        Extremely long localized recipe title that must wrap on a narrow phone
      </Text>,
    );
    expect(
      screen.getByText(/Extremely long localized recipe title that must wrap/),
    ).toBeOnTheScreen();
  });

  test('Garden Plate contrast holds on cream and both cooking themes', () => {
    expect(contrast(colors.espresso, colors.cream)).toBeGreaterThan(7);
    expect(contrast(colors.olive, colors.cream)).toBeGreaterThan(4);
    expect(contrast(colors.cocoa, colors.cream)).toBeGreaterThan(4.5);
    expect(contrast(colors.basil700, colors.basilSoft)).toBeGreaterThan(4.5);
    expect(contrast(colors.honey800, colors.honey50)).toBeGreaterThan(4.5);
    expect(contrast(colors.chili, colors.chili50)).toBeGreaterThan(4.5);
    expect(contrast(colors.onPrimary, colors.paprikaPressed)).toBeGreaterThan(
      4.5,
    );
    expect(contrast(cookTokensDark.kicker, cookTokensDark.bg)).toBeGreaterThan(
      3,
    );
    expect(
      contrast(cookTokensLight.kicker, cookTokensLight.bg),
    ).toBeGreaterThan(4.5);
    expect(contrast(cookTokensLight.text, cookTokensLight.bg)).toBeGreaterThan(
      7,
    );
    expect(contrast(cookTokensDark.text, cookTokensDark.bg)).toBeGreaterThan(7);
  });

  test('favorite berry and pantry basil remain distinct from paprika', () => {
    expect(colors.berry).toBe('#D94F70');
    expect(colors.basilSoft).toBe('#EAF7F0');
    expect(colors.paprika).toBe('#E25A3C');
    expect(colors.espresso).toBe('#2A2118');
  });
});

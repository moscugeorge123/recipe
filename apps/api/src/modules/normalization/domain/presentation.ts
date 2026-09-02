import { categorizeIngredient, isIngredientCategory } from './presentation-heuristics.js';

export const GARDEN_PLATE_COLOR_TOKENS = [
  'paprikaSoft',
  'basilSoft',
  'honey50',
  'peach',
  'linen',
  'steamedMilk',
  'chili50',
] as const;

export type GardenPlateColorToken = (typeof GARDEN_PLATE_COLOR_TOKENS)[number];

export const COLOR_TOKEN_SET: ReadonlySet<string> = new Set(GARDEN_PLATE_COLOR_TOKENS);

export const PANTRY_PRESENTATION = { emoji: '🥣', colorToken: 'peach' as const };

export const CATEGORY_PRESENTATION: Record<
  string,
  { emoji: string; colorToken: GardenPlateColorToken }
> = {
  Produce: { emoji: '🥬', colorToken: 'basilSoft' },
  Meat: { emoji: '🍗', colorToken: 'paprikaSoft' },
  Dairy: { emoji: '🥛', colorToken: 'steamedMilk' },
  Pantry: PANTRY_PRESENTATION,
  Spices: { emoji: '🌶️', colorToken: 'chili50' },
  Frozen: { emoji: '🧊', colorToken: 'honey50' },
};

export function isOneEmoji(value: string | null | undefined): value is string {
  if (!value || !/\p{Extended_Pictographic}/u.test(value)) return false;
  return (
    [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length === 1
  );
}

export function isGardenPlateColorToken(value: string | null | undefined): value is GardenPlateColorToken {
  return typeof value === 'string' && COLOR_TOKEN_SET.has(value);
}

/**
 * Shared import + pantry presentation. Model emoji/color are used when valid;
 * grocery-category fallbacks remain authoritative.
 */
export function resolveIngredientPresentation(input: {
  name: string;
  category?: string | null | undefined;
  emoji?: string | null | undefined;
  colorToken?: string | null | undefined;
}): { category: string; emoji: string; colorToken: GardenPlateColorToken } {
  const category = isIngredientCategory(input.category)
    ? input.category
    : categorizeIngredient(input.name);
  const fallback = CATEGORY_PRESENTATION[category] ?? PANTRY_PRESENTATION;
  return {
    category,
    emoji: isOneEmoji(input.emoji) ? input.emoji : fallback.emoji,
    colorToken: isGardenPlateColorToken(input.colorToken) ? input.colorToken : fallback.colorToken,
  };
}

/** Common unit normalisation map (abbreviation → canonical). */
export const UNIT_MAP: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  pinch: 'pinch',
  clove: 'clove',
  cloves: 'clove',
  slice: 'slice',
  slices: 'slice',
  piece: 'piece',
  pieces: 'piece',
};

/** Romanian unit aliases. */
export const ROMANIAN_UNIT_MAP: Record<string, string> = {
  lingura: 'tbsp',
  linguri: 'tbsp',
  lingurita: 'tsp',
  lingurite: 'tsp',
  cana: 'cup',
  cani: 'cup',
  grame: 'g',
};

/** Common ingredient name normalisation. */
export const INGREDIENT_ALIASES: Record<string, string> = {
  'olive oil': 'olive oil',
  ulei: 'olive oil',
  'ulei de masline': 'olive oil',
  garlic: 'garlic',
  usturoi: 'garlic',
  spaghetti: 'spaghetti',
  paste: 'pasta',
  pasta: 'pasta',
  salt: 'salt',
  sare: 'salt',
  pepper: 'black pepper',
  piper: 'black pepper',
  onion: 'onion',
  ceapa: 'onion',
  flour: 'all-purpose flour',
  faina: 'all-purpose flour',
  sugar: 'sugar',
  zahar: 'sugar',
  butter: 'butter',
  unt: 'butter',
  milk: 'milk',
  lapte: 'milk',
  egg: 'egg',
  eggs: 'egg',
  ou: 'egg',
  oua: 'egg',
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase().trim();
  return ROMANIAN_UNIT_MAP[lower] ?? UNIT_MAP[lower] ?? lower;
}

export function normalizeIngredientName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return INGREDIENT_ALIASES[lower] ?? lower;
}

const UNICODE_FRACTION_VALUES: Record<string, number> = {
  '½': 1 / 2,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

const QUANTITY_PATTERN =
  /(?:(\d+(?:\.\d+)?)\s+)?(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])|(\d+(?:\.\d+)?)/;

/** First amount in a quantity phrase: "1 1/2" → 1.5, "1½" → 1.5, "2-3" → 2, "0,5" → 0.5. */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const text = raw.replace(/(\d),(\d)/g, '$1.$2');
  const match = QUANTITY_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  if (match[2] !== undefined && match[3] !== undefined) {
    const whole = match[1] !== undefined ? Number(match[1]) : 0;
    const den = Number(match[3]);
    return den === 0 ? null : whole + Number(match[2]) / den;
  }
  if (match[5] !== undefined) {
    const whole = match[4] !== undefined ? Number(match[4]) : 0;
    return whole + (UNICODE_FRACTION_VALUES[match[5]] ?? 0);
  }
  const parsed = Number(match[6]);
  return Number.isFinite(parsed) ? parsed : null;
}

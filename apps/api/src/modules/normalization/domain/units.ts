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

export function parseQuantity(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/[^\d./]/g, '').trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.includes('/')) {
    const [num, den] = cleaned.split('/');
    const n = Number(num);
    const d = Number(den);
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) {
      return n / d;
    }
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

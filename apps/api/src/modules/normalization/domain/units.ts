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
  г: 'g',
  гр: 'g',
  кг: 'kg',
  мл: 'ml',
  л: 'l',
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
  buc: 'piece',
  bucata: 'piece',
  bucati: 'piece',
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

/** "Lemons" and "Lemon" share one name. Only the last word is singularized. */
export function singularizePhrase(raw: string): string {
  const parts = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const last = parts.length - 1;
  parts[last] = singularizeWord(parts[last] ?? '');
  return parts.join(' ');
}

function singularizeWord(word: string): string {
  if (word.length <= 3 || word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) {
    return word;
  }
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes') || word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Plural of a canonical name, so an older "lemons" row still matches "lemon". */
export function pluralizePhrase(raw: string): string {
  const parts = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const last = parts.length - 1;
  const word = parts[last] ?? '';
  if (word.endsWith('y') && word.length > 2 && !/[aeiou]y$/.test(word)) {
    parts[last] = word.slice(0, -1) + 'ies';
  } else if (/(?:s|x|z|ch|sh|o)$/.test(word)) {
    parts[last] = word + 'es';
  } else {
    parts[last] = word + 's';
  }
  return parts.join(' ');
}

export function normalizeIngredientName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const singular = singularizePhrase(lower);
  return INGREDIENT_ALIASES[lower] ?? INGREDIENT_ALIASES[singular] ?? singular;
}

/** Singular key first, then the plural form an older row may still be stored under. */
export function canonicalNameKeys(raw: string): string[] {
  const canonical = normalizeIngredientName(raw);
  const plural = pluralizePhrase(canonical);
  return plural === canonical ? [canonical] : [canonical, plural];
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

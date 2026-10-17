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

/**
 * Name shown on a list row. A bare noun is singularized ("Lemons" -> "lemon");
 * a phrase keeps the words as written ("Lemon wedges" stays plural), since
 * the last word is often a cut or form, not the thing being counted.
 */
export function displayNameForm(raw: string): string {
  const parts = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.join(' ') : singularizePhrase(raw);
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

const AMOUNT =
  String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d*(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?`;
const PHRASE_PATTERN = new RegExp(
  String.raw`^(${AMOUNT})(?:\s*(?:-|–|—|to|or)\s*(${AMOUNT}))?\s*(.*)$`,
  'i',
);
const LEADING_APPROX = /^(?:about|approx\.?|approximately|around|roughly|circa|~)\s*/i;
/** Extra unit words the phrase splitter accepts beyond UNIT_MAP (kept in their own spelling). */
const EXTRA_PHRASE_UNITS = new Map<string, string>([
  ['dl', 'dl'],
  ['cl', 'cl'],
  ['fl oz', 'fl oz'],
  ['floz', 'fl oz'],
  ['pint', 'pint'],
  ['pints', 'pint'],
  ['quart', 'quart'],
  ['quarts', 'quart'],
  ['handful', 'handful'],
  ['handfuls', 'handful'],
  ['bunch', 'bunch'],
  ['bunches', 'bunch'],
  ['sprig', 'sprig'],
  ['sprigs', 'sprig'],
  ['stick', 'stick'],
  ['sticks', 'stick'],
  ['can', 'can'],
  ['cans', 'can'],
  ['dash', 'dash'],
  ['dashes', 'dash'],
]);

export interface QuantityPhrase {
  /** Lower bound (or the only amount). Null for a bare unit word such as "a pinch". */
  min: number | null;
  /** Upper bound of a range ("2 to 4"), else null. */
  max: number | null;
  /** Canonical unit word found in the phrase (English map), else null. */
  unit: string | null;
  /** The unit word as written, for non-English recipes that keep the source spelling. */
  unitText: string | null;
}

function lookupPhraseUnit(raw: string): string | null {
  const word = raw.toLowerCase().trim().replace(/\.$/, '');
  if (!word) return null;
  return UNIT_MAP[word] ?? ROMANIAN_UNIT_MAP[word] ?? EXTRA_PHRASE_UNITS.get(word) ?? null;
}

/**
 * Splits a quantity phrase the model may have filled with more than a number:
 * "1/4 teaspoon", "1½ cups", "2 to 4 tablespoons", "2–4", "1 or 2", "about 3", "a pinch".
 * Anything after the amount that is not a known unit word is ignored.
 */
export function splitQuantityPhrase(raw: string | null | undefined): QuantityPhrase {
  const empty: QuantityPhrase = { min: null, max: null, unit: null, unitText: null };
  if (!raw) return empty;
  const text = raw.trim().replace(LEADING_APPROX, '').replace(/^an?\s+/i, '');
  const match = PHRASE_PATTERN.exec(text);
  if (!match?.[1]) {
    const bare = lookupPhraseUnit(text);
    return bare ? { min: null, max: null, unit: bare, unitText: text.trim() } : empty;
  }
  const min = parseQuantity(match[1]);
  let max = match[2] ? parseQuantity(match[2]) : null;
  if (min === null) return empty;
  if (max !== null && max <= min) max = null;
  const unitText = (match[3] ?? '').trim();
  const unit = lookupPhraseUnit(unitText);
  return { min, max, unit, unitText: unit ? unitText : null };
}

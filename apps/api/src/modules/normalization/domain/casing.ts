/** Capitalizes the first character and lowercases the rest: "wholemeal pitta" → "Wholemeal pitta". */
export function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lower = trimmed.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);
const SITE_SUFFIX_WORDS =
  /\.(?:com|net|org|co|uk|io)\b|\b(?:bbc|good food|recipes?|kitchen|cooking|eats|food|delish|allrecipes|taste|epicurious|cookbook)\b/i;

function letterStats(text: string): { letters: number; upper: number } {
  const letters = text.match(/\p{L}/gu) ?? [];
  const upper = letters.filter((c) => c !== c.toLocaleLowerCase()).length;
  return { letters: letters.length, upper };
}

/** "CHOCOLATE CAKE WITH ICING" → "Chocolate Cake with Icing". Only used for shouting titles. */
export function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .split(/(\s+)/)
    .map((part, index) => {
      if (!part.trim()) return part;
      if (index > 0 && SMALL_WORDS.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase() + part.slice(1);
    })
    .join('');
}

function stripSiteSuffix(title: string): string {
  const pipe = /^(.{3,}?)\s+[|·•]\s+([^|·•]+)$/u.exec(title);
  if (pipe?.[1] && pipe[2] && pipe[2].trim().split(/\s+/).length <= 6) return pipe[1].trim();
  const dash = /^(.{3,}?)\s+[-–—]\s+([^-–—]+)$/u.exec(title);
  if (dash?.[1] && dash[2]) {
    const tail = dash[2].trim();
    if (tail.split(/\s+/).length <= 4 && SITE_SUFFIX_WORDS.test(tail)) return dash[1].trim();
  }
  return title;
}

/**
 * Recipe title as the source wrote it. Keeps proper nouns and acronyms ("Nonna's BBQ Ribs"),
 * trims a trailing site name (" | Simply Recipes"), drops emoji and "!!!" tails, and converts
 * only ALL-CAPS titles to Title Case. Ingredient names and step headings keep `toSentenceCase`.
 */
export function normalizeRecipeTitle(value: string): string {
  let title = value
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  title = stripSiteSuffix(title);
  title = title.replace(/!{2,}\s*$/u, '').replace(/!{2,}/g, '!').trim();
  const { letters, upper } = letterStats(title);
  if (letters >= 4 && upper / letters > 0.7) {
    title = toTitleCase(title);
  }
  return title.charAt(0).toLocaleUpperCase() + title.slice(1);
}

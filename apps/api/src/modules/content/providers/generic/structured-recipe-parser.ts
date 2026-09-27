import type {
  StructuredInstructionSection,
  StructuredRecipe,
} from '../../domain/structured-recipe.js';
import { decodeHtmlEntities } from '../../preview/open-graph.js';

const LD_JSON_SCRIPT =
  /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const MAX_WALK_DEPTH = 8;
const MAX_WALK_NODES = 2_000;
const MAX_KEYWORDS = 20;
const MAX_DURATION_MINUTES = 60 * 24 * 14;

type JsonObject = Record<string, unknown>;

/**
 * Best schema.org Recipe on the page: JSON-LD first (handles `@graph`, nested `mainEntity`,
 * array `@type`), then a cheap microdata pass. Returns undefined when there is no Recipe.
 */
export function parseStructuredRecipe(
  html: string,
  pageUrl?: string,
): StructuredRecipe | undefined {
  const fromJsonLd = parseJsonLdRecipes(html, pageUrl);
  const best = pickRichest(fromJsonLd);
  if (best) {
    return best;
  }
  return parseMicrodataRecipe(html, pageUrl);
}

export function parseJsonLdRecipes(html: string, pageUrl?: string): StructuredRecipe[] {
  const recipes: StructuredRecipe[] = [];
  for (const match of html.matchAll(LD_JSON_SCRIPT)) {
    const parsed = parseJsonLoose(match[1] ?? '');
    if (parsed === undefined) {
      continue;
    }
    for (const node of collectRecipeNodes(parsed)) {
      recipes.push(normalizeRecipeNode(node, pageUrl));
    }
  }
  return recipes;
}

function pickRichest(recipes: StructuredRecipe[]): StructuredRecipe | undefined {
  let best: StructuredRecipe | undefined;
  let bestScore = -1;
  for (const recipe of recipes) {
    const score =
      recipe.ingredients.length +
      recipe.instructions.reduce((n, s) => n + s.steps.length, 0) +
      (recipe.name ? 1 : 0);
    if (score > bestScore) {
      best = recipe;
      bestScore = score;
    }
  }
  return best;
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^<!--/, '')
    .replace(/-->$/, '')
    .replace(/^\/\/\s*<!\[CDATA\[/, '')
    .replace(/\/\/\s*\]\]>$/, '')
    .trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Many CMSs emit raw newlines/tabs inside strings and trailing commas.
    const cleaned = trimmed.replace(/[\u0000-\u001F]+/g, ' ').replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {
      return undefined;
    }
  }
}

function collectRecipeNodes(root: unknown): JsonObject[] {
  const found: JsonObject[] = [];
  let visited = 0;

  const walk = (value: unknown, depth: number): void => {
    if (depth > MAX_WALK_DEPTH || visited > MAX_WALK_NODES) {
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        walk(entry, depth + 1);
      }
      return;
    }
    if (!isObject(value)) {
      return;
    }
    visited += 1;
    if (hasType(value, 'Recipe')) {
      found.push(value);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === '@context') {
        continue;
      }
      if (typeof child === 'object' && child !== null) {
        walk(child, depth + 1);
      }
    }
  };

  walk(root, 0);
  return found;
}

function normalizeRecipeNode(node: JsonObject, pageUrl?: string): StructuredRecipe {
  const name = text(node.name) || text(node.headline);
  const description = text(node.description);
  const author = authorText(node.author);
  const yieldTexts = toArray(node.recipeYield).map(text).filter(Boolean);
  const recipeYield = yieldTexts.find((t) => /\D/.test(t)) ?? yieldTexts[0];
  const servings = firstInteger(yieldTexts);
  const prep = parseDuration(node.prepTime);
  const cook = parseDuration(node.cookTime);
  const total = parseDuration(node.totalTime);
  const nutrition = nutritionMap(node.nutrition);
  const calories = parseCalories(isObject(node.nutrition) ? node.nutrition.calories : undefined);
  const language = text(node.inLanguage);

  return {
    source: 'json-ld',
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(author ? { author } : {}),
    images: imageUrls(node.image, pageUrl),
    ingredients: dedupe(
      toArray(node.recipeIngredient ?? node.ingredients)
        .map(text)
        .filter(Boolean),
    ),
    instructions: instructionSections(node.recipeInstructions),
    ...(recipeYield ? { recipeYield } : {}),
    ...(servings !== undefined ? { servings } : {}),
    ...(prep !== undefined ? { prepTimeMinutes: prep } : {}),
    ...(cook !== undefined ? { cookTimeMinutes: cook } : {}),
    ...(total !== undefined ? { totalTimeMinutes: total } : {}),
    ...(calories !== undefined ? { calories } : {}),
    nutrition,
    cuisine: listField(node.recipeCuisine),
    category: listField(node.recipeCategory),
    keywords: listField(node.keywords).slice(0, MAX_KEYWORDS),
    ...(language ? { language } : {}),
  };
}

function instructionSections(value: unknown): StructuredInstructionSection[] {
  const sections: StructuredInstructionSection[] = [];
  let loose: string[] = [];

  const flush = (): void => {
    if (loose.length > 0) {
      sections.push({ steps: dedupe(loose) });
      loose = [];
    }
  };

  for (const item of toArray(value)) {
    if (typeof item === 'string') {
      loose.push(...splitInstructionText(item));
      continue;
    }
    if (!isObject(item)) {
      continue;
    }
    if (hasType(item, 'HowToSection') || (!hasType(item, 'HowToStep') && item.itemListElement)) {
      flush();
      const steps = dedupe(toArray(item.itemListElement).flatMap(stepTexts));
      if (steps.length > 0) {
        const sectionName = text(item.name);
        sections.push({ ...(sectionName ? { name: sectionName } : {}), steps });
      }
      continue;
    }
    loose.push(...stepTexts(item));
  }
  flush();
  return sections;
}

function stepTexts(item: unknown): string[] {
  if (typeof item === 'string') {
    return splitInstructionText(item);
  }
  if (!isObject(item)) {
    return [];
  }
  const own = text(item.text) || text(item.description) || text(item.name);
  if (own) {
    return [own];
  }
  // HowToStep may itself hold HowToDirection / HowToTip children.
  return toArray(item.itemListElement).flatMap(stepTexts);
}

/** A single instructions string may be an HTML list or newline-separated steps. */
function splitInstructionText(raw: string): string[] {
  const withBreaks = raw
    .replace(/<\s*(li|p|br|div|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withBreaks)
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\s+/g, ' ')
        .replace(/^\d+[.)]\s+/, '')
        .trim(),
    )
    .filter(Boolean);
}

function imageUrls(value: unknown, pageUrl?: string): string[] {
  const urls: string[] = [];
  for (const entry of toArray(value)) {
    const candidate =
      typeof entry === 'string'
        ? entry
        : isObject(entry)
          ? (stringValue(entry.url) ?? stringValue(entry.contentUrl) ?? stringValue(entry['@id']))
          : undefined;
    const resolved = candidate ? resolveUrl(candidate.trim(), pageUrl) : undefined;
    if (resolved) {
      urls.push(resolved);
    }
  }
  return dedupe(urls);
}

function resolveUrl(raw: string, base?: string): string | undefined {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function authorText(value: unknown): string | undefined {
  const names = toArray(value)
    .map((entry) => (isObject(entry) ? text(entry.name) : text(entry)))
    .filter(Boolean);
  return names.length > 0 ? dedupe(names).join(', ') : undefined;
}

function nutritionMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObject(value)) {
    return out;
  }
  for (const [key, raw] of Object.entries(value)) {
    if (key.startsWith('@')) {
      continue;
    }
    const v = text(raw);
    if (v) {
      out[key] = v;
    }
  }
  return out;
}

export function parseCalories(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  const match = /(\d+(?:[.,]\d+)?)/.exec(text(value));
  if (!match?.[1]) {
    return undefined;
  }
  const n = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * ISO-8601 duration (`PT1H30M`, `P0DT0H20M`, `PT0.5H`) → minutes. Falls back to loose
 * "1 hour 20 minutes" text. Returns undefined when unparseable or absurd.
 */
export function parseDuration(value: unknown): number | undefined {
  const raw = text(value).toUpperCase();
  if (!raw) {
    return undefined;
  }
  const iso =
    /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/.exec(
      raw,
    );
  let minutes: number | undefined;
  if (iso && raw !== 'P' && raw !== 'PT') {
    const part = (index: number): number => {
      const value = iso[index];
      return value ? Number.parseFloat(value.replace(',', '.')) : 0;
    };
    minutes = part(1) * 7 * 24 * 60 + part(2) * 24 * 60 + part(3) * 60 + part(4) + part(5) / 60;
  } else {
    const hours = /(\d+(?:\.\d+)?)\s*(?:H|HR|HRS|HOURS?)\b/.exec(raw);
    const mins = /(\d+)\s*(?:M|MIN|MINS|MINUTES?)\b/.exec(raw);
    if (hours || mins) {
      minutes =
        (hours?.[1] ? Number.parseFloat(hours[1]) * 60 : 0) +
        (mins?.[1] ? Number.parseInt(mins[1], 10) : 0);
    }
  }
  if (minutes === undefined || !Number.isFinite(minutes) || minutes > MAX_DURATION_MINUTES) {
    return undefined;
  }
  return Math.round(minutes);
}

function listField(value: unknown): string[] {
  const parts = toArray(value).flatMap((entry) =>
    text(entry)
      .split(',')
      .map((p) => p.trim()),
  );
  return dedupe(parts.filter(Boolean));
}

function firstInteger(values: string[]): number | undefined {
  for (const value of values) {
    const match = /(\d+)/.exec(value);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      if (n > 0 && n < 1000) {
        return n;
      }
    }
  }
  return undefined;
}

// --- microdata ---------------------------------------------------------------

const MICRODATA_RECIPE = /itemtype\s*=\s*["']https?:\/\/schema\.org\/Recipe["']/i;

/** Regex-level microdata reader: good enough for the common WordPress-plugin markup. */
export function parseMicrodataRecipe(html: string, pageUrl?: string): StructuredRecipe | undefined {
  const start = html.search(MICRODATA_RECIPE);
  if (start < 0) {
    return undefined;
  }
  const scope = html.slice(start);

  const ingredients = dedupe(
    [...itempropValues(scope, 'recipeIngredient'), ...itempropValues(scope, 'ingredients')].filter(
      Boolean,
    ),
  );
  const steps = itempropValues(scope, 'recipeInstructions', true).flatMap(splitInstructionText);
  const name = itempropValues(scope, 'name')[0];
  const description = itempropValues(scope, 'description')[0];
  const yieldText = itempropValues(scope, 'recipeYield')[0];
  const servings = yieldText ? firstInteger([yieldText]) : undefined;
  const prep = parseDuration(itempropValues(scope, 'prepTime')[0]);
  const cook = parseDuration(itempropValues(scope, 'cookTime')[0]);
  const total = parseDuration(itempropValues(scope, 'totalTime')[0]);
  const calories = parseCalories(itempropValues(scope, 'calories')[0]);
  const image = itempropValues(scope, 'image')[0];
  const imageUrl = image ? resolveUrl(image, pageUrl) : undefined;

  if (ingredients.length === 0 && steps.length === 0) {
    return undefined;
  }

  return {
    source: 'microdata',
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    images: imageUrl ? [imageUrl] : [],
    ingredients,
    instructions: steps.length > 0 ? [{ steps: dedupe(steps) }] : [],
    ...(yieldText ? { recipeYield: yieldText } : {}),
    ...(servings !== undefined ? { servings } : {}),
    ...(prep !== undefined ? { prepTimeMinutes: prep } : {}),
    ...(cook !== undefined ? { cookTimeMinutes: cook } : {}),
    ...(total !== undefined ? { totalTimeMinutes: total } : {}),
    ...(calories !== undefined ? { calories } : {}),
    nutrition: calories !== undefined ? { calories: `${String(calories)} calories` } : {},
    cuisine: [],
    category: [],
    keywords: [],
  };
}

function itempropValues(scope: string, prop: string, keepHtml = false): string[] {
  const pattern = new RegExp(
    `<(\\w+)\\b([^>]*\\bitemprop\\s*=\\s*["'][^"']*\\b${prop}\\b[^"']*["'][^>]*)>`,
    'gi',
  );
  const values: string[] = [];
  for (const match of scope.matchAll(pattern)) {
    const tag = match[1]?.toLowerCase() ?? '';
    const attrs = match[2] ?? '';
    const attr =
      /\bcontent\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ??
      /\bdatetime\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ??
      (tag === 'img' ? /\bsrc\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] : undefined) ??
      (tag === 'link' ? /\bhref\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] : undefined);
    if (attr !== undefined) {
      values.push(decodeHtmlEntities(attr).trim());
      continue;
    }
    const bodyStart = match.index + match[0].length;
    const close = scope.indexOf(`</${tag}`, bodyStart);
    if (close < 0) {
      continue;
    }
    const inner = scope.slice(bodyStart, close);
    values.push(keepHtml ? inner : text(inner));
  }
  return values.filter(Boolean);
}

// --- helpers -----------------------------------------------------------------

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function hasType(node: JsonObject, type: string): boolean {
  const wanted = type.toLowerCase();
  return toArray(node['@type']).some((t) => {
    if (typeof t !== 'string') {
      return false;
    }
    const bare = t.replace(/^.*[/:#]/, '').toLowerCase();
    return bare === wanted;
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Plain text from a JSON-LD value: strings, numbers, `{@value}`, `{name}`/`{text}` objects. */
function text(value: unknown): string {
  if (typeof value === 'string') {
    return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return text(value[0]);
  }
  if (isObject(value)) {
    return text(value['@value'] ?? value.name ?? value.text);
  }
  return '';
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

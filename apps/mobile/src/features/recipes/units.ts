import { fmtAmount } from '@/tortie/lib/fmt';
import type {
  MeasurementSystem,
  MeasurementView,
  RecipeIngredientView,
  RecipeStepView,
} from '@/features/recipes/types';

/**
 * Display-side unit handling. The API returns both systems for every recipe ingredient
 * (including ingredient-specific cup→gram conversions); this converter only covers
 * mass and volume for amounts the API didn't convert (cached payloads, grocery rows).
 */
type UnitDef = {
  kind: 'mass' | 'volume';
  system: MeasurementSystem;
  toBase: number;
};

const DEFS: Record<string, UnitDef> = {
  g: { kind: 'mass', system: 'metric', toBase: 1 },
  kg: { kind: 'mass', system: 'metric', toBase: 1000 },
  oz: { kind: 'mass', system: 'imperial', toBase: 28.349523125 },
  lb: { kind: 'mass', system: 'imperial', toBase: 453.59237 },
  stick: { kind: 'mass', system: 'imperial', toBase: 113.398093 },
  ml: { kind: 'volume', system: 'metric', toBase: 1 },
  l: { kind: 'volume', system: 'metric', toBase: 1000 },
  // Spoons are imperial measures: Metric shows ml (1 tsp = 5 ml, 1 tbsp = 15 ml).
  tsp: { kind: 'volume', system: 'imperial', toBase: 4.92892159375 },
  tbsp: { kind: 'volume', system: 'imperial', toBase: 14.78676478125 },
  'fl oz': { kind: 'volume', system: 'imperial', toBase: 29.5735295625 },
  cup: { kind: 'volume', system: 'imperial', toBase: 236.5882365 },
  pt: { kind: 'volume', system: 'imperial', toBase: 473.176473 },
  qt: { kind: 'volume', system: 'imperial', toBase: 946.352946 },
  gal: { kind: 'volume', system: 'imperial', toBase: 3785.411784 },
};

const ALIASES: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  gr: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  ounce: 'oz',
  ounces: 'oz',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  'tea spoon': 'tsp',
  'tea spoons': 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  'table spoon': 'tbsp',
  'table spoons': 'tbsp',
  tbs: 'tbsp',
  tbl: 'tbsp',
  tblsp: 'tbsp',
  cups: 'cup',
  c: 'cup',
  floz: 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  pint: 'pt',
  pints: 'pt',
  quart: 'qt',
  quarts: 'qt',
  gallon: 'gal',
  gallons: 'gal',
  sticks: 'stick',
};

function resolve(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const raw = unit.trim().replace(/\.+$/, '');
  // Recipe shorthand: a capital T is a tablespoon, a lower-case t a teaspoon.
  if (raw === 'T') return 'tbsp';
  if (raw === 't') return 'tsp';
  const lower = raw
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (DEFS[lower]) return lower;
  const alias = ALIASES[lower];
  return alias && DEFS[alias] ? alias : null;
}

/** True for mass and volume units (g, tbsp, cup…); false for counts like "clove" or "". */
export function isMeasuredUnit(unit: string | null | undefined): boolean {
  return resolve(unit) !== null;
}

const step = (value: number, size: number) => Math.round(value / size) * size;
const trim = (value: number) => Number(value.toFixed(3));

function roundMetric(value: number, unit: string): number {
  if (unit === 'kg' || unit === 'l') return trim(step(value, 0.05));
  if (value < 10) return Math.max(0.5, step(value, 0.5));
  if (value < 100) return Math.round(value);
  return step(value, 5);
}

function roundImperial(value: number, unit: string): number {
  const size =
    unit === 'tsp'
      ? 0.125
      : unit === 'oz' && value >= 4
        ? 0.5
        : unit === 'tbsp'
          ? 0.5
          : 0.25;
  if (value >= 10) return Math.round(value);
  return trim(Math.max(size, step(value, size)));
}

/** Convert a mass/volume amount into `system`; anything else comes back unchanged. */
export function convertAmount(
  quantity: number | null,
  unit: string | null,
  system: MeasurementSystem,
): MeasurementView {
  const key = resolve(unit);
  if (quantity === null || !key) return { quantity, unit };
  const def = DEFS[key]!;
  if (def.system === system) return { quantity, unit };
  const base = quantity * def.toBase;
  let target: string;
  if (def.kind === 'mass') {
    target =
      system === 'metric'
        ? base >= 1000
          ? 'kg'
          : 'g'
        : base >= DEFS.lb!.toBase
          ? 'lb'
          : 'oz';
  } else {
    target =
      system === 'metric'
        ? base >= 1000
          ? 'l'
          : 'ml'
        : base < 14.5
          ? 'tsp'
          : base < 59
            ? 'tbsp'
            : 'cup';
  }
  const raw = base / DEFS[target]!.toBase;
  return {
    quantity:
      system === 'metric'
        ? roundMetric(raw, target)
        : roundImperial(raw, target),
    unit: target,
  };
}

/** The ingredient amount to show in `system`, falling back to the original. */
export function ingredientAmount(
  ingredient: Pick<
    RecipeIngredientView,
    'quantity' | 'unit' | 'metric' | 'imperial'
  >,
  system: MeasurementSystem,
): MeasurementView {
  const chosen = system === 'metric' ? ingredient.metric : ingredient.imperial;
  if (chosen && (chosen.quantity !== null || chosen.unit !== null)) {
    // The API view can still carry a spoon or a pound in its metric view (and the
    // reverse); run it through the converter so the preference holds everywhere.
    return convertAmount(chosen.quantity, chosen.unit, system);
  }
  return convertAmount(ingredient.quantity, ingredient.unit, system);
}

/** "180°C" / "350°F" from the step's stored temperatures, else the step's own text. */
export function stepHeat(
  step: Pick<
    RecipeStepView,
    'temperature' | 'temperatureCelsius' | 'temperatureFahrenheit'
  >,
  system: MeasurementSystem,
): string {
  const c = step.temperatureCelsius ?? null;
  const f = step.temperatureFahrenheit ?? null;
  if (system === 'imperial' && f !== null) return `${f}°F`;
  if (system === 'metric' && c !== null) return `${c}°C`;
  return step.temperature ?? '';
}

// --- Mass and volume amounts in step text ---------------------------------

const FR = '½¼¾⅓⅔⅛⅜⅝⅞';
const NUM = String.raw`(?:\d+\s?[${FR}]|\d+/\d+|\d+(?:[.,]\d+)?|[${FR}])`;
const QTY_UNIT = String.raw`(?:fl\.?\s?oz|fluid\s+ounces?|kilograms?|grams?|kg|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|ounces?|oz|pounds?|lbs?|tablespoons?|tbsps?|teaspoons?|tsps?|cups?)`;
const QTY = String.raw`(?<![\w.,/])(${NUM})(?:(\s?(?:–|-|to)\s?)(${NUM}))?(\s?)(${QTY_UNIT})(?![A-Za-z])`;
const QTY_PAIR = new RegExp(String.raw`${QTY}\s\(${QTY}\)`, 'gi');
const QTY_ONE = new RegExp(QTY, 'gi');

const GLYPH: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function parseNum(raw: string): number {
  const t = raw.trim();
  const last = t.slice(-1);
  if (GLYPH[last] !== undefined) {
    return (parseFloat(t.slice(0, -1)) || 0) + GLYPH[last]!;
  }
  if (t.includes('/')) {
    const [a, b] = t.split('/');
    return Number(a) / (Number(b) || 1);
  }
  return Number(t.replace(',', '.'));
}

type Qty = { lo: number; hi: number | null; unit: string; key: string | null };

function qtyOf(lo: string, hi: string | undefined, unit: string): Qty {
  return {
    lo: parseNum(lo),
    hi: hi ? parseNum(hi) : null,
    unit,
    key: resolve(unit),
  };
}

function qtyText(q: Qty): string {
  const u = q.key ?? q.unit;
  const a = fmtAmount(q.lo, u);
  return `${q.hi !== null ? `${a}–${fmtAmount(q.hi, u)}` : a} ${u}`;
}

/** One amount in `system`, or null when it is already there / can't be converted. */
function convertQty(q: Qty, system: MeasurementSystem): Qty | null {
  if (!q.key || DEFS[q.key]!.system === system) return null;
  const lo = convertAmount(q.lo, q.key, system);
  const hi = q.hi !== null ? convertAmount(q.hi, q.key, system) : null;
  if (lo.quantity === null || !lo.unit) return null;
  if (hi && hi.unit !== lo.unit) return null;
  return {
    lo: lo.quantity,
    hi: hi?.quantity ?? null,
    unit: lo.unit,
    key: lo.unit,
  };
}

/**
 * Mass and volume amounts in step text follow the unit preference: "100g (3.53 oz)"
 * reads "100g" for Metric and "3½ oz" for Imperial, and a lone "2 tbsp" becomes
 * "30 ml" for Metric. Amounts already in the preferred system keep their wording.
 */
export function localizeAmounts(
  text: string,
  system: MeasurementSystem,
): string {
  const paired = text.replace(
    QTY_PAIR,
    (
      match: string,
      lo1: string,
      _s1: string | undefined,
      hi1: string | undefined,
      _sp1: string,
      u1: string,
      lo2: string,
      _s2: string | undefined,
      hi2: string | undefined,
      _sp2: string,
      u2: string,
    ) => {
      const a = qtyOf(lo1, hi1, u1);
      const b = qtyOf(lo2, hi2, u2);
      if (!a.key || !b.key || DEFS[a.key]!.kind !== DEFS[b.key]!.kind) {
        return match;
      }
      if (DEFS[a.key]!.system === system) {
        return match.slice(0, match.lastIndexOf(' ('));
      }
      if (DEFS[b.key]!.system === system) return qtyText(b);
      const converted = convertQty(a, system);
      return converted ? qtyText(converted) : match;
    },
  );
  return paired.replace(
    QTY_ONE,
    (
      match: string,
      lo: string,
      _s: string | undefined,
      hi: string | undefined,
      _sp: string,
      unit: string,
    ) => {
      const converted = convertQty(qtyOf(lo, hi, unit), system);
      return converted ? qtyText(converted) : match;
    },
  );
}

/** Multiply the mass and volume amounts in step text ("200 g" at ×0.5 → "100 g"). */
export function scaleStepText(text: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.005) {
    return text;
  }
  return text.replace(
    QTY_ONE,
    (
      _m: string,
      lo: string,
      sep: string | undefined,
      hi: string | undefined,
      sp: string,
      unit: string,
    ) => {
      const key = resolve(unit) ?? unit.toLowerCase();
      const a = fmtAmount(parseNum(lo) * factor, key);
      const b = hi ? fmtAmount(parseNum(hi) * factor, key) : null;
      return `${b ? `${a}${sep ?? '–'}${b}` : a}${sp}${unit}`;
    },
  );
}

const TEMP_LENGTH_AMOUNT = String.raw`[\d⅛¼⅓⅜½⅝⅔¾⅞][\d.,⅛¼⅓⅜½⅝⅔¾⅞–-]*\s?(?:°\s?[CF]|degrees?\s+[CF]|cm|mm|in(?:ch(?:es)?)?)\b`;
const PAIR = new RegExp(
  `(${TEMP_LENGTH_AMOUNT})\\s\\((${TEMP_LENGTH_AMOUNT})\\)`,
  'g',
);
const METRIC_AMOUNT = /°\s?C|degrees?\s+C|cm|mm/;

/**
 * Make the dual measurements the importer wrote into step text follow the unit
 * preference: temperatures and lengths put the preferred system first
 * ("180°C (350°F)" reads "350°F (180°C)" for imperial users); mass and volume
 * pairs ("100g (3.53 oz)") collapse to the preferred amount.
 */
export function preferUnits(text: string, system: MeasurementSystem): string {
  return localizeAmounts(text, system).replace(
    PAIR,
    (match, first: string, second: string) => {
      const firstIsMetric = METRIC_AMOUNT.test(first);
      return firstIsMetric === (system === 'metric')
        ? match
        : `${second} (${first})`;
    },
  );
}

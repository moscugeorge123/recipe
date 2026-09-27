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
  system: MeasurementSystem | 'both';
  toBase: number;
};

const DEFS: Record<string, UnitDef> = {
  g: { kind: 'mass', system: 'metric', toBase: 1 },
  kg: { kind: 'mass', system: 'metric', toBase: 1000 },
  oz: { kind: 'mass', system: 'imperial', toBase: 28.349523125 },
  lb: { kind: 'mass', system: 'imperial', toBase: 453.59237 },
  ml: { kind: 'volume', system: 'metric', toBase: 1 },
  l: { kind: 'volume', system: 'metric', toBase: 1000 },
  tsp: { kind: 'volume', system: 'both', toBase: 4.92892159375 },
  tbsp: { kind: 'volume', system: 'both', toBase: 14.78676478125 },
  'fl oz': { kind: 'volume', system: 'imperial', toBase: 29.5735295625 },
  cup: { kind: 'volume', system: 'imperial', toBase: 236.5882365 },
};

const ALIASES: Record<string, string> = {
  gram: 'g',
  grams: 'g',
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
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cups: 'cup',
  floz: 'fl oz',
};

function resolve(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim().replace(/\.$/, '');
  if (DEFS[lower]) return lower;
  const alias = ALIASES[lower];
  return alias && DEFS[alias] ? alias : null;
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
  if (def.system === system || def.system === 'both') return { quantity, unit };
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
    return chosen;
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

const AMOUNT = String.raw`[\d⅛¼⅓⅜½⅝⅔¾⅞][\d.,⅛¼⅓⅜½⅝⅔¾⅞–-]*\s?(?:°\s?[CF]|degrees?\s+[CF]|cm|mm|in(?:ch(?:es)?)?)\b`;
const PAIR = new RegExp(`(${AMOUNT})\\s\\((${AMOUNT})\\)`, 'g');
const METRIC_AMOUNT = /°\s?C|degrees?\s+C|cm|mm/;

/**
 * Put the preferred system first in dual measurements the importer wrote into step text:
 * "180°C (350°F)" reads "350°F (180°C)" for imperial users.
 */
export function preferUnits(text: string, system: MeasurementSystem): string {
  return text.replace(PAIR, (match, first: string, second: string) => {
    const firstIsMetric = METRIC_AMOUNT.test(first);
    return firstIsMetric === (system === 'metric')
      ? match
      : `${second} (${first})`;
  });
}

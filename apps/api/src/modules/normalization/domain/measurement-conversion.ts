import { ROMANIAN_UNIT_MAP, parseQuantity } from './units.js';

export type MeasurementSystem = 'metric' | 'imperial';
export type UnitKind = 'mass' | 'volume' | 'length';

/** A quantity in one system. `unit: null` means a bare count ("2 eggs"). */
export interface Measurement {
  quantity: number | null;
  unit: string | null;
}

export interface IngredientMeasurements {
  metric: Measurement;
  imperial: Measurement;
}

interface UnitDef {
  kind: UnitKind;
  /** `both` = kitchen spoons, used as-is by metric and imperial cooks alike. */
  system: MeasurementSystem | 'both';
  /** Size in the kind's base unit: grams, millilitres, or centimetres. */
  toBase: number;
}

export const UNIT_DEFS: Record<string, UnitDef> = {
  mg: { kind: 'mass', system: 'metric', toBase: 0.001 },
  g: { kind: 'mass', system: 'metric', toBase: 1 },
  kg: { kind: 'mass', system: 'metric', toBase: 1000 },
  oz: { kind: 'mass', system: 'imperial', toBase: 28.349523125 },
  lb: { kind: 'mass', system: 'imperial', toBase: 453.59237 },
  ml: { kind: 'volume', system: 'metric', toBase: 1 },
  cl: { kind: 'volume', system: 'metric', toBase: 10 },
  dl: { kind: 'volume', system: 'metric', toBase: 100 },
  l: { kind: 'volume', system: 'metric', toBase: 1000 },
  tsp: { kind: 'volume', system: 'both', toBase: 4.92892159375 },
  tbsp: { kind: 'volume', system: 'both', toBase: 14.78676478125 },
  'fl oz': { kind: 'volume', system: 'imperial', toBase: 29.5735295625 },
  cup: { kind: 'volume', system: 'imperial', toBase: 236.5882365 },
  pint: { kind: 'volume', system: 'imperial', toBase: 473.176473 },
  quart: { kind: 'volume', system: 'imperial', toBase: 946.352946 },
  gallon: { kind: 'volume', system: 'imperial', toBase: 3785.411784 },
  mm: { kind: 'length', system: 'metric', toBase: 0.1 },
  cm: { kind: 'length', system: 'metric', toBase: 1 },
  in: { kind: 'length', system: 'imperial', toBase: 2.54 },
};

/** Definition for a canonical symbol from `resolveUnit` / `UNIT_DEFS` keys. */
function unitDef(unit: string): UnitDef {
  const def = UNIT_DEFS[unit];
  if (!def) {
    throw new Error(`Unknown measurement unit "${unit}"`);
  }
  return def;
}

const UNIT_ALIASES: Record<string, string> = {
  milligram: 'mg',
  milligrams: 'mg',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  gramme: 'g',
  grammes: 'g',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ounce: 'oz',
  ounces: 'oz',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  centilitre: 'cl',
  centiliter: 'cl',
  decilitre: 'dl',
  deciliter: 'dl',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsps: 'tbsp',
  tbs: 'tbsp',
  tbl: 'tbsp',
  floz: 'fl oz',
  'fl. oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  cups: 'cup',
  c: 'cup',
  pints: 'pint',
  pt: 'pint',
  quarts: 'quart',
  qt: 'quart',
  gallons: 'gallon',
  gal: 'gallon',
  millimetre: 'mm',
  millimetres: 'mm',
  millimeter: 'mm',
  millimeters: 'mm',
  centimetre: 'cm',
  centimetres: 'cm',
  centimeter: 'cm',
  centimeters: 'cm',
  inch: 'in',
  inches: 'in',
  '"': 'in',
};

/**
 * Units that describe a count or an amount no scale can convert ("2 cloves", "a pinch").
 * These stay exactly as written in both systems.
 */
const COUNT_UNITS = new Set([
  'piece',
  'pieces',
  'pc',
  'pcs',
  'clove',
  'cloves',
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'slice',
  'slices',
  'can',
  'cans',
  'tin',
  'tins',
  'jar',
  'jars',
  'pack',
  'packs',
  'packet',
  'packets',
  'bunch',
  'bunches',
  'sprig',
  'sprigs',
  'handful',
  'handfuls',
  'head',
  'heads',
  'leaf',
  'leaves',
  'stick',
  'sticks',
  'stalk',
  'stalks',
  'drop',
  'drops',
  'whole',
  'to taste',
]);

function cleanUnit(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

/** Canonical symbol for a convertible unit ("Tablespoons" → "tbsp"), else null. */
export function resolveUnit(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const lower = cleanUnit(raw);
  if (UNIT_DEFS[lower]) {
    return lower;
  }
  const alias = UNIT_ALIASES[lower] ?? ROMANIAN_UNIT_MAP[lower];
  return alias && UNIT_DEFS[alias] ? alias : null;
}

export function isCountUnit(raw: string | null | undefined): boolean {
  if (!raw) {
    return true;
  }
  return COUNT_UNITS.has(cleanUnit(raw));
}

export function unitKind(raw: string | null | undefined): UnitKind | null {
  const unit = resolveUnit(raw);
  return unit ? (UNIT_DEFS[unit]?.kind ?? null) : null;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function trimFloat(value: number): number {
  return Number(value.toFixed(3));
}

/** Nearest kitchen fraction using the given denominators (0.33 cup → 1/3). */
export function snapFraction(value: number, denominators: number[]): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 10) {
    return Math.round(value);
  }
  const whole = Math.floor(value);
  const rest = value - whole;
  let best = 0;
  let bestDistance = rest;
  for (const den of denominators) {
    for (let num = 1; num <= den; num += 1) {
      const candidate = num / den;
      const distance = Math.abs(rest - candidate);
      if (distance < bestDistance - 1e-9) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  const snapped = whole + best;
  if (snapped === 0) {
    return 1 / Math.max(...denominators);
  }
  return trimFloat(snapped);
}

/** Round a metric amount to what a cook would weigh or measure (113.4 g → 115 g). */
function roundMetric(value: number, unit: string): number {
  switch (unit) {
    case 'g':
    case 'ml':
      if (value < 1) return Math.max(0.1, trimFloat(roundTo(value, 0.1)));
      if (value < 10) return roundTo(value, 0.5);
      if (value < 100) return Math.round(value);
      return roundTo(value, 5);
    case 'kg':
    case 'l':
      return trimFloat(roundTo(value, 0.05));
    case 'cm':
      return Math.max(0.5, roundTo(value, 0.5));
    default:
      return trimFloat(roundTo(value, value < 10 ? 0.5 : 1));
  }
}

function roundImperial(value: number, unit: string): number {
  switch (unit) {
    case 'tsp':
      return snapFraction(value, [2, 4, 8]);
    case 'tbsp':
      return snapFraction(value, [2]);
    case 'cup':
      return snapFraction(value, [2, 3, 4]);
    case 'oz':
      if (value < 1) return snapFraction(value, [2, 4, 8]);
      if (value < 4) return snapFraction(value, [2, 4]);
      return Math.max(1, roundTo(value, 0.5));
    case 'lb':
      return snapFraction(value, [4]);
    case 'in':
      return value >= 6 ? Math.round(value) : snapFraction(value, [2, 4, 8]);
    case 'fl oz':
      return snapFraction(value, [2]);
    default:
      return snapFraction(value, [2, 4]);
  }
}

/** Round an amount already in `unit` using that unit's system rules. */
export function roundForUnit(value: number, unit: string): number {
  const def = UNIT_DEFS[unit];
  if (!def || def.system === 'imperial' || def.system === 'both') {
    return roundImperial(value, unit);
  }
  return roundMetric(value, unit);
}

function bestMetricUnit(kind: UnitKind, base: number): string {
  if (kind === 'mass') return base >= 1000 ? 'kg' : 'g';
  if (kind === 'volume') return base >= 1000 ? 'l' : 'ml';
  return base < 1 ? 'mm' : 'cm';
}

function bestImperialUnit(kind: UnitKind, base: number): string {
  if (kind === 'mass') return base >= unitDef('lb').toBase ? 'lb' : 'oz';
  if (kind === 'volume') {
    if (base < 14.5) return 'tsp';
    if (base < 59) return 'tbsp';
    return 'cup';
  }
  return 'in';
}

/** Convert an amount given in base units (g, ml, cm) into a rounded measurement in `system`. */
export function fromBase(kind: UnitKind, base: number, system: MeasurementSystem): Measurement {
  const unit = system === 'metric' ? bestMetricUnit(kind, base) : bestImperialUnit(kind, base);
  const raw = base / unitDef(unit).toBase;
  if (unit === 'mm') {
    return { quantity: Math.max(1, Math.round(raw)), unit };
  }
  return {
    quantity: system === 'metric' ? roundMetric(raw, unit) : roundImperial(raw, unit),
    unit,
  };
}

export function toBase(quantity: number, unit: string): number | null {
  const def = UNIT_DEFS[unit];
  return def ? quantity * def.toBase : null;
}

/**
 * Deterministic conversion. Count and unknown units come back unchanged; amounts already in
 * the target system (or kitchen spoons) keep their unit and exact number.
 */
export function convertMeasurement(input: Measurement, system: MeasurementSystem): Measurement {
  const unit = resolveUnit(input.unit);
  if (input.quantity === null || unit === null) {
    return { quantity: input.quantity, unit: input.unit };
  }
  const def = unitDef(unit);
  if (def.system === system || def.system === 'both') {
    return { quantity: input.quantity, unit };
  }
  return fromBase(def.kind, input.quantity * def.toBase, system);
}

const SAME_KIND_TOLERANCE = 0.15;
/** Plausible g/ml for kitchen ingredients: dried herbs (~0.1) through honey/syrup (~1.5). */
const MIN_DENSITY = 0.1;
const MAX_DENSITY = 2.5;

function measurementOrNull(value: unknown): Measurement | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as { quantity?: unknown; unit?: unknown };
  const quantity =
    typeof record.quantity === 'number'
      ? record.quantity
      : typeof record.quantity === 'string'
        ? parseQuantity(record.quantity)
        : null;
  const unit = typeof record.unit === 'string' && record.unit.trim() ? record.unit.trim() : null;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return { quantity, unit };
}

/** A model-supplied amount is usable in `system` when its unit converts and belongs there. */
function usableIn(candidate: Measurement | null, system: MeasurementSystem): Measurement | null {
  if (!candidate || candidate.quantity === null) return null;
  const unit = resolveUnit(candidate.unit);
  if (!unit) return null;
  const def = unitDef(unit);
  if (def.system !== system && def.system !== 'both') return null;
  return { quantity: candidate.quantity, unit };
}

/**
 * True when `candidate` plausibly describes the same amount as `reference`: within 15% for the
 * same kind, or a believable density for volume↔mass (1 cup flour ≈ 120 g).
 */
export function isConsistent(reference: Measurement, candidate: Measurement): boolean {
  if (reference.quantity === null || candidate.quantity === null) return false;
  const refUnit = resolveUnit(reference.unit);
  const candUnit = resolveUnit(candidate.unit);
  if (!refUnit || !candUnit) return false;
  const ref = unitDef(refUnit);
  const cand = unitDef(candUnit);
  const refBase = reference.quantity * ref.toBase;
  const candBase = candidate.quantity * cand.toBase;
  if (refBase <= 0 || candBase <= 0) return false;
  if (ref.kind === cand.kind) {
    return Math.abs(candBase - refBase) / refBase <= SAME_KIND_TOLERANCE;
  }
  const massVolume =
    (ref.kind === 'mass' && cand.kind === 'volume') ||
    (ref.kind === 'volume' && cand.kind === 'mass');
  if (!massVolume) return false;
  const density = ref.kind === 'mass' ? refBase / candBase : candBase / refBase;
  return density >= MIN_DENSITY && density <= MAX_DENSITY;
}

function rounded(m: Measurement): Measurement {
  if (m.quantity === null || m.unit === null) return m;
  return { quantity: roundForUnit(m.quantity, m.unit), unit: m.unit };
}

/**
 * Build both metric and imperial amounts for an ingredient.
 *
 * - Count units ("2 cloves", "a pinch", no unit) stay as written in both systems.
 * - The side matching the original unit keeps the original amount.
 * - The other side uses the model's value when it is consistent with the original (this is how
 *   ingredient-specific volume↔mass like "1 cup flour → 120 g" gets in), else the deterministic
 *   conversion.
 * - When the original unit is not recognised (e.g. a translated unit word), the model's two
 *   values are cross-checked against each other and the missing/inconsistent one is derived.
 */
export function reconcileMeasurements(
  original: Measurement,
  modelMetric?: unknown,
  modelImperial?: unknown,
): IngredientMeasurements {
  const asWritten: Measurement = { quantity: original.quantity, unit: original.unit };
  if (original.quantity === null || isCountUnit(original.unit)) {
    return { metric: asWritten, imperial: asWritten };
  }

  const metricCandidate = usableIn(measurementOrNull(modelMetric), 'metric');
  const imperialCandidate = usableIn(measurementOrNull(modelImperial), 'imperial');
  const unit = resolveUnit(original.unit);

  if (unit) {
    const source: Measurement = { quantity: original.quantity, unit };
    const side = (system: MeasurementSystem, candidate: Measurement | null): Measurement => {
      const def = unitDef(unit);
      if (def.system === system || def.system === 'both') return source;
      if (candidate && isConsistent(source, candidate)) return rounded(candidate);
      return convertMeasurement(source, system);
    };
    return {
      metric: side('metric', metricCandidate),
      imperial: side('imperial', imperialCandidate),
    };
  }

  if (metricCandidate && imperialCandidate) {
    const metric = rounded(metricCandidate);
    const imperial = isConsistent(metricCandidate, imperialCandidate)
      ? rounded(imperialCandidate)
      : convertMeasurement(metricCandidate, 'imperial');
    return { metric, imperial };
  }
  if (metricCandidate) {
    return {
      metric: rounded(metricCandidate),
      imperial: convertMeasurement(metricCandidate, 'imperial'),
    };
  }
  if (imperialCandidate) {
    return {
      metric: convertMeasurement(imperialCandidate, 'metric'),
      imperial: rounded(imperialCandidate),
    };
  }
  return { metric: asWritten, imperial: asWritten };
}

// --- Temperature -----------------------------------------------------------

export interface Temperature {
  celsius: number;
  fahrenheit: number;
}

/** Oven temperatures snap to the dial (180 °C → 350 °F); low temperatures stay precise. */
export function celsiusToFahrenheit(celsius: number): number {
  const exact = (celsius * 9) / 5 + 32;
  return exact >= 250 ? roundTo(exact, 25) : Math.round(exact);
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  const exact = ((fahrenheit - 32) * 5) / 9;
  return exact >= 120 ? roundTo(exact, 10) : Math.round(exact);
}

const TEMPERATURE_PATTERN =
  /(-?\d+(?:[.,]\d+)?)\s*(?:°|º|degrees?|deg\.?)\s*(c|f|celsius|fahrenheit)\b/i;

/** First explicit temperature in `text` ("bake at 180°C", "350 degrees F"). */
export function parseTemperature(text: string | null | undefined): Temperature | null {
  if (!text) return null;
  const match = TEMPERATURE_PATTERN.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const scale = match[2].toLowerCase().startsWith('f') ? 'f' : 'c';
  return scale === 'c'
    ? { celsius: Math.round(value), fahrenheit: celsiusToFahrenheit(value) }
    : { celsius: fahrenheitToCelsius(value), fahrenheit: Math.round(value) };
}

/**
 * Pick the step temperature: model C/F when they agree (±15 °F), else whichever side parses from
 * the step's temperature text or instruction.
 */
export function reconcileTemperature(input: {
  celsius?: number | null;
  fahrenheit?: number | null;
  text?: string | null;
  instruction?: string | null;
}): Temperature | null {
  const c = typeof input.celsius === 'number' && Number.isFinite(input.celsius) ? input.celsius : null;
  const f =
    typeof input.fahrenheit === 'number' && Number.isFinite(input.fahrenheit)
      ? input.fahrenheit
      : null;
  if (c !== null && f !== null && Math.abs((c * 9) / 5 + 32 - f) <= 15) {
    return { celsius: Math.round(c), fahrenheit: Math.round(f) };
  }
  const parsed = parseTemperature(input.text) ?? parseTemperature(input.instruction);
  if (parsed) return parsed;
  if (c !== null) return { celsius: Math.round(c), fahrenheit: celsiusToFahrenheit(c) };
  if (f !== null) return { celsius: fahrenheitToCelsius(f), fahrenheit: Math.round(f) };
  return null;
}

// --- Inline text -----------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, string> = {
  '0.125': '⅛',
  '0.25': '¼',
  '0.333': '⅓',
  '0.375': '⅜',
  '0.5': '½',
  '0.625': '⅝',
  '0.667': '⅔',
  '0.75': '¾',
  '0.875': '⅞',
};

/** 1.5 → "1½", 0.333 → "⅓", 12 → "12", 2.25 (metric) → "2.25". */
export function formatQuantity(quantity: number, unit?: string | null): string {
  const def = unit ? UNIT_DEFS[unit] : undefined;
  if (def?.system === 'metric') {
    return String(trimFloat(quantity));
  }
  const whole = Math.floor(quantity);
  const rest = trimFloat(quantity - whole);
  if (rest === 0) return String(whole);
  const glyph = UNICODE_FRACTIONS[String(rest)];
  return glyph ? `${whole > 0 ? String(whole) : ''}${glyph}` : String(trimFloat(quantity));
}

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const RANGE = String.raw`(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?`;
const INLINE_PATTERN = new RegExp(
  String.raw`${RANGE}\s*(?:(°\s*[CF]|º\s*[CF]|degrees?\s+(?:celsius|fahrenheit|[CF]))\b|(?:-\s*)?(cm|mm|centimet(?:er|re)s?|millimet(?:er|re)s?|inch(?:es)?)\b)(\s*\(([^)]*)\))?`,
  'gi',
);

function num(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function convertTemperatureInline(value: number, unitText: string): string {
  const lower = unitText.toLowerCase().replace(/\s+/g, '');
  return /f$|fahrenheit$/.test(lower)
    ? `${String(fahrenheitToCelsius(value))}°C`
    : `${String(celsiusToFahrenheit(value))}°F`;
}

function convertLengthInline(value: number, unitText: string): string | null {
  const unit = resolveUnit(unitText);
  if (!unit) return null;
  const target: MeasurementSystem = unitDef(unit).system === 'metric' ? 'imperial' : 'metric';
  const converted = convertMeasurement({ quantity: value, unit }, target);
  if (converted.quantity === null || !converted.unit) return null;
  return `${formatQuantity(converted.quantity, converted.unit)} ${converted.unit}`;
}

function rangeText(low: string, high: string | null): string | null {
  const lowParts = /^([\d.,⅛¼⅓⅜½⅝⅔¾⅞]+)(.*)$/.exec(low);
  const highParts = high ? /^([\d.,⅛¼⅓⅜½⅝⅔¾⅞]+)(.*)$/.exec(high) : null;
  if (!high) return low;
  if (!lowParts || !highParts || lowParts[2] !== highParts[2]) return `${low}–${high}`;
  return `${lowParts[1] ?? ''}–${highParts[1] ?? ''}${highParts[2] ?? ''}`;
}

/**
 * Append the other system after temperatures and lengths in step text:
 * "Bake at 180°C" → "Bake at 180°C (350°F)"; "2 cm cubes" → "2 cm (¾ in) cubes".
 * Already-paired values ("180°C (350°F)") are left alone, so this is idempotent.
 */
export function addDualMeasurements(text: string): string {
  return text.replace(
    INLINE_PATTERN,
    (
      match: string,
      low: string,
      high: string | undefined,
      tempUnit: string | undefined,
      lengthUnit: string | undefined,
      paren: string | undefined,
      inner: string | undefined,
    ) => {
      if (paren && /°|º|degree|inch|\bin\b|cm|mm/i.test(inner ?? '')) return match;
      const convert = (value: string): string | null =>
        tempUnit
          ? convertTemperatureInline(num(value), tempUnit)
          : lengthUnit
            ? convertLengthInline(num(value), lengthUnit)
            : null;
      const lowText = convert(low);
      if (!lowText) return match;
      const highText = high ? convert(high) : null;
      const converted = rangeText(lowText, highText);
      const base = paren ? match.slice(0, match.length - paren.length) : match;
      return converted ? `${base} (${converted})${paren ?? ''}` : match;
    },
  );
}

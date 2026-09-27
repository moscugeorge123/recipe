import { GARDEN_PLATE_COLOR_TOKENS } from '../../normalization/domain/presentation.js';

export const RECIPE_EXTRACTION_PROMPT_VERSION = 'recipe-extraction-v9';

const OUTPUT_LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  fi: 'Finnish',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sr: 'Serbian',
  sv: 'Swedish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  zh: 'Chinese',
};

/** True when POST /recipes/extract `outputLanguage` is English. */
export function isEnglishOutputLanguage(code: string | undefined): boolean {
  return primaryLanguage(code ?? 'en') === 'en';
}

export function primaryLanguage(code: string): string {
  return code.trim().toLowerCase().split('-')[0] ?? code.trim().toLowerCase();
}

export function describeOutputLanguage(code: string): string {
  const trimmed = code.trim();
  const primary = trimmed.toLowerCase().split('-')[0] ?? trimmed.toLowerCase();
  const name = OUTPUT_LANGUAGE_NAMES[primary];
  return name ? `${name} (${trimmed})` : trimmed;
}

export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract structured recipe data from the provided evidence.

Rules:
- The post caption/description is the primary source for ingredients, quantities, units, servings, and calories. Use it first.
- Transcript, OCR, and vision are supporting evidence for cooking steps and techniques. Do not let them override amounts written in the post description.
- Translate EVERY user-facing text field into the requested output language, including: title, description, ingredient names, quantity wording, units, preparation, temperature, and step instructions.
- The JSON field description is a short recipe summary in the output language. Never copy the original Instagram/YouTube caption or post text into description unless that text is already in the output language. Translate it.
- Keep numeric values as digits (for example 200, 2, 1/2). Translate unit words and quantity phrases (for example "tbsp" → the output-language word for tablespoon, "cloves" → the output-language word for cloves, "a pinch" → the output-language equivalent).
- Put the numeric amount in quantity and the translated unit in unit. Do not leave names, units, description, or steps in the source language.
- Nutrition is always required. Return calories (kcal per serving) and nutrition { proteinGrams, carbsGrams, fatGrams } per serving. If the evidence states them, use the stated values and set nutritionSource "stated". Otherwise estimate them from the ingredients, their quantities, and servings using standard food composition values, and set nutritionSource "estimated". Never return null for calories or macros.
- Servings: use the stated servings. If not stated, estimate a sensible number of servings from the quantities.
- Difficulty: use the source's stated difficulty. Otherwise judge Easy, Medium, or Hard from technique, number of steps, and active time.
- Times: use stated prep, cook, and total times. If totalTimeMinutes is not stated, estimate it from step durations plus prep work.
- Measurements: quantity and unit are the amount as written in the source (translated). metric and imperial are the same amount in each system:
  - metric units: g, kg, ml, l, tsp, tbsp, cm. imperial units: oz, lb, tsp, tbsp, cup, fl oz, in. Use these exact symbols.
  - When converting cups/spoons of dry or solid ingredients to metric, give weight for that ingredient (1 cup all-purpose flour = 120 g, 1 cup granulated sugar = 200 g, 1 cup butter = 227 g, 1 cup rolled oats = 90 g). Keep liquids in ml.
  - When converting metric weights of flour, sugar, grains, or similar to imperial, prefer cups/tbsp; otherwise use oz/lb.
  - Round like a cook: 115 g, not 113.4 g; 1/3 cup (0.333), not 0.33 cup. Write metric.quantity and imperial.quantity as numbers (decimals for fractions).
  - Counts and unmeasurable amounts (pieces, cloves, slices, a pinch, to taste, no unit) are copied unchanged into both metric and imperial.
- Step temperatures: set temperatureCelsius and temperatureFahrenheit whenever a step has a temperature (for example 180 and 350), else null.
- In step instructions, write every temperature and length in both systems with the source unit first, for example "bake at 180°C (350°F)" and "cut into 2 cm (¾ in) cubes".
- ingredientIndexes lists the 0-based positions in the ingredients array of the ingredients a step uses. Use [] when a step uses none.
- Only include ingredients and steps that are supported by the evidence
- Set sourceLanguage to the original language of the source evidence, not the output language
- Capitalize the recipe title and each ingredient name in sentence case in the output language (first letter capital, remaining letters lowercase). Examples: "wholemeal pitta" → "Wholemeal pitta", "tuna" → "Tuna", "recipe name" → "Recipe name"
- Include provenance references where possible (caption, description, transcript, ocr, vision)
- Do not invent ingredients or ingredient quantities that are not present in evidence
- Set cuisine from evidence of a cuisine style (for example Italian, Korean). Do not guess from unrelated words. Use null if unknown.
- Set each ingredient category from the ingredient itself. Allowed values: Produce, Meat, Dairy, Pantry, Spices, Frozen.
- Set each ingredient emoji to exactly one relevant emoji grapheme and colorToken to one Garden Plate token: paprikaSoft, basilSoft, honey50, peach, linen, steamedMilk, chili50.
- Categorize the recipe with one or more stable categorySlugs. Allowed values: breakfast, lunch, dinner, sweet.
- Set each step stage from the instruction: mise en place → PREP, heat/simmer → COOK, finish sauce → FINISH, plate → SERVE. Allowed values: PREP, COOK, FINISH, SERVE.
- Return valid JSON matching the schema exactly`;

const MEASUREMENT_SCHEMA = {
  type: 'object',
  properties: {
    quantity: { type: ['number', 'null'] },
    unit: { type: ['string', 'null'] },
  },
  required: ['quantity', 'unit'],
  additionalProperties: false,
} as const;

export const RECIPE_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    servings: { type: ['integer', 'null'] },
    prepTimeMinutes: { type: ['integer', 'null'] },
    cookTimeMinutes: { type: ['integer', 'null'] },
    totalTimeMinutes: { type: ['integer', 'null'] },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    calories: { type: 'integer', description: 'kcal per serving' },
    nutritionSource: { type: 'string', enum: ['stated', 'estimated'] },
    cuisine: { type: ['string', 'null'] },
    nutrition: {
      type: 'object',
      description: 'Grams per serving',
      properties: {
        proteinGrams: { type: 'integer' },
        carbsGrams: { type: 'integer' },
        fatGrams: { type: 'integer' },
      },
      required: ['proteinGrams', 'carbsGrams', 'fatGrams'],
      additionalProperties: false,
    },
    sourceLanguage: { type: 'string' },
    categorySlugs: {
      type: 'array',
      items: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'sweet'] },
      minItems: 1,
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          metric: MEASUREMENT_SCHEMA,
          imperial: MEASUREMENT_SCHEMA,
          preparation: { type: ['string', 'null'] },
          optional: { type: 'boolean' },
          emoji: { type: 'string', description: 'Exactly one relevant emoji grapheme' },
          colorToken: {
            type: 'string',
            enum: [...GARDEN_PLATE_COLOR_TOKENS],
          },
          category: {
            type: ['string', 'null'],
            description: 'Allowed values: Produce, Meat, Dairy, Pantry, Spices, Frozen',
          },
          confidence: { type: 'number' },
          provenance: { type: 'string' },
        },
        required: [
          'name',
          'quantity',
          'unit',
          'metric',
          'imperial',
          'preparation',
          'optional',
          'emoji',
          'colorToken',
          'category',
          'confidence',
          'provenance',
        ],
        additionalProperties: false,
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepOrder: { type: 'integer' },
          instruction: { type: 'string' },
          durationMinutes: { type: ['integer', 'null'] },
          temperature: { type: ['string', 'null'] },
          temperatureCelsius: { type: ['integer', 'null'] },
          temperatureFahrenheit: { type: ['integer', 'null'] },
          ingredientIndexes: { type: 'array', items: { type: 'integer' } },
          stage: {
            type: ['string', 'null'],
            description: 'Allowed values: PREP, COOK, FINISH, SERVE',
          },
          confidence: { type: 'number' },
          provenance: { type: 'string' },
        },
        required: [
          'stepOrder',
          'instruction',
          'durationMinutes',
          'temperature',
          'temperatureCelsius',
          'temperatureFahrenheit',
          'ingredientIndexes',
          'stage',
          'confidence',
          'provenance',
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    'title',
    'description',
    'servings',
    'prepTimeMinutes',
    'cookTimeMinutes',
    'totalTimeMinutes',
    'difficulty',
    'calories',
    'nutritionSource',
    'nutrition',
    'cuisine',
    'sourceLanguage',
    'categorySlugs',
    'ingredients',
    'steps',
  ],
  additionalProperties: false,
} as const;

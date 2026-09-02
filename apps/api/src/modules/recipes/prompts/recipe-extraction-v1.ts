import { GARDEN_PLATE_COLOR_TOKENS } from '../../normalization/domain/presentation.js';

export const RECIPE_EXTRACTION_PROMPT_VERSION = 'recipe-extraction-v8';

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
- Extract calories when the post states them (kcal per serving when specified, otherwise the stated calorie figure). Use null only if calories are not mentioned.
- Only include ingredients and steps that are supported by the evidence
- Set sourceLanguage to the original language of the source evidence, not the output language
- Capitalize the recipe title and each ingredient name in sentence case in the output language (first letter capital, remaining letters lowercase). Examples: "wholemeal pitta" → "Wholemeal pitta", "tuna" → "Tuna", "recipe name" → "Recipe name"
- Include provenance references where possible (caption, description, transcript, ocr, vision)
- Do not invent quantities, calories, or ingredients that are not present in evidence
- Set cuisine from evidence of a cuisine style (for example Italian, Korean). Do not guess from unrelated words. Use null if unknown.
- Set each ingredient category from the ingredient itself. Allowed values: Produce, Meat, Dairy, Pantry, Spices, Frozen.
- Set each ingredient emoji to exactly one relevant emoji grapheme and colorToken to one Garden Plate token: paprikaSoft, basilSoft, honey50, peach, linen, steamedMilk, chili50.
- Categorize the recipe with one or more stable categorySlugs. Allowed values: breakfast, lunch, dinner, sweet.
- Set each step stage from the instruction: mise en place → PREP, heat/simmer → COOK, finish sauce → FINISH, plate → SERVE. Allowed values: PREP, COOK, FINISH, SERVE.
- Return valid JSON matching the schema exactly`;

export const RECIPE_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    servings: { type: ['integer', 'null'] },
    prepTimeMinutes: { type: ['integer', 'null'] },
    cookTimeMinutes: { type: ['integer', 'null'] },
    totalTimeMinutes: { type: ['integer', 'null'] },
    calories: { type: ['integer', 'null'] },
    cuisine: { type: ['string', 'null'] },
    nutrition: {
      type: ['object', 'null'],
      properties: {
        proteinGrams: { type: ['integer', 'null'] },
        carbsGrams: { type: ['integer', 'null'] },
        fatGrams: { type: ['integer', 'null'] },
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
    'calories',
    'cuisine',
    'sourceLanguage',
    'categorySlugs',
    'ingredients',
    'steps',
  ],
  additionalProperties: false,
} as const;

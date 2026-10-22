import { GARDEN_PLATE_COLOR_TOKENS } from '../../normalization/domain/presentation.js';

export const RECIPE_EXTRACTION_PROMPT_VERSION = 'recipe-extraction-v16';

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
- Translate EVERY user-facing text field into the requested output language, including: title, description, ingredient names, quantity wording, units, preparation, ingredient groups, step sections, temperature, step titles, and step instructions.
- The JSON field description is a short recipe summary in the output language. Never copy the original Instagram/YouTube caption or post text into description unless that text is already in the output language. Translate it.
- Keep numeric values as digits (for example 200, 2, 1/2). Translate unit words and quantity phrases (for example "tbsp" → the output-language word for tablespoon, "cloves" → the output-language word for cloves, "a pinch" → the output-language equivalent).
- Put the numeric amount in quantity and the translated unit in unit. Do not leave names, units, description, or steps in the source language.
- quantity is a number or a numeric range only ("2", "1/4", "1 1/2", "2 to 4"). Never put the unit word in quantity: it always goes in unit. Examples: "1/4 teaspoon kosher salt" → quantity "1/4", unit "teaspoon". "2 to 4 tablespoons minced red onion" → quantity "2 to 4", unit "tablespoons". "1 to 2 serrano chilis" → quantity "1 to 2", unit null. Keep a range as a range; do not pick one end.
- When the source gives no amount ("lemon wedges, to serve"), set quantity null and unit null. Do not invent a unit such as "piece" for an ingredient with no amount.
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
- In the step instruction field, write every temperature and length in both systems with the source unit first, for example "bake at 180°C (350°F)" and "cut into 2 cm (¾ in) cubes". Do not put temperatures, lengths, or times in the step title.
- ingredientIndexes lists the 0-based positions in the ingredients array of every raw ingredient the step adds or handles, including ones the instruction names indirectly ("the yolks", "the dry ingredients", "the rest of the sugar"). When the same ingredient appears in several groups, use the one from the group this step belongs to. A step that only uses a component made earlier ("spread the cream") does not repeat that component's ingredients. Use [] when a step uses none.
- Only include ingredients and steps that are supported by the evidence
- Keep the specific ingredient wording of the source. If the description says "orecchiette", "cherry tomatoes", "pancetta" or "Robiola", write exactly that, not "pasta", "tomatoes", "bacon" or "soft cheese". Never generalise an ingredient name.
- Components: a recipe that makes separate parts that are combined at the end (a cake with sponge, cream, filling and glaze; a pie with dough and filling; a dish with a sauce made apart) is split by component.
  - Set group on every ingredient to a short heading for its component in the output language, in the style "For the sponge", "For the cream", "For the filling", "For the glaze". Use the source's headings when it has them ("Blat:", "Crema:" in a handwritten recipe are headings). When it has none, take the components from the method.
  - List ingredients in component order, keeping the source order inside a component. An ingredient used by two components is listed once in each, with the amount that component uses. When a component uses something left over from another (the egg whites left from the sponge eggs), list it in that component with quantity null and say so in preparation.
  - Set section on every step to a short heading for the part of the method it belongs to, in the output language, in the style "Make the sponge", "Make the cream", "Assemble the cake", "Make the glaze". Steps of one section are consecutive.
  - A recipe that is one preparation (a stir-fry, a soup, a salad) has null group on every ingredient and null section on every step. Do not invent components.
- Each step is one or two closely related actions a cook can do without rereading. Split a long source paragraph into several steps in the same order ("Beat the whites with a pinch of salt", "Add the sugar gradually", "Add the yolks one at a time"). Do not drop any action or detail from the source when splitting.
- Servings are the number of people the dish feeds, not the number of items it makes. "Makes 12 pancakes" for a family breakfast is about 4 servings. calories is per serving and must match the ingredients divided by servings.
- Set sourceLanguage to the original language of the source evidence, not the output language
- Write each ingredient name in sentence case in the output language (first letter capital, remaining letters lowercase). Examples: "wholemeal pitta" → "Wholemeal pitta", "tuna" → "Tuna".
- Keep the recipe title exactly as the source writes it, including its capitalization, proper nouns, brands and acronyms ("Nonna's BBQ Ribs"). Do not lower-case it and do not rewrite the wording.
- Include provenance references where possible (caption, description, transcript, ocr, vision)
- Do not invent ingredients or ingredient quantities that are not present in evidence
- Set cuisine from evidence of a cuisine style (for example Italian, Korean). Do not guess from unrelated words. Use null if unknown.
- Set each ingredient category from the ingredient itself. Allowed values: Produce, Meat, Dairy, Pantry, Spices, Frozen.
- Set each ingredient emoji to exactly one relevant emoji grapheme and colorToken to one Garden Plate token: paprikaSoft, basilSoft, honey50, peach, linen, steamedMilk, chili50.
- Set categorySlugs to the meal types the recipe clearly fits. Allowed values: breakfast, lunch, dinner, sweet. Use the source's own recipe category when it states one. Return an empty list when you are not sure or the dish fits none of them (a dip, a side, a snack, a drink); do not default to dinner.
- Set each step stage from the instruction: mise en place → PREP, heat/simmer → COOK, finish sauce → FINISH, plate → SERVE. Allowed values: PREP, COOK, FINISH, SERVE. Steps with ahead true are PREP.
- Each step has a short title and a separate instruction.
  - title is a simple imperative label of 2–5 words, with no period. Examples: "Boil the pasta", "Roast the chicken", "Soak the rice".
  - instruction is the rest: technique, doneness, temperatures, and lengths. Use an empty string when the title already says the whole step.
  - Never take words out of the instruction to build the title. The instruction must be a complete sentence (or sentences) that starts with a capital letter. Wrong: title "Cut the avocados", instruction "in half. Remove the pit." Right: title "Cut the avocados", instruction "Cut the avocados in half and remove the pit."
- Keep the steps in the order of the source. Do not reorder them.
- durationMinutes is the cook timer, in whole minutes. Set it only when the cook waits and can leave the step until time is up: boiling, simmering, baking, roasting, resting, cooling, chilling, proofing, soaking, or marinating. Examples: boil pasta 10 minutes → 10; something in the oven 25 minutes → 25; soak for 4 hours → 240. Set null for hands-on work even when it takes time, such as chopping, mixing, seasoning, stirring, or frying while staying at the pan. "Sauté for 2 minutes" is hands-on: null.
- ahead is true only for a pre-step: work that has to happen before the cooking session, not chopping or measuring once you start. Examples: "soak rice in water for 4 hours" (ahead true, durationMinutes 240); "take the meat out and let it rest for 30 minutes" before cooking (ahead true, durationMinutes 30); marinate overnight; brine; proof dough overnight; chill a component the day before. A rest in the middle of cooking, such as resting a steak before slicing, is ahead false and still gets a timer. A rest that is optional ("if you have time") or that comes after a mixing step is NOT ahead: resting pancake batter happens after "Make the batter" and keeps its place with a 30-minute timer. Put genuine ahead steps first, and keep every other step in source order. Do not drop pre-steps from the method.
- prepTimeMinutes is hands-on prep during the session. Long ahead waits belong on those steps' durationMinutes and in totalTimeMinutes, not in prepTimeMinutes.
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
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          group: {
            type: ['string', 'null'],
            description:
              'Component the ingredient belongs to, such as "For the buttercream". Null when the recipe is one preparation.',
          },
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
          'group',
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
          title: {
            type: 'string',
            description: '2-6 word imperative label. No period, time, or temperature.',
          },
          section: {
            type: ['string', 'null'],
            description:
              'Part of the method the step belongs to, such as "Make the sponge". Null when the recipe is one preparation.',
          },
          instruction: {
            type: 'string',
            description:
              'How to do the step. Do not repeat the title. Empty string if the title is enough.',
          },
          durationMinutes: {
            type: ['integer', 'null'],
            description:
              'Minutes the cook waits and can step away, such as boiling, baking, or soaking. Null for hands-on work.',
          },
          temperature: { type: ['string', 'null'] },
          temperatureCelsius: { type: ['integer', 'null'] },
          temperatureFahrenheit: { type: ['integer', 'null'] },
          ingredientIndexes: { type: 'array', items: { type: 'integer' } },
          stage: {
            type: ['string', 'null'],
            description: 'Allowed values: PREP, COOK, FINISH, SERVE',
          },
          ahead: {
            type: 'boolean',
            description:
              'True only for work done before the cooking session, such as soaking rice or bringing meat to room temperature.',
          },
          confidence: { type: 'number' },
          provenance: { type: 'string' },
        },
        required: [
          'stepOrder',
          'title',
          'section',
          'instruction',
          'durationMinutes',
          'temperature',
          'temperatureCelsius',
          'temperatureFahrenheit',
          'ingredientIndexes',
          'stage',
          'ahead',
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

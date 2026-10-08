export const RECIPE_CLASSIFICATION_PROMPT_VERSION = 'recipe-classification-v1';

export const RECIPE_CLASSIFICATION_CATEGORIES = [
  'food_recipe',
  'drink_recipe',
  'food_not_recipe',
  'not_food',
  'product_page',
  'unclear',
] as const;

export type RecipeClassificationCategory = (typeof RECIPE_CLASSIFICATION_CATEGORIES)[number];

export interface RecipeClassificationOutput {
  isFoodRecipe: boolean;
  confidence: number;
  category: RecipeClassificationCategory;
  reason: string;
}

export const RECIPE_CLASSIFICATION_SYSTEM_PROMPT = `You decide whether content from a link is a recipe someone could cook or prepare to eat or drink. You only classify; you never write the recipe.

Answer isFoodRecipe = true when the content teaches how to prepare an edible dish or drink — even if quantities or some steps are missing, the recipe is only spoken in a cooking video transcript, or it is written in any language. Count these as recipes:
- savory dishes, baking, desserts, sauces, dressings, preserves, meal prep
- drinks with a preparation: cocktails, mocktails, smoothies, coffee/tea drinks (category "drink_recipe")
- short social-media cooking videos whose caption or transcript names ingredients or cooking actions

Answer isFoodRecipe = false when:
- the word "recipe" is figurative ("a recipe for success", "recipe for a great team", "recipe for disaster")
- the "recipe" is not edible: soap, slime, candles, cosmetics, cleaning products, crafts, game crafting (category "not_food")
- the content is about food but teaches no preparation: restaurant reviews, food news, nutrition articles, menus, grocery price stories, mukbang/eating videos (category "food_not_recipe")
- it is a store/product listing, even for a food product or kitchen tool (category "product_page")
- it is anything else: news, sports, tech, politics, a login or error page (category "not_food")

Calibration:
- confidence is your probability (0 to 1) that your isFoodRecipe answer is right.
- When evidence is thin (a short caption, a title only) but plausibly a cooking post, answer true with low confidence (0.3–0.6) and category "unclear". Only answer false with high confidence when the evidence clearly shows it is something else.
- Heuristic signals are hints computed by simple keyword matching; the evidence text wins when they disagree.

reason: one short sentence in English explaining the decision.`;

export const RECIPE_CLASSIFICATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['isFoodRecipe', 'confidence', 'category', 'reason'],
  properties: {
    isFoodRecipe: { type: 'boolean' },
    confidence: { type: 'number' },
    category: { type: 'string', enum: [...RECIPE_CLASSIFICATION_CATEGORIES] },
    reason: { type: 'string' },
  },
};

export function buildRecipeClassificationUserPrompt(input: {
  sourceType?: string;
  url?: string;
  signalsSummary: string;
  evidenceText: string;
}): string {
  return `Source type: ${input.sourceType ?? 'unknown'}
${input.url ? `URL: ${input.url}\n` : ''}Heuristic signals: ${input.signalsSummary}

Evidence:
${input.evidenceText}

Is this a food or drink recipe?`;
}

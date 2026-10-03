/**
 * Cheap, deterministic "does this look like a food recipe?" signals. Used to skip the LLM
 * classifier when the answer is obvious, to guide it otherwise, and as the whole classifier
 * when no LLM is configured.
 */
export interface RecipeSignals {
  /** schema.org Recipe with at least one ingredient or step was found on the page. */
  hasStructuredRecipe: boolean;
  foodTermCount: number;
  drinkTermCount: number;
  quantityCount: number;
  cookingVerbCount: number;
  recipeKeywordCount: number;
  /** "recipe for success/disaster", "recipe for a great team" … */
  figurativeRecipePhrase: boolean;
  /** DIY soap, slime, candles, cosmetics, cleaners. */
  nonEdibleRecipeTerms: number;
  /** add to cart, in stock, free shipping, SKU … */
  commerceTermCount: number;
  textLength: number;
}

const FOOD_TERMS = [
  // pantry
  'flour', 'sugar', 'salt', 'pepper', 'butter', 'oil', 'olive oil', 'vinegar', 'honey', 'yeast',
  'baking powder', 'baking soda', 'cornstarch', 'vanilla', 'cinnamon', 'paprika', 'cumin',
  'oregano', 'thyme', 'rosemary', 'basil', 'parsley', 'cilantro', 'coriander', 'ginger',
  'soy sauce', 'stock', 'broth', 'rice', 'pasta', 'spaghetti', 'noodles', 'bread', 'oats',
  'quinoa', 'lentils', 'beans', 'chickpeas', 'tortilla', 'breadcrumbs', 'cocoa', 'chocolate',
  'maple syrup', 'mustard', 'mayonnaise', 'ketchup', 'sesame',
  // produce
  'garlic', 'onion', 'shallot', 'tomato', 'potato', 'carrot', 'celery', 'lemon', 'lime', 'orange',
  'apple', 'banana', 'berries', 'strawberr*', 'blueberr*', 'avocado', 'spinach', 'kale', 'lettuce',
  'cucumber', 'zucchini', 'eggplant', 'mushroom', 'broccoli', 'cauliflower', 'cabbage', 'corn',
  'peas', 'bell pepper', 'chili', 'jalapeño', 'jalapeno', 'scallion', 'leek', 'pumpkin',
  'squash', 'mint', 'dill',
  // protein & dairy
  'egg', 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'salmon', 'tuna',
  'shrimp', 'prawn', 'fish', 'tofu', 'milk', 'cream', 'cheese', 'parmesan', 'mozzarella',
  'yogurt', 'yoghurt', 'ricotta', 'feta',
  // dishes
  'soup', 'salad', 'sauce', 'cake', 'cookie', 'brownie', 'muffin', 'pancake', 'pizza', 'curry',
  'stew', 'casserole', 'lasagna', 'risotto', 'omelette', 'omelet', 'smoothie', 'dough', 'pie',
  'tart', 'sandwich', 'burger', 'taco', 'dessert', 'marinade', 'dressing', 'frosting',
  'coffee', 'tea', 'juice',
];

/** Drinks are recipes too (see recipe-classification-v1); counted in food terms as well. */
const DRINK_TERMS = [
  'cocktail', 'mocktail', 'vodka', 'gin', 'rum', 'tequila', 'mezcal', 'whiskey', 'whisky',
  'bourbon', 'vermouth', 'bitters', 'aperol', 'prosecco', 'simple syrup', 'espresso', 'latte',
  'smoothie', 'soda water', 'tonic', 'ice cubes', 'lime juice',
];

const COOKING_VERBS = [
  // Words that are common outside kitchens ("serve", "season", "beat") only count in phrases.
  'preheat', 'bake', 'baked', 'baking', 'simmer', 'boil', 'whisk', 'stir', 'sauté', 'saute',
  'fry', 'roast', 'grill', 'knead', 'marinate', 'season with', 'chop', 'dice', 'mince',
  'blend', 'fold in', 'drizzle', 'sprinkle', 'garnish', 'strain', 'muddle', 'whisk together',
  'mix', 'mixing', 'melt', 'toss', 'drain', 'reduce heat', 'bring to a boil', 'until golden',
  'until tender', 'serve with', 'serve immediately', 'refrigerate', 'cook for', 'cook until',
];

const RECIPE_KEYWORDS = [
  'ingredients', 'instructions', 'directions', 'method', 'servings', 'serves', 'prep time',
  'cook time', 'total time', 'yield', 'recipe', 'tablespoon', 'teaspoon', 'oven',
  'rețetă', 'ingrediente', 'receta', 'ricetta', 'recette', 'rezept', 'zutaten',
];

const NON_EDIBLE_TERMS = [
  'soap', 'slime', 'candle', 'lotion', 'shampoo', 'detergent', 'bath bomb', 'lip balm',
  'body scrub', 'deodorant', 'laundry', 'all-purpose cleaner', 'cleaning spray', 'fertilizer',
  'potion', 'crafting', 'minecraft', 'lye',
];

const COMMERCE_TERMS = [
  'add to cart', 'add to bag', 'in stock', 'out of stock', 'free shipping', 'buy now',
  'sku', 'checkout', 'customer reviews', 'price:', 'shop now', 'returns policy', 'warranty',
];

const QUANTITY_PATTERN =
  /(?:\b\d+(?:[.,/]\d+)?|[½⅓⅔¼¾⅛])\s*(?:-\s*\d+\s*)?(?:g|gr|grams?|kg|mg|ml|l|litres?|liters?|dl|cl|cups?|c\.|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|cloves?|pinch(?:es)?|dash(?:es)?|slices?|sticks?|cans?|handfuls?|sprigs?|shots?|parts?)\b/gi;

const FIGURATIVE_RECIPE =
  /\brecipes?\s+for\s+(?:success|disaster|failure|growth|happiness|love|change|chaos|victory|trouble|innovation|productivity|leadership|a\s+(?:great|successful|winning|happy|perfect|healthy|strong|better)\s+(?:team|life|career|business|marriage|relationship|startup|company|culture|brand|future))\b/i;

export function computeRecipeSignals(
  text: string,
  options: { hasStructuredRecipe?: boolean } = {},
): RecipeSignals {
  const lower = text.toLowerCase();
  const drinkTermCount = countDistinct(lower, DRINK_TERMS);
  return {
    hasStructuredRecipe: options.hasStructuredRecipe ?? false,
    foodTermCount: countDistinct(lower, FOOD_TERMS) + drinkTermCount,
    drinkTermCount,
    quantityCount: Math.min(50, (text.match(QUANTITY_PATTERN) ?? []).length),
    cookingVerbCount: countDistinct(lower, COOKING_VERBS),
    recipeKeywordCount: countDistinct(lower, RECIPE_KEYWORDS),
    figurativeRecipePhrase: FIGURATIVE_RECIPE.test(text),
    nonEdibleRecipeTerms: countDistinct(lower, NON_EDIBLE_TERMS),
    commerceTermCount: countDistinct(lower, COMMERCE_TERMS),
    textLength: text.length,
  };
}

/** Weighted "cooking-ness" score. ~6+ reads like a recipe; 0–2 reads like anything else. */
export function foodRecipeScore(s: RecipeSignals): number {
  return (
    Math.min(s.foodTermCount, 8) +
    Math.min(s.quantityCount, 6) * 1.5 +
    Math.min(s.cookingVerbCount, 6) +
    Math.min(s.recipeKeywordCount, 4)
  );
}

export function describeSignals(s: RecipeSignals): string {
  return [
    `schema.org Recipe: ${s.hasStructuredRecipe ? 'yes' : 'no'}`,
    `food terms: ${String(s.foodTermCount)}`,
    `quantities with units: ${String(s.quantityCount)}`,
    `cooking verbs: ${String(s.cookingVerbCount)}`,
    `recipe keywords: ${String(s.recipeKeywordCount)}`,
    `figurative "recipe for …": ${s.figurativeRecipePhrase ? 'yes' : 'no'}`,
    `non-edible DIY terms: ${String(s.nonEdibleRecipeTerms)}`,
    `shopping terms: ${String(s.commerceTermCount)}`,
  ].join(', ');
}

function countDistinct(lower: string, terms: string[]): number {
  let n = 0;
  for (const term of terms) {
    if (containsWord(lower, term)) {
      n += 1;
    }
  }
  return n;
}

const wordPatternCache = new Map<string, RegExp>();

/**
 * Whole-word match (plus plural -s/-es) so "oil" doesn't hit "boil" and "tea" doesn't hit
 * "teaspoon". A trailing `*` makes the term a prefix ("strawberr*" → "strawberries").
 */
function containsWord(lower: string, term: string): boolean {
  let pattern = wordPatternCache.get(term);
  if (!pattern) {
    const isPrefix = term.endsWith('*');
    const core = isPrefix ? term.slice(0, -1) : term;
    const escaped = core.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tail = isPrefix || !/\p{L}$/u.test(core) ? '' : '(?:s|es)?(?!\\p{L})';
    pattern = new RegExp(`(?:^|[^\\p{L}])${escaped}${tail}`, 'u');
    wordPatternCache.set(term, pattern);
  }
  return pattern.test(lower);
}

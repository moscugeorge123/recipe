/** schema.org Recipe data read from a web page (JSON-LD or microdata), flattened to plain strings. */
export interface StructuredRecipe {
  source: 'json-ld' | 'microdata';
  name?: string;
  description?: string;
  author?: string;
  images: string[];
  ingredients: string[];
  instructions: StructuredInstructionSection[];
  recipeYield?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  calories?: number;
  nutrition: Record<string, string>;
  cuisine: string[];
  category: string[];
  keywords: string[];
  language?: string;
}

/** A HowToSection (named) or the implicit single section of plain HowToSteps (unnamed). */
export interface StructuredInstructionSection {
  name?: string;
  steps: string[];
}

export function hasRecipeBody(recipe: StructuredRecipe | undefined): boolean {
  if (!recipe) {
    return false;
  }
  const stepCount = recipe.instructions.reduce((n, section) => n + section.steps.length, 0);
  return recipe.ingredients.length > 0 || stepCount > 0;
}

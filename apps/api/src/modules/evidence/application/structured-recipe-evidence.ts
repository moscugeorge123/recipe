import type { StructuredRecipe } from '../../content/domain/structured-recipe.js';

export const STRUCTURED_RECIPE_FIELD = 'structured_recipe';
export const PAGE_TEXT_FIELD = 'page_text';

/** Plain-text rendering of schema.org Recipe data for the extraction/classification prompts. */
export function formatStructuredRecipe(recipe: StructuredRecipe): string {
  const lines: string[] = [];
  if (recipe.name) {
    lines.push(`Name: ${recipe.name}`);
  }
  if (recipe.description) {
    lines.push(`Summary: ${recipe.description}`);
  }
  if (recipe.recipeYield || recipe.servings !== undefined) {
    const servings = recipe.servings !== undefined ? ` (servings: ${String(recipe.servings)})` : '';
    lines.push(`Yield: ${recipe.recipeYield ?? String(recipe.servings)}${servings}`);
  }
  const times = [
    recipe.prepTimeMinutes !== undefined ? `Prep time: ${String(recipe.prepTimeMinutes)} min` : '',
    recipe.cookTimeMinutes !== undefined ? `Cook time: ${String(recipe.cookTimeMinutes)} min` : '',
    recipe.totalTimeMinutes !== undefined
      ? `Total time: ${String(recipe.totalTimeMinutes)} min`
      : '',
  ].filter(Boolean);
  if (times.length > 0) {
    lines.push(times.join(' | '));
  }
  if (recipe.calories !== undefined) {
    lines.push(`Calories per serving: ${String(recipe.calories)}`);
  }
  const nutrition = Object.entries(recipe.nutrition)
    .filter(([key]) => key !== 'calories')
    .map(([key, value]) => `${key}=${value}`);
  if (nutrition.length > 0) {
    lines.push(`Nutrition: ${nutrition.join('; ')}`);
  }
  if (recipe.cuisine.length > 0) {
    lines.push(`Cuisine: ${recipe.cuisine.join(', ')}`);
  }
  if (recipe.category.length > 0) {
    lines.push(`Category: ${recipe.category.join(', ')}`);
  }
  if (recipe.ingredients.length > 0) {
    lines.push('Ingredients:', ...recipe.ingredients.map((ing) => `- ${ing}`));
  }
  if (recipe.instructions.length > 0) {
    lines.push('Steps:');
    let n = 0;
    for (const section of recipe.instructions) {
      if (section.name) {
        lines.push(`${section.name}:`);
      }
      for (const step of section.steps) {
        n += 1;
        lines.push(`${String(n)}. ${step}`);
      }
    }
  }
  return lines.join('\n');
}

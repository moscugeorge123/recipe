import type { NormalizedRecipe, ValidationResult, ValidationWarning } from '../../recipes/domain/types.js';

export class RecipeValidator {
  validate(recipe: NormalizedRecipe): ValidationResult {
    const warnings: ValidationWarning[] = [];

    if (!recipe.title || recipe.title.length < 2) {
      warnings.push({
        code: 'MISSING_TITLE',
        message: 'Recipe title is missing or too short',
        field: 'title',
      });
    }

    if (recipe.ingredients.length === 0) {
      warnings.push({
        code: 'NO_INGREDIENTS',
        message: 'Recipe has no ingredients',
        field: 'ingredients',
      });
    }

    if (recipe.steps.length === 0) {
      warnings.push({
        code: 'NO_STEPS',
        message: 'Recipe has no steps',
        field: 'steps',
      });
    }

    for (const ing of recipe.ingredients) {
      if (!ing.optional && ing.quantity === null) {
        warnings.push({
          code: 'MISSING_QUANTITY',
          message: `Ingredient "${ing.name}" is missing a quantity`,
          field: `ingredients.${ing.name}`,
        });
      }
    }

    const ingredientNames = new Set(
      recipe.ingredients.flatMap((i) => [i.name.toLowerCase(), i.canonicalName]),
    );

    for (const step of recipe.steps) {
      const lower = `${step.title ?? ''} ${step.instruction}`.toLowerCase();
      const hasIngredientRef = [...ingredientNames].some(
        (name) => name.length > 3 && lower.includes(name),
      );
      if (recipe.ingredients.length > 0 && !hasIngredientRef && step.instruction.length > 20) {
        warnings.push({
          code: 'STEP_INGREDIENT_MISMATCH',
          message: `Step ${String(step.stepOrder)} may not reference listed ingredients`,
          field: `steps.${String(step.stepOrder)}`,
        });
      }
    }

    if (recipe.servings !== null && (recipe.servings < 1 || recipe.servings > 100)) {
      warnings.push({
        code: 'UNREALISTIC_SERVINGS',
        message: `Servings value ${String(recipe.servings)} seems unrealistic`,
        field: 'servings',
      });
    }

    const existingWarnings = Array.isArray(recipe.warnings) ? recipe.warnings : [];
    for (const w of existingWarnings) {
      if (typeof w === 'object' && w !== null && 'code' in w && 'message' in w) {
        warnings.push(w as ValidationWarning);
      }
    }

    const criticalCodes = new Set(['NO_INGREDIENTS', 'NO_STEPS', 'MISSING_TITLE']);
    const hasCritical = warnings.some((w) => criticalCodes.has(w.code));

    return {
      valid: !hasCritical,
      warnings,
    };
  }
}

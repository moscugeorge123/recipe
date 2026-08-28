import type { NormalizedRecipe, ValidationWarning } from '../../recipes/domain/types.js';

export class ConfidenceCalculator {
  calculate(recipe: NormalizedRecipe): number {
    if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
      return 0.1;
    }

    const ingredientScores = recipe.ingredients.map((ing) => {
      let score = ing.confidence;
      if (ing.quantity !== null) {
        score += 0.1;
      }
      if (ing.unit) {
        score += 0.05;
      }
      if (ing.canonicalName !== ing.name.toLowerCase()) {
        score += 0.02;
      }
      return Math.min(score, 1);
    });

    const stepScores = recipe.steps.map((step) => step.confidence);

    const avgIngredient =
      ingredientScores.length > 0
        ? ingredientScores.reduce((a, b) => a + b, 0) / ingredientScores.length
        : 0;

    const avgStep =
      stepScores.length > 0 ? stepScores.reduce((a, b) => a + b, 0) / stepScores.length : 0;

    let overall = avgIngredient * 0.5 + avgStep * 0.5;

    if (recipe.title.length > 3) {
      overall += 0.05;
    }
    if (recipe.description) {
      overall += 0.03;
    }
    if (recipe.servings) {
      overall += 0.02;
    }
    if (recipe.calories) {
      overall += 0.02;
    }

    const warningPenalty = Math.min(
      (Array.isArray(recipe.warnings) ? recipe.warnings.length : 0) * 0.05,
      0.3,
    );
    overall -= warningPenalty;

    return Math.max(0, Math.min(1, Math.round(overall * 100) / 100));
  }

  scoreIngredientWarnings(warnings: ValidationWarning[]): number {
    return Math.max(0, 1 - warnings.length * 0.1);
  }
}

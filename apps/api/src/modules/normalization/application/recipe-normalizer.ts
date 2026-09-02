import type { Prisma } from '@prisma/client';

import type { ExtractedRecipe, NormalizedRecipe } from '../../recipes/domain/types.js';
import { toSentenceCase } from '../domain/casing.js';
import { cuisineFromText, isStepStage, stageForIndex } from '../domain/presentation-heuristics.js';
import { IngredientNormalizer } from './ingredient-normalizer.js';

const DEFAULT_CATEGORY_SLUGS = new Set(['breakfast', 'lunch', 'dinner', 'sweet']);

export function normalizeRecipeCategorySlugs(
  slugs: string[] | null | undefined,
  title: string,
  description: string | null,
): string[] {
  const valid = [
    ...new Set(
      (slugs ?? [])
        .map((slug) => slug.trim().toLowerCase())
        .filter((slug) => DEFAULT_CATEGORY_SLUGS.has(slug)),
    ),
  ];
  if (valid.length > 0) return valid;
  const text = `${title} ${description ?? ''}`.toLowerCase();
  const inferred: string[] = [];
  if (/(cake|cookie|dessert|sweet|brownie|pudding|pie|tart|chocolate)/.test(text)) {
    inferred.push('sweet');
  }
  if (/(breakfast|brunch|pancake|waffle|oat|omelette|omelet|cereal|toast)/.test(text)) {
    inferred.push('breakfast');
  } else if (/(lunch|sandwich|salad|wrap)/.test(text)) {
    inferred.push('lunch');
  } else {
    inferred.push('dinner');
  }
  return inferred;
}

export class RecipeNormalizer {
  private readonly ingredientNormalizer = new IngredientNormalizer();

  normalize(extracted: ExtractedRecipe, outputLanguage = 'en'): NormalizedRecipe {
    const ingredients = extracted.ingredients.map((ing, index) => {
      const normalized = this.ingredientNormalizer.normalize(ing, index, outputLanguage);
      return {
        name: normalized.name,
        canonicalName: normalized.canonicalName,
        quantity: normalized.quantity,
        unit: normalized.unit,
        preparation: normalized.preparation,
        optional: normalized.optional,
        emoji: normalized.emoji,
        colorToken: normalized.colorToken,
        category: normalized.category,
        confidence: normalized.confidence,
        provenance: normalized.provenance as Prisma.InputJsonValue,
        warnings: normalized.warnings,
        sortOrder: normalized.sortOrder,
      };
    });

    const steps = extracted.steps.map((step, index) => ({
      stepOrder: step.stepOrder,
      instruction: step.instruction.trim(),
      durationMinutes: step.durationMinutes ?? null,
      temperature: step.temperature ?? null,
      stage: isStepStage(step.stage) ? step.stage : stageForIndex(index, extracted.steps.length),
      confidence: step.confidence,
      provenance: step.provenance ? { source: step.provenance } : {},
      warnings: [] as Prisma.InputJsonValue,
    }));

    const computedTotal = (extracted.prepTimeMinutes ?? 0) + (extracted.cookTimeMinutes ?? 0);
    const totalTimeMinutes =
      extracted.totalTimeMinutes ?? (computedTotal > 0 ? computedTotal : null);

    const allWarnings = ingredients.flatMap((i) => {
      const ingWarnings = Array.isArray(i.warnings) ? i.warnings : [];
      return ingWarnings.map((w) => ({ code: 'NORMALIZATION', message: w, field: i.name }));
    });

    const title = toSentenceCase(extracted.title);
    const description = extracted.description?.trim() ?? null;
    const trimmedCuisine = extracted.cuisine?.trim();

    return {
      title,
      description,
      servings: extracted.servings ?? null,
      prepTimeMinutes: extracted.prepTimeMinutes ?? null,
      cookTimeMinutes: extracted.cookTimeMinutes ?? null,
      totalTimeMinutes: totalTimeMinutes === 0 ? null : totalTimeMinutes,
      sourceLanguage: extracted.sourceLanguage,
      calories: extracted.calories ?? null,
      cuisine: trimmedCuisine ? trimmedCuisine : cuisineFromText(title, description),
      nutrition: extracted.nutrition ?? null,
      confidence: 0,
      warnings: allWarnings,
      categorySlugs: normalizeRecipeCategorySlugs(extracted.categorySlugs, title, description),
      ingredients,
      steps,
    };
  }
}

import type { Prisma } from '@prisma/client';

import type {
  ExtractedRecipe,
  ExtractedStep,
  NormalizedRecipe,
  NormalizedStep,
  NutritionSource,
  RecipeDifficulty,
} from '../../recipes/domain/types.js';
import { toSentenceCase } from '../domain/casing.js';
import { addDualMeasurements, reconcileTemperature } from '../domain/measurement-conversion.js';
import { cuisineFromText, isStepStage, stageForIndex } from '../domain/presentation-heuristics.js';
import { IngredientNormalizer } from './ingredient-normalizer.js';

const MAX_KCAL_PER_SERVING = 5000;
const MAX_GRAMS_PER_SERVING = 1000;
const MAX_TITLE_WORDS = 8;
const MAX_SPLIT_TITLE_WORDS = 6;
const MAX_TIMER_MINUTES = 7 * 24 * 60;
const DIFFICULTIES: readonly RecipeDifficulty[] = ['Easy', 'Medium', 'Hard'];

function stripLeadingTitle(instruction: string, title: string): string {
  const heading = title.trim();
  if (!heading) return instruction.trim();
  const pattern = new RegExp(
    `^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.:;—\\-–]*`,
    'i',
  );
  return instruction.trim().replace(pattern, '').trim();
}

function startsLowerCase(text: string): boolean {
  const first = text.charAt(0);
  return first !== '' && first !== first.toLocaleUpperCase() && first === first.toLocaleLowerCase();
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/**
 * Shortens an oversized title into the instruction. durationMinutes is the wait timer from the
 * model. A sentence the model cut in two ("Cut the avocados" + "in half. Remove the pit.") is
 * stitched back together; `titleSplit` reports that so the step can carry a warning.
 */
export function shapeExtractedStep(step: ExtractedStep): {
  title: string | null;
  instruction: string;
  ahead: boolean;
  durationMinutes: number | null;
  titleSplit: boolean;
} {
  const rawTitle = (step.title ?? '').trim();
  const cleaned = rawTitle.replace(/[.!?]+$/g, '').trim();
  const rawInstruction = (step.instruction ?? '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const head = words.slice(0, MAX_TITLE_WORDS).join(' ');
  const overflow = words.slice(MAX_TITLE_WORDS).join(' ');
  let instruction = stripLeadingTitle(rawInstruction, cleaned);
  let titleSplit = false;
  let title: string | null = head ? toSentenceCase(head) : null;
  if (cleaned && startsLowerCase(instruction) && !/[.!?:;]$/.test(rawTitle)) {
    // The model moved the first words of the sentence into the title.
    titleSplit = true;
    instruction =
      instruction === rawInstruction
        ? `${cleaned} ${rawInstruction}`
        : capitalizeFirst(rawInstruction);
    if (words.length > MAX_SPLIT_TITLE_WORDS) title = null;
  } else if (
    overflow &&
    !instruction.toLocaleLowerCase().includes(overflow.toLocaleLowerCase())
  ) {
    instruction = [overflow, instruction].filter(Boolean).join(' ');
  }
  instruction = capitalizeFirst(instruction);

  return {
    title,
    instruction,
    ahead: step.ahead === true,
    durationMinutes: boundedInt(step.durationMinutes, 1, MAX_TIMER_MINUTES),
    titleSplit,
  };
}

/** Work that really has to happen before the session starts. */
const PRE_STEP_PATTERN =
  /\b(soak|marinate|marinade|brine|overnight|defrost|thaw|preheat|pre-heat|room temperature|out of the (?:fridge|refrigerator)|proof)/i;
/** Wording that makes a rest or wait optional or concurrent, never a pre-step. */
const OPTIONAL_STEP_PATTERN =
  /\b(if you (?:have|want|like|can|prefer)|optional(?:ly)?|if (?:time|needed|desired)|meanwhile|while (?:the|you)|or start cooking)\b/i;
/** A step that creates or combines something, so later waits depend on it. */
const MIXING_STEP_PATTERN =
  /\b(mix|whisk|stir|combine|beat|blend|knead|fold|cream|measure|batter|dough|put (?:the )?\w+.* in(?:to)? a (?:large |medium )?bowl)\b/i;

function stepText(step: ExtractedStep): string {
  return `${step.title ?? ''} ${step.instruction ?? ''}`;
}

/**
 * Steps in source order. A step flagged `ahead` only moves in front of the others when it really
 * is a pre-step (soak, marinate, overnight...), is not optional, and no earlier step already mixes
 * something. Everything else keeps the order the source gave and loses the `ahead` flag, so an
 * optional rest after the batter is made stays after it.
 */
export function orderExtractedSteps(
  steps: ExtractedStep[],
): Array<{ step: ExtractedStep; ahead: boolean }> {
  const inSourceOrder = steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.stepOrder - b.step.stepOrder || a.index - b.index);

  let mixed = false;
  const classified = inSourceOrder.map(({ step }) => {
    const text = stepText(step);
    const ahead =
      step.ahead === true &&
      !mixed &&
      PRE_STEP_PATTERN.test(text) &&
      !OPTIONAL_STEP_PATTERN.test(text);
    if (!ahead && MIXING_STEP_PATTERN.test(text)) mixed = true;
    return { step, ahead };
  });
  return [...classified.filter((item) => item.ahead), ...classified.filter((item) => !item.ahead)];
}

function boundedInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

export function normalizeNutrition(extracted: Pick<
  ExtractedRecipe,
  'calories' | 'nutrition' | 'nutritionSource'
>): {
  calories: number | null;
  nutrition: { proteinGrams: number | null; carbsGrams: number | null; fatGrams: number | null } | null;
  nutritionSource: NutritionSource | null;
} {
  const calories = boundedInt(extracted.calories, 1, MAX_KCAL_PER_SERVING);
  const macros = {
    proteinGrams: boundedInt(extracted.nutrition?.proteinGrams, 0, MAX_GRAMS_PER_SERVING),
    carbsGrams: boundedInt(extracted.nutrition?.carbsGrams, 0, MAX_GRAMS_PER_SERVING),
    fatGrams: boundedInt(extracted.nutrition?.fatGrams, 0, MAX_GRAMS_PER_SERVING),
  };
  const hasMacros =
    macros.proteinGrams !== null || macros.carbsGrams !== null || macros.fatGrams !== null;
  const nutrition = hasMacros ? macros : null;
  const nutritionSource: NutritionSource | null =
    calories === null && nutrition === null
      ? null
      : extracted.nutritionSource === 'stated'
        ? 'stated'
        : 'estimated';
  return { calories, nutrition, nutritionSource };
}

export function normalizeDifficulty(value: unknown): RecipeDifficulty | null {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return DIFFICULTIES.find((level) => level.toLowerCase() === lower) ?? null;
}

function ingredientRefs(indexes: unknown, ingredientCount: number): number[] {
  if (!Array.isArray(indexes)) return [];
  const valid = indexes.filter(
    (index): index is number =>
      typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < ingredientCount,
  );
  return [...new Set(valid)].sort((a, b) => a - b);
}

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
        metricQuantity: normalized.metricQuantity,
        metricUnit: normalized.metricUnit,
        imperialQuantity: normalized.imperialQuantity,
        imperialUnit: normalized.imperialUnit,
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

    const steps: NormalizedStep[] = orderExtractedSteps(extracted.steps).map(
      ({ step, ahead }, index, ordered) => {
        const copy = shapeExtractedStep(step);
        const instruction = addDualMeasurements(copy.instruction);
        const temperature = reconcileTemperature({
          celsius: step.temperatureCelsius ?? null,
          fahrenheit: step.temperatureFahrenheit ?? null,
          text: step.temperature ?? null,
          instruction: instruction || copy.title || '',
        });
        return {
          stepOrder: index + 1,
          title: copy.title,
          instruction,
          durationMinutes: copy.durationMinutes,
          temperature: step.temperature ?? null,
          temperatureCelsius: temperature?.celsius ?? null,
          temperatureFahrenheit: temperature?.fahrenheit ?? null,
          ingredientRefs: ingredientRefs(step.ingredientIndexes, ingredients.length),
          stage: isStepStage(step.stage) ? step.stage : stageForIndex(index, ordered.length),
          ahead,
          confidence: step.confidence,
          provenance: step.provenance ? { source: step.provenance } : {},
          warnings: (copy.titleSplit
            ? [
                {
                  code: 'STEP_TITLE_SPLIT',
                  message: 'The step title and instruction were one sentence and were merged',
                },
              ]
            : []) as Prisma.InputJsonValue,
        };
      },
    );

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
    const { calories, nutrition, nutritionSource } = normalizeNutrition(extracted);

    return {
      title,
      description,
      servings: boundedInt(extracted.servings, 1, 1000),
      prepTimeMinutes: extracted.prepTimeMinutes ?? null,
      cookTimeMinutes: extracted.cookTimeMinutes ?? null,
      totalTimeMinutes: totalTimeMinutes === 0 ? null : totalTimeMinutes,
      difficulty: normalizeDifficulty(extracted.difficulty),
      sourceLanguage: extracted.sourceLanguage,
      calories,
      nutritionSource,
      cuisine: trimmedCuisine ? trimmedCuisine : cuisineFromText(title, description),
      nutrition,
      confidence: 0,
      warnings: allWarnings,
      categorySlugs: normalizeRecipeCategorySlugs(extracted.categorySlugs, title, description),
      ingredients,
      steps,
    };
  }
}

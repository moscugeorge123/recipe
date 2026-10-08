import type { LLMProvider } from '../../../infrastructure/ai/llm/llm-provider.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { NotARecipeError } from '../../../shared/errors/extraction-errors.js';
import { hasRecipeBody, type StructuredRecipe } from '../../content/domain/structured-recipe.js';
import { EvidenceBuilder } from '../../evidence/application/evidence-builder.js';
import type { EvidenceItem } from '../../evidence/domain/types.js';
import {
  buildRecipeClassificationUserPrompt,
  RECIPE_CLASSIFICATION_CATEGORIES,
  RECIPE_CLASSIFICATION_PROMPT_VERSION,
  RECIPE_CLASSIFICATION_SCHEMA,
  RECIPE_CLASSIFICATION_SYSTEM_PROMPT,
  type RecipeClassificationCategory,
  type RecipeClassificationOutput,
} from '../prompts/recipe-classification-v1.js';
import {
  computeRecipeSignals,
  describeSignals,
  foodRecipeScore,
  type RecipeSignals,
} from './recipe-signals.js';

/** Reject only when the classifier is at least this sure the content is not a recipe. */
export const NOT_A_RECIPE_CONFIDENCE_THRESHOLD = 0.7;
const MAX_CLASSIFIER_EVIDENCE_CHARS = 12_000;

export type RecipeClassificationMethod =
  'structured-data' | 'heuristic' | 'llm' | 'llm-fallback-heuristic';

export interface RecipeClassification {
  isFoodRecipe: boolean;
  confidence: number;
  category: RecipeClassificationCategory;
  reason: string;
  method: RecipeClassificationMethod;
  signals: RecipeSignals;
  promptVersion?: string;
}

export interface RecipeClassifierInput {
  evidence: EvidenceItem[];
  structuredRecipe?: StructuredRecipe;
  sourceType?: string;
  url?: string;
}

export interface RecipeClassifier {
  classify(input: RecipeClassifierInput): Promise<RecipeClassification>;
}

export function signalsForInput(input: RecipeClassifierInput): RecipeSignals {
  const text = input.evidence.map((item) => item.value).join('\n');
  return computeRecipeSignals(text, { hasStructuredRecipe: hasRecipeBody(input.structuredRecipe) });
}

/** Deterministic classifier used when no LLM is configured, and as the LLM's fallback. */
export class HeuristicRecipeClassifier implements RecipeClassifier {
  classify(input: RecipeClassifierInput): Promise<RecipeClassification> {
    return Promise.resolve(classifyFromSignals(signalsForInput(input)));
  }
}

export class LLMRecipeClassifier implements RecipeClassifier {
  private readonly evidenceBuilder = new EvidenceBuilder();

  constructor(
    private readonly llm: LLMProvider,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async classify(input: RecipeClassifierInput): Promise<RecipeClassification> {
    const signals = signalsForInput(input);
    if (signals.hasStructuredRecipe) {
      return classifyFromSignals(signals);
    }

    const evidenceText = this.evidenceBuilder
      .formatForPrompt(input.evidence)
      .slice(0, MAX_CLASSIFIER_EVIDENCE_CHARS);

    try {
      const result = await this.llm.generateStructured<RecipeClassificationOutput>(
        {
          operation: 'recipe-classification',
          messages: [
            { role: 'system', content: RECIPE_CLASSIFICATION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildRecipeClassificationUserPrompt({
                ...(input.sourceType ? { sourceType: input.sourceType } : {}),
                ...(input.url ? { url: input.url } : {}),
                signalsSummary: describeSignals(signals),
                evidenceText: evidenceText || '(no text evidence)',
              }),
            },
          ],
        },
        RECIPE_CLASSIFICATION_SCHEMA,
      );
      return {
        ...parseClassifierOutput(result.data),
        method: 'llm',
        signals,
        promptVersion: RECIPE_CLASSIFICATION_PROMPT_VERSION,
      };
    } catch (error: unknown) {
      this.log.warn(
        { step: 'ai.classify-recipe', err: error },
        'ai.classify-recipe failed; using heuristic classifier',
      );
      return { ...classifyFromSignals(signals), method: 'llm-fallback-heuristic' };
    }
  }
}

export function createRecipeClassifier(
  llm: LLMProvider,
  options: { useLlm: boolean; log?: AppLogger },
): RecipeClassifier {
  return options.useLlm
    ? new LLMRecipeClassifier(llm, options.log)
    : new HeuristicRecipeClassifier();
}

/**
 * Rules are deliberately lenient toward "is a recipe": a false reject loses the user's import,
 * while a false accept is still caught when extraction finds no ingredients and no steps.
 */
export function classifyFromSignals(s: RecipeSignals): RecipeClassification {
  const result = (
    isFoodRecipe: boolean,
    confidence: number,
    category: RecipeClassificationCategory,
    reason: string,
  ): RecipeClassification => ({
    isFoodRecipe,
    confidence,
    category,
    reason,
    method: 'heuristic',
    signals: s,
  });

  if (s.hasStructuredRecipe) {
    return {
      ...result(true, 0.97, 'food_recipe', 'The page publishes schema.org Recipe data.'),
      method: 'structured-data',
    };
  }

  if (s.nonEdibleRecipeTerms >= 2 || (s.nonEdibleRecipeTerms >= 1 && s.foodTermCount <= 2)) {
    return result(false, 0.8, 'not_food', 'Describes a non-edible DIY or craft "recipe".');
  }

  if (s.figurativeRecipePhrase && s.quantityCount < 2 && s.foodTermCount < 4) {
    return result(false, 0.85, 'not_food', 'Uses "recipe" figuratively; no cooking content.');
  }

  if (s.commerceTermCount >= 2 && s.quantityCount < 3 && s.cookingVerbCount < 3) {
    return result(false, 0.75, 'product_page', 'Looks like a store or product listing.');
  }

  const score = foodRecipeScore(s);
  if (score >= 6) {
    return result(
      true,
      Math.min(0.95, 0.55 + score / 40),
      s.drinkTermCount >= 2 ? 'drink_recipe' : 'food_recipe',
      'Mentions ingredients, quantities, and cooking steps.',
    );
  }

  if (
    s.foodTermCount <= 1 &&
    s.quantityCount === 0 &&
    s.cookingVerbCount <= 1 &&
    s.textLength >= 300
  ) {
    return result(false, 0.8, 'not_food', 'No food, quantities, or cooking steps in the content.');
  }

  if (s.quantityCount === 0 && s.cookingVerbCount === 0 && s.textLength >= 600) {
    return result(false, 0.72, 'food_not_recipe', 'Mentions food but gives no preparation.');
  }

  return result(true, 0.4, 'unclear', 'Not enough evidence to rule out a recipe.');
}

function parseClassifierOutput(
  data: unknown,
): Pick<RecipeClassification, 'isFoodRecipe' | 'confidence' | 'category' | 'reason'> {
  if (!data || typeof data !== 'object') {
    throw new Error('Classifier returned a non-object');
  }
  const raw = data as Partial<Record<keyof RecipeClassificationOutput, unknown>>;
  if (typeof raw.isFoodRecipe !== 'boolean') {
    throw new Error('Classifier response is missing isFoodRecipe');
  }
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.5;
  const category = (RECIPE_CLASSIFICATION_CATEGORIES as readonly unknown[]).includes(raw.category)
    ? (raw.category as RecipeClassificationCategory)
    : 'unclear';
  const reason = typeof raw.reason === 'string' ? raw.reason.trim().slice(0, 300) : '';
  return { isFoodRecipe: raw.isFoodRecipe, confidence, category, reason };
}

export function assertFoodRecipe(
  classification: RecipeClassification,
  threshold = NOT_A_RECIPE_CONFIDENCE_THRESHOLD,
): void {
  if (!classification.isFoodRecipe && classification.confidence >= threshold) {
    throw new NotARecipeError({
      message: classification.reason
        ? `The link does not look like a food recipe: ${classification.reason}`
        : 'The link does not look like a food recipe',
      details: [
        {
          path: 'classification',
          message: `${classification.category} (${classification.method}, confidence ${classification.confidence.toFixed(2)})`,
        },
      ],
    });
  }
}

/** Extraction that yields neither ingredients nor steps means the content was not a recipe. */
export function assertExtractedRecipeHasContent(recipe: {
  ingredients: readonly unknown[];
  steps: readonly unknown[];
}): void {
  if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
    throw new NotARecipeError({
      message: 'The link does not look like a food recipe: no ingredients or steps were found',
    });
  }
}

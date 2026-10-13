import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { primaryLanguage } from '../prompts/recipe-extraction-v1.js';
import type { RecipeTranslationContent } from '../prompts/recipe-translation-v1.js';
import type {
  EffectiveRecipeRecord,
  IRecipeRepository,
} from '../repository/recipe.repository.js';
import { recipeTranslationContentSchema, type RecipeTranslator } from './recipe-translator.js';

/** A PENDING row older than this is assumed dead (process restart) and is restarted. */
const PENDING_TTL_MS = 5 * 60_000;

export type RecipeTranslationState =
  /** The recipe is already written in the requested language. */
  | 'ORIGINAL'
  /** A translation is stored and has been applied. */
  | 'READY'
  /** A translation is being produced; poll again. */
  | 'PENDING'
  | 'FAILED'
  /** No AI provider is configured. */
  | 'UNAVAILABLE';

export interface RecipeTranslationInfo {
  language: string;
  status: RecipeTranslationState;
}

/** Normalises `ro-RO`, `RO` → `ro`. */
export function normalizeLanguage(code: string): string {
  return primaryLanguage(code);
}

function toContent(recipe: EffectiveRecipeRecord): RecipeTranslationContent {
  return {
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      metricUnit: ingredient.metricUnit,
      imperialUnit: ingredient.imperialUnit,
      preparation: ingredient.preparation,
    })),
    steps: recipe.steps.map((step) => ({ title: step.title, instruction: step.instruction })),
  };
}

/** Overlays translated text on a recipe; ids, amounts, times and temperatures are untouched. */
export function applyTranslation(
  recipe: EffectiveRecipeRecord,
  content: RecipeTranslationContent,
): EffectiveRecipeRecord {
  return {
    ...recipe,
    title: content.title.trim() || recipe.title,
    description: recipe.description === null ? null : (content.description ?? recipe.description),
    ingredients: recipe.ingredients.map((ingredient, index) => {
      const t = content.ingredients[index];
      if (!t) return ingredient;
      return {
        ...ingredient,
        name: t.name.trim() || ingredient.name,
        unit: ingredient.unit === null ? null : (t.unit ?? ingredient.unit),
        metricUnit: ingredient.metricUnit === null ? null : (t.metricUnit ?? ingredient.metricUnit),
        imperialUnit:
          ingredient.imperialUnit === null ? null : (t.imperialUnit ?? ingredient.imperialUnit),
        preparation: ingredient.preparation === null ? null : (t.preparation ?? ingredient.preparation),
      };
    }),
    steps: recipe.steps.map((step, index) => {
      const t = content.steps[index];
      if (!t) return step;
      return {
        ...step,
        title: step.title === null ? null : (t.title ?? step.title),
        instruction: t.instruction.trim() || step.instruction,
      };
    }),
  };
}

/**
 * Serves a recipe in the language the user asked for. When no translation exists (or the recipe
 * was edited since), one is started in the background and the original text is returned with a
 * PENDING state so the client can poll.
 */
export class RecipeTranslationService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly recipeRepo: IRecipeRepository,
    private readonly translator: RecipeTranslator,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async resolve(
    recipe: EffectiveRecipeRecord,
    requested: string,
  ): Promise<{ recipe: EffectiveRecipeRecord; translation: RecipeTranslationInfo }> {
    const language = normalizeLanguage(requested);
    const base = normalizeLanguage(recipe.contentLanguage ?? 'en');
    if (language === base) {
      return { recipe, translation: { language, status: 'ORIGINAL' } };
    }

    const row = await this.recipeRepo.findTranslation(recipe.userRecipeId, language);
    if (row && row.sourceRevisionId === recipe.revisionId) {
      if (row.status === 'COMPLETED') {
        const parsed = recipeTranslationContentSchema.safeParse(row.content);
        if (
          parsed.success &&
          parsed.data.ingredients.length === recipe.ingredients.length &&
          parsed.data.steps.length === recipe.steps.length
        ) {
          return {
            recipe: applyTranslation(recipe, parsed.data),
            translation: { language, status: 'READY' },
          };
        }
      } else if (row.status === 'FAILED') {
        return { recipe, translation: { language, status: 'FAILED' } };
      } else if (Date.now() - row.updatedAt.getTime() < PENDING_TTL_MS) {
        return { recipe, translation: { language, status: 'PENDING' } };
      }
    }

    return { recipe, translation: { language, status: await this.start(recipe, language) } };
  }

  /** Starts (or restarts, after a failure) a translation. Idempotent while one is running. */
  async start(
    recipe: EffectiveRecipeRecord,
    requested: string,
  ): Promise<'PENDING' | 'UNAVAILABLE'> {
    const language = normalizeLanguage(requested);
    if (!this.translator.available) return 'UNAVAILABLE';

    const key = `${recipe.userRecipeId}:${language}`;
    if (this.inFlight.has(key)) return 'PENDING';
    this.inFlight.add(key);

    try {
      await this.recipeRepo.saveTranslation({
        userRecipeId: recipe.userRecipeId,
        language,
        sourceRevisionId: recipe.revisionId,
        status: 'PENDING',
      });
    } catch (error) {
      this.inFlight.delete(key);
      throw error;
    }

    void this.run(recipe, language).finally(() => this.inFlight.delete(key));
    return 'PENDING';
  }

  private async run(recipe: EffectiveRecipeRecord, language: string): Promise<void> {
    const base = {
      userRecipeId: recipe.userRecipeId,
      language,
      sourceRevisionId: recipe.revisionId,
    };
    try {
      const { content, promptVersion } = await this.translator.translate(
        toContent(recipe),
        language,
      );
      await this.recipeRepo.saveTranslation({
        ...base,
        status: 'COMPLETED',
        content,
        promptVersion,
      });
    } catch (error) {
      this.log.error(
        { step: 'recipe.translate', recipeId: recipe.id, language, err: error },
        'recipe.translate failed',
      );
      try {
        await this.recipeRepo.saveTranslation({
          ...base,
          status: 'FAILED',
          error: error instanceof Error ? error.message.slice(0, 500) : 'Translation failed',
        });
      } catch (saveError) {
        this.log.error({ step: 'recipe.translate', err: saveError }, 'recipe.translate save failed');
      }
    }
  }
}

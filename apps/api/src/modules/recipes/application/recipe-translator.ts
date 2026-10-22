import { z } from 'zod';

import type { AppConfig } from '../../../config/env.js';
import type { LLMProvider } from '../../../infrastructure/ai/llm/llm-provider.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import {
  buildRecipeTranslationUserPrompt,
  RECIPE_TRANSLATION_PROMPT_VERSION,
  RECIPE_TRANSLATION_SCHEMA,
  RECIPE_TRANSLATION_SYSTEM_PROMPT,
  type RecipeTranslationContent,
} from '../prompts/recipe-translation-v1.js';

const MAX_OUTPUT_TOKENS = 8000;

const nullableText = z.string().nullable();
export const recipeTranslationContentSchema = z.object({
  title: z.string(),
  description: nullableText,
  ingredients: z.array(
    z.object({
      name: z.string(),
      unit: nullableText,
      metricUnit: nullableText,
      imperialUnit: nullableText,
      preparation: nullableText,
      group: nullableText.optional(),
    }),
  ),
  steps: z.array(
    z.object({ title: nullableText, section: nullableText.optional(), instruction: z.string() }),
  ),
});

export class RecipeTranslationError extends Error {}

/** Translates the text fields of one recipe into another language. */
export class RecipeTranslator {
  constructor(
    private readonly config: AppConfig,
    private readonly llm: LLMProvider | null,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  get available(): boolean {
    return this.llm !== null;
  }

  async translate(
    recipe: RecipeTranslationContent,
    language: string,
  ): Promise<{ content: RecipeTranslationContent; promptVersion: string }> {
    if (!this.llm) throw new RecipeTranslationError('Translation is not available');

    const result = await this.llm.generateStructured<unknown>(
      {
        operation: 'recipe_translation',
        model: this.config.ai.defaultModel,
        temperature: 0.1,
        maxTokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: RECIPE_TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: buildRecipeTranslationUserPrompt({ language, recipe }) },
        ],
      },
      RECIPE_TRANSLATION_SCHEMA,
    );

    const parsed = recipeTranslationContentSchema.safeParse(result.data);
    if (!parsed.success) {
      this.log.error(
        { step: 'recipe.translate', model: result.model, issues: parsed.error.issues.slice(0, 5) },
        'recipe.translate failed: output did not match schema',
      );
      throw new RecipeTranslationError('Translation did not match the expected shape');
    }
    const out = parsed.data;
    if (
      out.ingredients.length !== recipe.ingredients.length ||
      out.steps.length !== recipe.steps.length
    ) {
      this.log.error(
        { step: 'recipe.translate', model: result.model, language },
        'recipe.translate failed: item counts changed',
      );
      throw new RecipeTranslationError('Translation changed the number of ingredients or steps');
    }

    this.log.info(
      {
        step: 'recipe.translate',
        model: result.model,
        language,
        durationMs: result.durationMs,
        ...result.usage,
      },
      'recipe.translate completed',
    );
    return { content: out, promptVersion: RECIPE_TRANSLATION_PROMPT_VERSION };
  }
}

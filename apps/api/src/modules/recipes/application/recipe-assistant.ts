import { RECIPE_DIFFICULTIES } from '@recipe/contracts';
import { z } from 'zod';

import type { AppConfig } from '../../../config/env.js';
import type { LLMProvider, LLMResult } from '../../../infrastructure/ai/llm/llm-provider.js';
import type { AIUsageTracker } from '../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { ServiceUnavailableError } from '../../../shared/errors/app-error.js';
import { RecipeAssistRejectedError } from '../../../shared/errors/recipe-errors.js';
import {
  buildRecipeAssistUserPrompt,
  RECIPE_ASSIST_PROMPT_VERSION,
  RECIPE_ASSIST_SCHEMA,
  RECIPE_ASSIST_SYSTEM_PROMPT,
  type RecipeAssistRecipe,
} from '../prompts/recipe-assist-v1.js';

/** Matches the editor's servings stepper. */
const MAX_SERVINGS = 24;
const MAX_OUTPUT_TOKENS = 8000;

export interface RecipeAssistInput {
  /** The signed-in user the AI spend is recorded against. */
  userId?: string;
  instruction: string;
  recipe: RecipeAssistRecipe;
}

export interface RecipeAssistResult {
  message: string;
  recipe: RecipeAssistRecipe;
  promptVersion: string;
}

const outputSchema = z.object({
  decision: z.enum(['apply', 'reject']),
  message: z.string(),
  recipe: z
    .object({
      title: z.string(),
      description: z.string(),
      servings: z.number(),
      totalMinutes: z.number(),
      difficulty: z.string(),
      ingredients: z.array(z.object({ id: z.string().nullable(), text: z.string() })),
      steps: z.array(
        z.object({
          id: z.string().nullable(),
          title: z.string(),
          body: z.string(),
          minutes: z.number(),
          ahead: z.boolean(),
        }),
      ),
    })
    .nullable(),
});

const REJECT_FALLBACK =
  'I can only make changes to this recipe. Try “make it vegetarian” or “halve it”.';

/** Ask Tortie: applies a free-text edit to a recipe draft, or rejects anything off-topic. */
export class RecipeAssistant {
  constructor(
    private readonly config: AppConfig,
    private readonly llm: LLMProvider | null,
    private readonly log: AppLogger = silentLogger(),
    private readonly usageTracker: AIUsageTracker | null = null,
  ) {}

  async assist(input: RecipeAssistInput): Promise<RecipeAssistResult> {
    if (!this.llm) {
      throw new ServiceUnavailableError({ message: 'Ask Tortie isn’t available right now' });
    }

    const result = await this.llm.generateStructured<unknown>(
      {
        operation: 'recipe_assist',
        model: this.config.ai.defaultModel,
        temperature: 0.2,
        maxTokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: RECIPE_ASSIST_SYSTEM_PROMPT },
          { role: 'user', content: buildRecipeAssistUserPrompt(input) },
        ],
      },
      RECIPE_ASSIST_SCHEMA,
    );
    // Tokens are spent even when the model rejects or returns junk, so record before parsing.
    await this.trackUsage(input.userId, result);

    const parsed = outputSchema.safeParse(result.data);
    if (!parsed.success) {
      this.log.error(
        { step: 'recipe.assist', model: result.model, issues: parsed.error.issues.slice(0, 5) },
        'recipe.assist failed: output did not match schema',
      );
      throw new ServiceUnavailableError({ message: 'Tortie couldn’t make that change' });
    }

    const out = parsed.data;
    this.log.info(
      {
        step: 'recipe.assist',
        model: result.model,
        decision: out.decision,
        durationMs: result.durationMs,
        ...result.usage,
      },
      'recipe.assist completed',
    );

    if (out.decision === 'reject') {
      throw new RecipeAssistRejectedError({ message: out.message.trim() || REJECT_FALLBACK });
    }
    if (!out.recipe) {
      throw new ServiceUnavailableError({ message: 'Tortie couldn’t make that change' });
    }

    return {
      message: out.message.trim(),
      recipe: sanitize(out.recipe, input.recipe),
      promptVersion: RECIPE_ASSIST_PROMPT_VERSION,
    };
  }

  /** Bookkeeping must not fail an edit the user already paid for. */
  private async trackUsage(userId: string | undefined, result: LLMResult<unknown>): Promise<void> {
    if (!this.usageTracker || !userId) {
      return;
    }
    try {
      await this.usageTracker.track({
        userId,
        provider: 'openai',
        model: result.model,
        operation: 'recipe_assist',
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: result.durationMs,
      });
    } catch (error: unknown) {
      this.log.warn({ step: 'recipe.assist', err: error }, 'recipe.assist usage was not recorded');
    }
  }
}

/**
 * The client diffs by id to highlight changes, so an id is only kept when it names a row of the
 * same kind in the input, and only the first time it appears. Everything else becomes new.
 */
function sanitize(next: RecipeAssistRecipe, prev: RecipeAssistRecipe): RecipeAssistRecipe {
  const ingIds = new Set(prev.ingredients.map((x) => x.id));
  const stepIds = new Set(prev.steps.map((x) => x.id));
  const claim = (id: string | null, known: Set<string | null>): string | null => {
    if (id === null || !known.has(id)) return null;
    known.delete(id);
    return id;
  };
  const whole = (n: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

  const steps = next.steps
    .map((s) => ({
      id: claim(s.id, stepIds),
      title: s.title.trim(),
      body: s.body.trim(),
      minutes: whole(s.minutes, 0, 24 * 60 * 3),
      ahead: s.ahead,
    }))
    .filter((s) => s.title || s.body);

  return {
    title: next.title.trim() || prev.title,
    description: next.description.trim(),
    servings: whole(next.servings, 1, MAX_SERVINGS),
    totalMinutes: whole(next.totalMinutes, 1, 24 * 60 * 7),
    difficulty: (RECIPE_DIFFICULTIES as readonly string[]).includes(next.difficulty)
      ? next.difficulty
      : prev.difficulty,
    ingredients: next.ingredients
      .map((x) => ({ id: claim(x.id, ingIds), text: x.text.trim() }))
      .filter((x) => x.text),
    steps,
  };
}

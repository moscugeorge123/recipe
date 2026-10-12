import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { dataResponse, dataResponseSchema } from '../../../shared/http/response.js';
import type { RecipeAssistant } from '../application/recipe-assistant.js';

const assistRecipeFields = {
  title: z.string().max(300),
  description: z.string().max(2000),
  servings: z.number().int().min(1).max(100),
  totalMinutes: z.number().int().min(0).max(100_000),
  difficulty: z.string().max(40),
};
const assistStepFields = {
  title: z.string().max(300),
  body: z.string().max(4000),
  minutes: z.number().int().min(0).max(100_000),
  ahead: z.boolean(),
};

/** Input rows always carry the client's row key. */
const inputId = z.string().min(1).max(64);
/** Output rows keep that key, or null for rows Tortie added. */
const outputId = z.string().nullable();

export const assistRecipeBodySchema = z
  .object({
    instruction: z.string().trim().min(1).max(1000),
    recipe: z.object({
      ...assistRecipeFields,
      ingredients: z.array(z.object({ id: inputId, text: z.string().max(500) })).max(200),
      steps: z.array(z.object({ id: inputId, ...assistStepFields })).max(100),
    }),
  })
  .strict();

export const assistRecipeResultSchema = z.object({
  message: z.string(),
  recipe: z.object({
    ...assistRecipeFields,
    ingredients: z.array(z.object({ id: outputId, text: z.string() })),
    steps: z.array(z.object({ id: outputId, ...assistStepFields })),
  }),
  promptVersion: z.string(),
});

export type AssistRecipeBody = z.infer<typeof assistRecipeBodySchema>;

export interface RecipeAssistRoutesOptions {
  recipeAssistant: RecipeAssistant;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export const recipeAssistRoutes: FastifyPluginAsyncZod<RecipeAssistRoutesOptions> = async (
  app,
  opts,
) => {
  app.post(
    '/recipes/assist',
    {
      config: {
        rateLimit: {
          max: opts.rateLimitMax ?? 20,
          timeWindow: opts.rateLimitWindowMs ?? 60_000,
        },
      },
      schema: {
        tags: ['recipes'],
        summary: 'Ask Tortie to edit a recipe draft',
        description:
          'Applies a free-text instruction to the given draft and returns the whole updated draft ' +
          'without saving. Rows keep their id when unchanged in identity; new rows have id null. ' +
          'Requests unrelated to the recipe fail with 422 RECIPE_ASSIST_REJECTED and a ' +
          'user-facing message.',
        body: assistRecipeBodySchema,
        response: {
          200: dataResponseSchema(assistRecipeResultSchema),
          422: errorResponseSchema,
          503: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      request.log.info(
        {
          step: 'http.recipe.assist',
          instructionChars: request.body.instruction.length,
          ingredients: request.body.recipe.ingredients.length,
          steps: request.body.recipe.steps.length,
        },
        'http.recipe.assist started',
      );
      const result = await opts.recipeAssistant.assist(request.body);
      reply.send(dataResponse(result));
    },
  );
};

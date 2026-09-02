import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import { recipeIdParamsSchema } from '../../recipes/api/recipes.schema.js';
import type { NutritionService } from '../application/nutrition-service.js';
import { createNutritionController } from './nutrition.controller.js';
import { correctNutritionMatchBodySchema, nutritionViewSchema } from './nutrition.schema.js';

export interface NutritionRoutesOptions {
  nutritionService: NutritionService;
}

export const nutritionRoutes: FastifyPluginAsyncZod<NutritionRoutesOptions> = async (app, opts) => {
  const controller = createNutritionController(opts.nutritionService);

  app.get(
    '/recipes/:id/nutrition',
    {
      schema: {
        tags: ['nutrition'],
        summary: 'Get nutrition for the effective recipe revision',
        params: recipeIdParamsSchema,
        response: {
          200: dataResponseSchema(nutritionViewSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.get,
  );

  app.post(
    '/recipes/:id/nutrition/recalculate',
    {
      schema: {
        tags: ['nutrition'],
        summary: 'Request nutrition recalculation for the effective revision',
        params: recipeIdParamsSchema,
        response: {
          200: dataResponseSchema(nutritionViewSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.recalculate,
  );

  app.patch(
    '/recipes/:id/nutrition/matches',
    {
      schema: {
        tags: ['nutrition'],
        summary: 'Correct an ingredient food match and recalculate',
        params: recipeIdParamsSchema,
        body: correctNutritionMatchBodySchema,
        response: {
          200: dataResponseSchema(nutritionViewSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.correctMatch,
  );
};
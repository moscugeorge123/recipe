import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import type { MealPlanService } from '../application/meal-plan-service.js';
import { createMealPlanController } from './meal-plan.controller.js';
import {
  createMealPlanEntryBodySchema,
  deleteMealPlanEntryResponseSchema,
  listMealPlanQuerySchema,
  mealPlanEntryIdParamsSchema,
  mealPlanEntrySchema,
  patchMealPlanEntryBodySchema,
  reorderMealPlanBodySchema,
} from './meal-plan.schema.js';

export interface MealPlanRoutesOptions {
  mealPlanService: MealPlanService;
}

export const mealPlanRoutes: FastifyPluginAsyncZod<MealPlanRoutesOptions> = async (app, opts) => {
  const controller = createMealPlanController(opts.mealPlanService);

  app.get(
    '/meal-plan',
    {
      schema: {
        tags: ['meal-plan'],
        summary: 'List meal plan entries in a date range',
        querystring: listMealPlanQuerySchema,
        response: {
          200: dataResponseSchema(z.array(mealPlanEntrySchema)),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.post(
    '/meal-plan/entries',
    {
      schema: {
        tags: ['meal-plan'],
        summary: 'Add a meal plan entry',
        body: createMealPlanEntryBodySchema,
        response: {
          201: dataResponseSchema(mealPlanEntrySchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.create,
  );

  app.patch(
    '/meal-plan/entries/:id',
    {
      schema: {
        tags: ['meal-plan'],
        summary: 'Update a meal plan entry',
        params: mealPlanEntryIdParamsSchema,
        body: patchMealPlanEntryBodySchema,
        response: {
          200: dataResponseSchema(mealPlanEntrySchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/meal-plan/entries/:id',
    {
      schema: {
        tags: ['meal-plan'],
        summary: 'Delete a meal plan entry',
        params: mealPlanEntryIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteMealPlanEntryResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );

  app.put(
    '/meal-plan/reorder',
    {
      schema: {
        tags: ['meal-plan'],
        summary: 'Reorder or move meal plan entries',
        body: reorderMealPlanBodySchema,
        response: {
          200: dataResponseSchema(z.array(mealPlanEntrySchema)),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.reorder,
  );
};

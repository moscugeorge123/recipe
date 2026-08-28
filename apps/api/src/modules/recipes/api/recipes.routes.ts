import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import {
  collectionResponseSchema,
  dataResponseSchema,
} from '../../../shared/http/response.js';
import type { RecipeService } from '../application/recipe-service.js';
import { createRecipesController } from './recipes.controller.js';
import {
  deleteRecipeResponseSchema,
  listRecipesQuerySchema,
  patchRecipeBodySchema,
  recipeDetailSchema,
  recipeIdParamsSchema,
  recipeListItemSchema,
} from './recipes.schema.js';

export interface RecipesRoutesOptions {
  recipeService: RecipeService;
}

export const recipesRoutes: FastifyPluginAsyncZod<RecipesRoutesOptions> = async (app, opts) => {
  const controller = createRecipesController(opts.recipeService);

  app.get(
    '/recipes',
    {
      schema: {
        tags: ['recipes'],
        summary: 'List recipes',
        querystring: listRecipesQuerySchema,
        response: {
          200: collectionResponseSchema(recipeListItemSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.get(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Get recipe by id',
        params: recipeIdParamsSchema,
        response: {
          200: dataResponseSchema(recipeDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getById,
  );

  app.patch(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Update recipe',
        params: recipeIdParamsSchema,
        body: patchRecipeBodySchema,
        response: {
          200: dataResponseSchema(recipeDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Delete recipe',
        params: recipeIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteRecipeResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );
};

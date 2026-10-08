import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import {
  collectionResponseSchema,
  dataResponseSchema,
} from '../../../shared/http/response.js';
import type { CollectionService } from '../application/collection-service.js';
import { createCollectionsController } from './collections.controller.js';
import {
  addCollectionRecipeBodySchema,
  collectionDetailSchema,
  collectionIdParamsSchema,
  collectionRecipeParamsSchema,
  collectionSummarySchema,
  createCollectionBodySchema,
  deleteCollectionResponseSchema,
  listCollectionsQuerySchema,
  patchCollectionBodySchema,
  reorderCollectionRecipesBodySchema,
} from './collections.schema.js';

export interface CollectionsRoutesOptions {
  collectionService: CollectionService;
}

export const collectionsRoutes: FastifyPluginAsyncZod<CollectionsRoutesOptions> = async (
  app,
  opts,
) => {
  const controller = createCollectionsController(opts.collectionService);

  app.get(
    '/collections',
    {
      schema: {
        tags: ['collections'],
        summary: 'List collections',
        querystring: listCollectionsQuerySchema,
        response: {
          200: collectionResponseSchema(collectionSummarySchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.post(
    '/collections',
    {
      schema: {
        tags: ['collections'],
        summary: 'Create a collection',
        body: createCollectionBodySchema,
        response: {
          201: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.create,
  );

  app.get(
    '/collections/:id',
    {
      schema: {
        tags: ['collections'],
        summary: 'Get a collection with ordered recipes',
        params: collectionIdParamsSchema,
        response: {
          200: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getById,
  );

  app.patch(
    '/collections/:id',
    {
      schema: {
        tags: ['collections'],
        summary: 'Rename a collection',
        params: collectionIdParamsSchema,
        body: patchCollectionBodySchema,
        response: {
          200: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/collections/:id',
    {
      schema: {
        tags: ['collections'],
        summary: 'Delete a collection without deleting recipes',
        params: collectionIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteCollectionResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );

  app.post(
    '/collections/:id/recipes',
    {
      schema: {
        tags: ['collections'],
        summary: 'Add a recipe to a collection',
        params: collectionIdParamsSchema,
        body: addCollectionRecipeBodySchema,
        response: {
          200: dataResponseSchema(collectionDetailSchema),
          201: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.addRecipe,
  );

  app.put(
    '/collections/:id/recipes',
    {
      schema: {
        tags: ['collections'],
        summary: 'Reorder recipes in a collection',
        params: collectionIdParamsSchema,
        body: reorderCollectionRecipesBodySchema,
        response: {
          200: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.reorder,
  );

  app.delete(
    '/collections/:id/recipes/:recipeId',
    {
      schema: {
        tags: ['collections'],
        summary: 'Remove a recipe from a collection',
        params: collectionRecipeParamsSchema,
        response: {
          200: dataResponseSchema(collectionDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.removeRecipe,
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { collectionResponseSchema, dataResponseSchema } from '../../../shared/http/response.js';
import type { RecipeService } from '../application/recipe-service.js';
import { createRecipesController } from './recipes.controller.js';
import {
  createRecipeNoteBodySchema,
  deleteNoteResponseSchema,
  deleteRecipeResponseSchema,
  engagementConcurrencyBodySchema,
  engagementConcurrencyQuerySchema,
  listRecipesQuerySchema,
  patchRecipeBodySchema,
  patchRecipeNoteBodySchema,
  putRatingBodySchema,
  putReviewStateBodySchema,
  recipeDetailSchema,
  recipeEngagementSchema,
  recipeIdParamsSchema,
  recipeListItemSchema,
  recipeNoteIdParamsSchema,
  recipeNoteSchema,
  recipeRevisionDetailSchema,
  recipeRevisionParamsSchema,
  recipeRevisionSummarySchema,
  restoreRevisionBodySchema,
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
        summary: 'Save a complete user revision without mutating the original import',
        params: recipeIdParamsSchema,
        body: patchRecipeBodySchema,
        response: {
          200: dataResponseSchema(recipeDetailSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.get(
    '/recipes/:id/revisions',
    {
      schema: {
        tags: ['recipes'],
        summary: 'List immutable recipe revisions',
        params: recipeIdParamsSchema,
        response: {
          200: collectionResponseSchema(recipeRevisionSummarySchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.listRevisions,
  );

  app.get(
    '/recipes/:id/revisions/:revisionId',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Get an immutable recipe revision',
        params: recipeRevisionParamsSchema,
        response: {
          200: dataResponseSchema(recipeRevisionDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getRevision,
  );

  app.post(
    '/recipes/:id/revisions/:revisionId/restore',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Restore a revision into a new head',
        params: recipeRevisionParamsSchema,
        body: restoreRevisionBodySchema,
        response: {
          200: dataResponseSchema(recipeDetailSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.restoreRevision,
  );

  app.put(
    '/recipes/:id/favorite',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Favorite a recipe (idempotent)',
        params: recipeIdParamsSchema,
        body: engagementConcurrencyBodySchema,
        response: {
          200: dataResponseSchema(recipeEngagementSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.putFavorite,
  );

  app.delete(
    '/recipes/:id/favorite',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Remove a recipe favorite (idempotent)',
        params: recipeIdParamsSchema,
        querystring: engagementConcurrencyQuerySchema,
        response: {
          200: dataResponseSchema(recipeEngagementSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.deleteFavorite,
  );

  app.put(
    '/recipes/:id/rating',
    {
      schema: {
        tags: ['recipes'],
        summary: "Set the profile's 1–5 rating",
        params: recipeIdParamsSchema,
        body: putRatingBodySchema,
        response: {
          200: dataResponseSchema(recipeEngagementSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.putRating,
  );

  app.delete(
    '/recipes/:id/rating',
    {
      schema: {
        tags: ['recipes'],
        summary: "Remove the profile's rating",
        params: recipeIdParamsSchema,
        querystring: engagementConcurrencyQuerySchema,
        response: {
          200: dataResponseSchema(recipeEngagementSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.deleteRating,
  );

  app.put(
    '/recipes/:id/review-state',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Set recipe review state (idempotent)',
        params: recipeIdParamsSchema,
        body: putReviewStateBodySchema,
        response: {
          200: dataResponseSchema(recipeEngagementSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.putReviewState,
  );

  app.get(
    '/recipes/:id/notes',
    {
      schema: {
        tags: ['recipes'],
        summary: 'List recipe notes',
        params: recipeIdParamsSchema,
        response: {
          200: collectionResponseSchema(recipeNoteSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.listNotes,
  );

  app.post(
    '/recipes/:id/notes',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Create a recipe note without creating a revision',
        params: recipeIdParamsSchema,
        body: createRecipeNoteBodySchema,
        response: {
          201: dataResponseSchema(recipeNoteSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.createNote,
  );

  app.patch(
    '/recipes/:id/notes/:noteId',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Update a recipe note',
        params: recipeNoteIdParamsSchema,
        body: patchRecipeNoteBodySchema,
        response: {
          200: dataResponseSchema(recipeNoteSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.updateNote,
  );

  app.delete(
    '/recipes/:id/notes/:noteId',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Delete a recipe note',
        params: recipeNoteIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteNoteResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.deleteNote,
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

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { collectionResponseSchema, dataResponseSchema } from '../../../shared/http/response.js';
import type { PantryService } from '../application/pantry-service.js';
import { createPantryController } from './pantry.controller.js';
import {
  createPantryItemsBodySchema,
  deletePantryItemResponseSchema,
  listPantryQuerySchema,
  organizePantryBodySchema,
  organizePantryResultSchema,
  pantryItemIdParamsSchema,
  pantryItemSchema,
  patchPantryItemBodySchema,
} from './pantry.schema.js';

export interface PantryRoutesOptions {
  pantryService: PantryService;
}

export const pantryRoutes: FastifyPluginAsyncZod<PantryRoutesOptions> = async (app, opts) => {
  const controller = createPantryController(opts.pantryService);

  app.get(
    '/pantry',
    {
      schema: {
        tags: ['pantry'],
        summary: 'List pantry items',
        querystring: listPantryQuerySchema,
        response: {
          200: collectionResponseSchema(pantryItemSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.post(
    '/pantry/organize',
    {
      schema: {
        tags: ['pantry'],
        summary: 'Organize plain-text ingredients without saving',
        body: organizePantryBodySchema,
        response: {
          200: dataResponseSchema(organizePantryResultSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.organize,
  );

  app.post(
    '/pantry/items',
    {
      schema: {
        tags: ['pantry'],
        summary: 'Save organized pantry items',
        body: createPantryItemsBodySchema,
        response: {
          201: dataResponseSchema(z.array(pantryItemSchema)),
          ...standardErrorResponses,
        },
      },
    },
    controller.create,
  );

  app.patch(
    '/pantry/items/:id',
    {
      schema: {
        tags: ['pantry'],
        summary: 'Correct a pantry item',
        params: pantryItemIdParamsSchema,
        body: patchPantryItemBodySchema,
        response: {
          200: dataResponseSchema(pantryItemSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/pantry/items/:id',
    {
      schema: {
        tags: ['pantry'],
        summary: 'Delete a pantry item',
        params: pantryItemIdParamsSchema,
        response: {
          200: dataResponseSchema(deletePantryItemResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );
};

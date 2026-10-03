import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { collectionResponseSchema, dataResponseSchema } from '../../../shared/http/response.js';
import type { ShoppingListService } from '../application/shopping-list-service.js';
import { createShoppingListController } from './shopping-list.controller.js';
import {
  clearDoneShoppingListResponseSchema,
  createShoppingListItemsBodySchema,
  deleteShoppingListItemResponseSchema,
  fromRecipeBodySchema,
  listShoppingListQuerySchema,
  patchShoppingListItemBodySchema,
  shoppingListItemIdParamsSchema,
  shoppingListItemSchema,
} from './shopping-list.schema.js';

export interface ShoppingListRoutesOptions {
  shoppingListService: ShoppingListService;
}

export const shoppingListRoutes: FastifyPluginAsyncZod<ShoppingListRoutesOptions> = async (
  app,
  opts,
) => {
  const controller = createShoppingListController(opts.shoppingListService);

  app.get(
    '/shopping-list',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'List shopping list items',
        querystring: listShoppingListQuerySchema,
        response: {
          200: collectionResponseSchema(shoppingListItemSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.post(
    '/shopping-list/items',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'Add shopping list items',
        body: createShoppingListItemsBodySchema,
        response: {
          201: dataResponseSchema(z.array(shoppingListItemSchema)),
          ...standardErrorResponses,
        },
      },
    },
    controller.create,
  );

  app.post(
    '/shopping-list/from-recipe',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'Add missing recipe ingredients to the shopping list',
        body: fromRecipeBodySchema,
        response: {
          201: dataResponseSchema(z.array(shoppingListItemSchema)),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.fromRecipe,
  );

  app.patch(
    '/shopping-list/items/:id',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'Update a shopping list item',
        params: shoppingListItemIdParamsSchema,
        body: patchShoppingListItemBodySchema,
        response: {
          200: dataResponseSchema(shoppingListItemSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/shopping-list/items/:id',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'Delete a shopping list item',
        params: shoppingListItemIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteShoppingListItemResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );

  app.post(
    '/shopping-list/clear-done',
    {
      schema: {
        tags: ['shopping-list'],
        summary: 'Remove checked shopping list items',
        response: {
          200: dataResponseSchema(clearDoneShoppingListResponseSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.clearDone,
  );
};

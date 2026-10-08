import type { FastifyReply, FastifyRequest } from 'fastify';

import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import type { ShoppingListItemView, ShoppingListService } from '../application/shopping-list-service.js';
import type {
  CreateShoppingListItemsBody,
  FromRecipeBody,
  ListShoppingListQuery,
  PatchShoppingListItemBody,
} from './shopping-list.schema.js';

function serializeItem(item: ShoppingListItemView): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    canonicalName: item.canonicalName,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    emoji: item.emoji,
    done: item.done,
    fromRecipeCount: item.fromRecipeCount,
    source: item.source,
    sourceRecipeId: item.sourceRecipeId,
    sourceMealPlanEntryId: item.sourceMealPlanEntryId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function createShoppingListController(service: ShoppingListService): {
  list: (
    request: FastifyRequest<{ Querystring: ListShoppingListQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  create: (
    request: FastifyRequest<{ Body: CreateShoppingListItemsBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  fromRecipe: (
    request: FastifyRequest<{ Body: FromRecipeBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchShoppingListItemBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  clearDone: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
} {
  return {
    list: async (request, reply): Promise<void> => {
      const { items, meta } = await service.list(request.profile.userId, request.query);
      reply.send(collectionResponse(items.map(serializeItem), meta));
    },
    create: async (request, reply): Promise<void> => {
      request.log.info(
        { step: 'http.shopping-list.create', count: request.body.items.length },
        'http.shopping-list.create started',
      );
      const items = await service.createMany(request.profile.userId, request.body);
      reply.status(201).send(dataResponse(items.map(serializeItem)));
    },
    fromRecipe: async (request, reply): Promise<void> => {
      request.log.info(
        { step: 'http.shopping-list.from-recipe', recipeId: request.body.recipeId },
        'http.shopping-list.from-recipe started',
      );
      const items = await service.addFromRecipe(request.profile.userId, request.body);
      reply.status(201).send(dataResponse(items.map(serializeItem)));
    },
    patch: async (request, reply): Promise<void> => {
      const item = await service.update(request.profile.userId, request.params.id, request.body);
      reply.send(dataResponse(serializeItem(item)));
    },
    delete: async (request, reply): Promise<void> => {
      await service.delete(request.profile.userId, request.params.id);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
    clearDone: async (request, reply): Promise<void> => {
      const count = await service.clearDone(request.profile.userId);
      reply.send(dataResponse({ deleted: true as const, count }));
    },
  };
}

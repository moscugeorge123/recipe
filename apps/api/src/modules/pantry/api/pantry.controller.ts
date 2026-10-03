import type { FastifyReply, FastifyRequest } from 'fastify';

import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import type { OrganizeResult } from '../application/ingredient-organizer.js';
import type { PantryItemView, PantryService } from '../application/pantry-service.js';
import type {
  CreatePantryItemsBody,
  ListPantryQuery,
  OrganizePantryBody,
  PatchPantryItemBody,
} from './pantry.schema.js';

function serializeItem(item: PantryItemView): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    canonicalName: item.canonicalName,
    rawText: item.rawText,
    locale: item.locale,
    promptVersion: item.promptVersion,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    emoji: item.emoji,
    colorToken: item.colorToken,
    storageLocation: item.storageLocation,
    expiresAt: item.expiresAt?.toISOString() ?? null,
    classification: item.classification,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function serializeOrganize(result: OrganizeResult): Record<string, unknown> {
  return {
    items: result.items,
    unresolved: result.unresolved,
    meta: result.meta,
  };
}

export function createPantryController(service: PantryService): {
  list: (
    request: FastifyRequest<{ Querystring: ListPantryQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  organize: (
    request: FastifyRequest<{ Body: OrganizePantryBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  create: (
    request: FastifyRequest<{ Body: CreatePantryItemsBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchPantryItemBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    list: async (request, reply): Promise<void> => {
      const { items, meta } = await service.list(request.profile.userId, request.query);
      reply.send(collectionResponse(items.map(serializeItem), meta));
    },
    organize: async (request, reply): Promise<void> => {
      request.log.info({ step: 'http.pantry.organize' }, 'http.pantry.organize started');
      const result = await service.organize(request.profile.userId, request.body);
      request.log.info(
        {
          step: 'http.pantry.organize',
          itemCount: result.items.length,
          unresolved: result.unresolved.length,
          truncated: result.meta.truncated,
        },
        'http.pantry.organize completed',
      );
      reply.send(dataResponse(serializeOrganize(result)));
    },
    create: async (request, reply): Promise<void> => {
      request.log.info(
        { step: 'http.pantry.create', count: request.body.items.length },
        'http.pantry.create started',
      );
      const items = await service.createMany(request.profile.userId, request.body);
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
  };
}

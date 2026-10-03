import type { FastifyReply, FastifyRequest } from 'fastify';

import { dataResponse } from '../../../shared/http/response.js';
import type { MealPlanEntryView, MealPlanService } from '../application/meal-plan-service.js';
import type {
  CreateMealPlanEntryBody,
  ListMealPlanQuery,
  PatchMealPlanEntryBody,
  ReorderMealPlanBody,
} from './meal-plan.schema.js';

function serializeEntry(item: MealPlanEntryView): Record<string, unknown> {
  return {
    id: item.id,
    date: item.date,
    slot: item.slot,
    kind: item.kind,
    recipeId: item.recipeId,
    note: item.note,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function createMealPlanController(service: MealPlanService): {
  list: (
    request: FastifyRequest<{ Querystring: ListMealPlanQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  create: (
    request: FastifyRequest<{ Body: CreateMealPlanEntryBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchMealPlanEntryBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  reorder: (
    request: FastifyRequest<{ Body: ReorderMealPlanBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    list: async (request, reply): Promise<void> => {
      const items = await service.list(request.profile.userId, request.query);
      reply.send(dataResponse(items.map(serializeEntry)));
    },
    create: async (request, reply): Promise<void> => {
      request.log.info(
        { step: 'http.meal-plan.create', kind: request.body.kind, date: request.body.date },
        'http.meal-plan.create started',
      );
      const entry = await service.create(request.profile.userId, request.body);
      reply.status(201).send(dataResponse(serializeEntry(entry)));
    },
    patch: async (request, reply): Promise<void> => {
      const entry = await service.update(request.profile.userId, request.params.id, request.body);
      reply.send(dataResponse(serializeEntry(entry)));
    },
    delete: async (request, reply): Promise<void> => {
      await service.delete(request.profile.userId, request.params.id);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
    reorder: async (request, reply): Promise<void> => {
      const items = await service.reorder(request.profile.userId, request.body);
      reply.send(dataResponse(items.map(serializeEntry)));
    },
  };
}

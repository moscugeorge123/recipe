import type { FastifyReply, FastifyRequest } from 'fastify';

import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import type { CookSessionService, CookSessionView } from '../application/cook-session-service.js';
import type {
  CreateCookSessionBody,
  ListCookSessionsQuery,
  PatchCookSessionBody,
} from './cook-sessions.schema.js';

function serializeCookSession(session: CookSessionView): Record<string, unknown> {
  return {
    id: session.id,
    recipeId: session.recipeId,
    status: session.status,
    currentStepIndex: session.currentStepIndex,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    totalDurationMs: session.totalDurationMs,
    steps: session.steps.map((step) => ({
      stepIndex: step.stepIndex,
      visitCount: step.visitCount,
      durationMs: step.durationMs,
      firstEnteredAt: step.firstEnteredAt.toISOString(),
      lastEnteredAt: step.lastEnteredAt.toISOString(),
    })),
    recipe: session.recipe,
  };
}

export function createCookSessionsController(service: CookSessionService): {
  create: (
    request: FastifyRequest<{ Body: CreateCookSessionBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  list: (
    request: FastifyRequest<{ Querystring: ListCookSessionsQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  getById: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchCookSessionBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    create: async (request, reply): Promise<void> => {
      const { session, resumed } = await service.create(request.body);
      reply.status(resumed ? 200 : 201).send(dataResponse(serializeCookSession(session)));
    },

    list: async (request, reply): Promise<void> => {
      const { items, meta } = await service.list(request.query);
      reply.send(collectionResponse(items.map(serializeCookSession), meta));
    },

    getById: async (request, reply): Promise<void> => {
      const session = await service.getById(request.params.id);
      reply.send(dataResponse(serializeCookSession(session)));
    },

    patch: async (request, reply): Promise<void> => {
      const session = await service.update(request.params.id, request.body);
      reply.send(dataResponse(serializeCookSession(session)));
    },

    delete: async (request, reply): Promise<void> => {
      await service.delete(request.params.id);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
  };
}

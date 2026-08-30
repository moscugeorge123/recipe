import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import {
  collectionResponseSchema,
  dataResponseSchema,
} from '../../../shared/http/response.js';
import type { CookSessionService } from '../application/cook-session-service.js';
import { createCookSessionsController } from './cook-sessions.controller.js';
import {
  cookSessionIdParamsSchema,
  cookSessionSchema,
  createCookSessionBodySchema,
  deleteCookSessionResponseSchema,
  listCookSessionsQuerySchema,
  patchCookSessionBodySchema,
} from './cook-sessions.schema.js';

export interface CookSessionsRoutesOptions {
  cookSessionService: CookSessionService;
}

export const cookSessionsRoutes: FastifyPluginAsyncZod<CookSessionsRoutesOptions> = async (
  app,
  opts,
) => {
  const controller = createCookSessionsController(opts.cookSessionService);

  app.get(
    '/cook-sessions',
    {
      schema: {
        tags: ['cook-sessions'],
        summary: 'List cook sessions',
        querystring: listCookSessionsQuerySchema,
        response: {
          200: collectionResponseSchema(cookSessionSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.list,
  );

  app.post(
    '/cook-sessions',
    {
      schema: {
        tags: ['cook-sessions'],
        summary: 'Start or resume an in-progress cook session',
        body: createCookSessionBodySchema,
        response: {
          200: dataResponseSchema(cookSessionSchema),
          201: dataResponseSchema(cookSessionSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.create,
  );

  app.get(
    '/cook-sessions/:id',
    {
      schema: {
        tags: ['cook-sessions'],
        summary: 'Get cook session by id',
        params: cookSessionIdParamsSchema,
        response: {
          200: dataResponseSchema(cookSessionSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getById,
  );

  app.patch(
    '/cook-sessions/:id',
    {
      schema: {
        tags: ['cook-sessions'],
        summary: 'Update cook session progress or status',
        params: cookSessionIdParamsSchema,
        body: patchCookSessionBodySchema,
        response: {
          200: dataResponseSchema(cookSessionSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.patch,
  );

  app.delete(
    '/cook-sessions/:id',
    {
      schema: {
        tags: ['cook-sessions'],
        summary: 'Delete cook session',
        params: cookSessionIdParamsSchema,
        response: {
          200: dataResponseSchema(deleteCookSessionResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.delete,
  );
};

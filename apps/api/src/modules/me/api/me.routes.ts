import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { dataResponse, dataResponseSchema } from '../../../shared/http/response.js';
import type { MeService } from '../application/me-service.js';
import { deleteMeResponseSchema, meSchema } from './me.schema.js';

export interface MeRoutesOptions {
  meService: MeService;
}

export const meRoutes: FastifyPluginAsyncZod<MeRoutesOptions> = async (app, opts) => {
  app.get(
    '/me',
    {
      schema: {
        tags: ['me'],
        summary: 'Get the signed-in account',
        response: {
          200: dataResponseSchema(meSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      reply.send(dataResponse(await opts.meService.get(request.profile.userId)));
    },
  );

  app.delete(
    '/me',
    {
      schema: {
        tags: ['me'],
        summary: 'Delete the signed-in account and all of its data',
        response: {
          200: dataResponseSchema(deleteMeResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      await opts.meService.delete(request.profile);
      reply.send(dataResponse({ deleted: true as const }));
    },
  );
};

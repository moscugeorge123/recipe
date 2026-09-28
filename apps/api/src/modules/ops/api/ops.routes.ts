import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import { requireAdmin } from '../../auth/application/authorization.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { OpsSummaryService } from '../application/ops-summary.service.js';
import { opsSummarySchema } from './ops.schema.js';

export interface OpsRoutesOptions {
  prisma: PrismaClient;
  /** When true (AUTH_REQUIRED), only an authenticated ADMIN may read the summary. */
  adminOnly: boolean;
}

export const opsRoutes: FastifyPluginAsyncZod<OpsRoutesOptions> = async (app, opts) => {
  const service = new OpsSummaryService(opts.prisma);

  app.get(
    '/ops/summary',
    {
      preHandler: async (request) => {
        if (opts.adminOnly) {
          requireAdmin(request.profile);
          return;
        }
        if (request.profile.mode === 'authenticated' && request.profile.role !== 'ADMIN') {
          throw new ForbiddenError();
        }
      },
      schema: {
        tags: ['ops'],
        summary: 'Operational counters for the caller profile',
        description:
          'Aggregated AI, pantry, queue, and migration counters. No recipe titles, notes, URLs, or pantry names. When AUTH_REQUIRED is set, only an authenticated admin may call this. A bearer token for a non-admin is forbidden. Revision conflicts are not stored — use the log filter in the payload.',
        response: {
          200: dataResponseSchema(opsSummarySchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const summary = await service.getSummary(request.profile.userId);
      return reply.send({ data: summary });
    },
  );
};

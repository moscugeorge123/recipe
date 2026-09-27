import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { standardErrorResponses } from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import { OpsSummaryService } from '../application/ops-summary.service.js';
import { opsSummarySchema } from './ops.schema.js';

export interface OpsRoutesOptions {
  prisma: PrismaClient;
}

export const opsRoutes: FastifyPluginAsyncZod<OpsRoutesOptions> = async (app, opts) => {
  const service = new OpsSummaryService(opts.prisma);

  app.get(
    '/ops/summary',
    {
      schema: {
        tags: ['ops'],
        summary: 'Operational counters for the singleton profile',
        description:
          'Aggregated AI, pantry, queue, and migration counters. No recipe titles, notes, URLs, or pantry names. Unauthenticated while the API uses the implicit profile; gate this behind auth when authentication ships. Revision conflicts are not stored — use the log filter in the payload.',
        response: {
          200: dataResponseSchema(opsSummarySchema),
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

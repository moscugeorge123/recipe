import type { FastifyReply, FastifyRequest } from 'fastify';

import { dataResponse } from '../../../shared/http/response.js';
import type { ExtractionJobService } from '../application/extraction-job.service.js';
import type { CreateExtractionJobBody } from './jobs.schema.js';

export function createJobsController(service: ExtractionJobService): {
  createJob: (request: FastifyRequest<{ Body: CreateExtractionJobBody }>, reply: FastifyReply) => Promise<void>;
  getJobStatus: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
  cancelJob: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
} {
  return {
    createJob: async (
      request: FastifyRequest<{ Body: CreateExtractionJobBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const result = await service.createJob(request.body);

      if (result.deduplicated) {
        reply.status(200).send(dataResponse(result));
        return;
      }

      reply.status(202).send(dataResponse(result));
    },

    getJobStatus: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const job = await service.getJobStatus(request.params.id);

      reply.send(
        dataResponse({
          id: job.id,
          status: job.status,
          progress: job.progress,
          currentStage: job.currentStage,
          recipeId: job.recipeId,
          error: job.error,
          startedAt: job.startedAt?.toISOString() ?? null,
          completedAt: job.completedAt?.toISOString() ?? null,
        }),
      );
    },

    cancelJob: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const job = await service.cancelJob(request.params.id);

      reply.send(
        dataResponse({
          id: job.id,
          status: 'CANCELLED' as const,
        }),
      );
    },
  };
}

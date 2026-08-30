import type { FastifyReply, FastifyRequest } from 'fastify';

import { dataResponse } from '../../../shared/http/response.js';
import type { LinkPreviewService } from '../../content/preview/link-preview.service.js';
import type { ExtractionJobService } from '../application/extraction-job.service.js';
import type { CreateExtractionJobBody, PreviewLinkBody } from './jobs.schema.js';

export function createJobsController(
  service: ExtractionJobService,
  linkPreviewService: LinkPreviewService,
): {
  createJob: (request: FastifyRequest<{ Body: CreateExtractionJobBody }>, reply: FastifyReply) => Promise<void>;
  previewLink: (request: FastifyRequest<{ Body: PreviewLinkBody }>, reply: FastifyReply) => Promise<void>;
  getJobStatus: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
  cancelJob: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
} {
  return {
    createJob: async (
      request: FastifyRequest<{ Body: CreateExtractionJobBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      request.log.info({ step: 'http.extract.create', url: request.body.url }, 'http.extract.create started');
      const result = await service.createJob(request.body);

      if (result.deduplicated) {
        reply.status(200).send(dataResponse(result));
        return;
      }

      reply.status(202).send(dataResponse(result));
    },

    previewLink: async (
      request: FastifyRequest<{ Body: PreviewLinkBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      request.log.info({ step: 'http.preview', url: request.body.url }, 'http.preview started');
      const result = await linkPreviewService.preview(request.body.url);
      request.log.info(
        { step: 'http.preview', sourceType: result.sourceType, thumbnailCount: result.thumbnails.length },
        'http.preview completed',
      );
      reply.send(dataResponse(result));
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

import type { FastifyReply, FastifyRequest } from 'fastify';

import { dataResponse } from '../../../shared/http/response.js';
import type { LinkPreviewService } from '../../content/preview/link-preview.service.js';
import type { ExtractionJobService } from '../application/extraction-job.service.js';
import type {
  CreateExtractionJobBody,
  CreatePhotoExtractionBody,
  PreviewLinkBody,
} from './jobs.schema.js';

export function createJobsController(
  service: ExtractionJobService,
  linkPreviewService: LinkPreviewService,
): {
  createJob: (request: FastifyRequest<{ Body: CreateExtractionJobBody }>, reply: FastifyReply) => Promise<void>;
  createPhotoJob: (
    request: FastifyRequest<{ Body: CreatePhotoExtractionBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  previewLink: (request: FastifyRequest<{ Body: PreviewLinkBody }>, reply: FastifyReply) => Promise<void>;
  listJobs: (request: FastifyRequest<{ Querystring: { limit: number } }>, reply: FastifyReply) => Promise<void>;
  getJobStatus: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
  cancelJob: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
} {
  return {
    createJob: async (
      request: FastifyRequest<{ Body: CreateExtractionJobBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      request.log.info({ step: 'http.extract.create', url: request.body.url }, 'http.extract.create started');
      const result = await service.createJob(request.profile.userId, request.body);

      if (result.deduplicated) {
        reply.status(200).send(dataResponse(result));
        return;
      }

      reply.status(202).send(dataResponse(result));
    },

    createPhotoJob: async (
      request: FastifyRequest<{ Body: CreatePhotoExtractionBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      request.log.info(
        { step: 'http.extract.photos', pages: request.body.images.length },
        'http.extract.photos started',
      );
      const result = await service.createPhotoJob(request.profile.userId, {
        images: request.body.images.map((image) => decodeBase64Image(image.data)),
        outputLanguage: request.body.outputLanguage,
      });
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

    listJobs: async (
      request: FastifyRequest<{ Querystring: { limit: number } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const jobs = await service.listJobs(request.profile.userId, request.query.limit);

      reply.send(
        dataResponse(
          jobs.map((job) => ({
            ...job,
            createdAt: job.createdAt.toISOString(),
            completedAt: job.completedAt?.toISOString() ?? null,
          })),
        ),
      );
    },

    getJobStatus: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const job = await service.getJobStatus(request.profile.userId, request.params.id);

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
      const job = await service.cancelJob(request.profile.userId, request.params.id);

      reply.send(
        dataResponse({
          id: job.id,
          status: 'CANCELLED' as const,
        }),
      );
    },
  };
}

/** Accepts raw base64 or a `data:` URL, as a camera or photo picker may hand over either. */
function decodeBase64Image(value: string): Buffer {
  const comma = value.startsWith('data:') ? value.indexOf(',') : -1;
  return Buffer.from(comma >= 0 ? value.slice(comma + 1) : value, 'base64');
}

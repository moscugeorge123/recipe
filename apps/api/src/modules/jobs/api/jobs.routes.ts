import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema, standardErrorResponses } from '../../../shared/errors/error-response.js';
import { dataResponseSchema } from '../../../shared/http/response.js';
import type { ExtractionJobService } from '../application/extraction-job.service.js';
import { createJobsController } from './jobs.controller.js';
import {
  cancelJobResponseSchema,
  createExtractionJobBodySchema,
  extractionJobResponseSchema,
  jobIdParamsSchema,
  jobStatusResponseSchema,
} from './jobs.schema.js';

export interface JobsRoutesOptions {
  extractionJobService: ExtractionJobService;
  extractRateLimitMax?: number;
  extractRateLimitWindowMs?: number;
}

export const jobsRoutes: FastifyPluginAsyncZod<JobsRoutesOptions> = async (app, opts) => {
  const controller = createJobsController(opts.extractionJobService);

  const extractRateLimit =
    opts.extractRateLimitMax && opts.extractRateLimitWindowMs
      ? {
          max: opts.extractRateLimitMax,
          timeWindow: opts.extractRateLimitWindowMs,
        }
      : true;

  app.post(
    '/recipes/extract',
    {
      config: { rateLimit: extractRateLimit },
      schema: {
        tags: ['extraction'],
        summary: 'Create extraction job',
        description:
          'Queues an async recipe extraction job. Returns 202 for new jobs or 200 when deduplicated.',
        body: createExtractionJobBodySchema,
        response: {
          200: dataResponseSchema(extractionJobResponseSchema),
          202: dataResponseSchema(extractionJobResponseSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.createJob,
  );

  app.get(
    '/recipes/extract/jobs/:id',
    {
      // Clients poll this about once a second for the lifetime of a job. A global or extract
      // cap would 429 a single Facebook/Instagram import long before the pipeline finishes.
      config: { rateLimit: false },
      schema: {
        tags: ['extraction'],
        summary: 'Get extraction job status',
        params: jobIdParamsSchema,
        response: {
          200: dataResponseSchema(jobStatusResponseSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getJobStatus,
  );

  app.post(
    '/recipes/extract/jobs/:id/cancel',
    {
      schema: {
        tags: ['extraction'],
        summary: 'Cancel extraction job',
        params: jobIdParamsSchema,
        response: {
          200: dataResponseSchema(cancelJobResponseSchema),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.cancelJob,
  );
};

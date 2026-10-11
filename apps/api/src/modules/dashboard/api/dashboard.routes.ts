import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import { collectionResponseSchema, dataResponseSchema } from '../../../shared/http/response.js';
import { paginationQuerySchema } from '../../../shared/pagination/pagination.js';
import type { DashboardService } from '../application/dashboard.service.js';
import { createDashboardController } from './dashboard.controller.js';
import {
  dashboardLogsQuerySchema,
  dashboardSummarySchema,
  importDetailSchema,
  importIdParamsSchema,
  importListItemSchema,
  logEntrySchema,
  usageReportSchema,
} from './dashboard.schema.js';

export interface DashboardRoutesOptions {
  dashboardService: DashboardService;
}

const readConfig = { rateLimit: false } as const;

export const dashboardRoutes: FastifyPluginAsyncZod<DashboardRoutesOptions> = async (app, opts) => {
  const controller = createDashboardController(opts.dashboardService);

  app.get(
    '/dashboard/summary',
    {
      config: readConfig,
      schema: {
        tags: ['dashboard'],
        summary: 'Import dashboard summary',
        response: {
          200: dataResponseSchema(dashboardSummarySchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.summary,
  );

  app.get(
    '/dashboard/imports',
    {
      config: readConfig,
      schema: {
        tags: ['dashboard'],
        summary: 'List recipe imports',
        querystring: paginationQuerySchema,
        response: {
          200: collectionResponseSchema(importListItemSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.listImports,
  );

  app.get(
    '/dashboard/imports/:id',
    {
      config: readConfig,
      schema: {
        tags: ['dashboard'],
        summary: 'Get one recipe import',
        params: importIdParamsSchema,
        response: {
          200: dataResponseSchema(importDetailSchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    controller.getImport,
  );

  app.get(
    '/dashboard/usage',
    {
      config: readConfig,
      schema: {
        tags: ['dashboard'],
        summary: 'AI usage grouped by model',
        response: {
          200: dataResponseSchema(usageReportSchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.usage,
  );

  app.get(
    '/dashboard/logs',
    {
      config: readConfig,
      schema: {
        tags: ['dashboard'],
        summary: 'Recent application logs',
        querystring: dashboardLogsQuerySchema,
        response: {
          200: collectionResponseSchema(logEntrySchema),
          ...standardErrorResponses,
        },
      },
    },
    controller.logs,
  );
};

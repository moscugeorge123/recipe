import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { healthResponseSchema, type HealthResponse } from './health.schema.js';
import { createHealthService } from './health.service.js';
import type { DependencyCheck, HealthReport } from './health.types.js';

export interface HealthRoutesOptions {
  /** Set for the load-balancer-facing `/health` route so the docs list it only once. */
  hideFromDocs?: boolean;
  /**
   * Dependency probes to include in the report. Empty today; pass them from `app.ts` as
   * external dependencies are introduced, e.g. `{ checks: [databaseCheck(pool)] }`.
   */
  checks?: DependencyCheck[];
}

/** Explicit mapping keeps internal error details out of the public response. */
function toHealthResponse(report: HealthReport): HealthResponse {
  if (report.checks.length === 0) {
    return { status: report.status };
  }

  return {
    status: report.status,
    checks: report.checks.map((check) => ({
      name: check.name,
      status: check.status,
      durationMs: check.durationMs,
    })),
  };
}

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, options) => {
  const healthService = createHealthService(options.checks ?? []);

  app.get(
    '/health',
    {
      // Health checks must never be throttled: the ALB polls this endpoint continuously and a
      // 429 would take healthy tasks out of service.
      config: { rateLimit: false },
      schema: {
        hide: options.hideFromDocs ?? false,
        tags: ['health'],
        summary: 'Service health',
        description:
          'Returns 200 while the service and all registered dependencies are usable, 503 otherwise. Requires no authentication.',
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const report = await healthService.getReport();

      if (report.status !== 'ok') {
        const failed = report.checks.filter((check) => check.status === 'error');
        request.log.error({ failedChecks: failed }, 'Health check failed');
      }

      return reply.status(report.status === 'ok' ? 200 : 503).send(toHealthResponse(report));
    },
  );
};

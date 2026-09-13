import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { config as defaultConfig, type AppConfig } from '../config/env.js';
import { healthRoutes } from '../features/health/health.routes.js';
import type { DependencyCheck } from '../features/health/health.types.js';
import { cookSessionsRoutes } from '../modules/cook-sessions/api/cook-sessions.routes.js';
import { categoriesRoutes } from '../modules/categories/api/categories.routes.js';
import { jobsRoutes } from '../modules/jobs/api/jobs.routes.js';
import { recipesRoutes } from '../modules/recipes/api/recipes.routes.js';
import { nutritionRoutes } from '../modules/nutrition/api/nutrition.routes.js';
import { collectionsRoutes } from '../modules/collections/api/collections.routes.js';
import { pantryRoutes } from '../modules/pantry/api/pantry.routes.js';
import { mealPlanRoutes } from '../modules/meal-plan/api/meal-plan.routes.js';
import { shoppingListRoutes } from '../modules/shopping-list/api/shopping-list.routes.js';
import { opsRoutes } from '../modules/ops/api/ops.routes.js';
import { createLogger, type AppLogger } from '../infrastructure/logging/logger.js';
import type { AppContainer } from '../shared/di/container.js';
import { createContainer } from '../shared/di/container.js';
import { registerCors } from './plugins/cors.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerProfileContext } from './plugins/profile-context.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerRequestId, REQUEST_ID_HEADER, resolveRequestId } from './plugins/request-id.js';
import { registerSecurityHeaders } from './plugins/security-headers.js';
import { registerSwagger } from './plugins/swagger.js';

export interface BuildAppOptions {
  /** Overrides the process configuration. Used by tests to exercise specific settings. */
  config?: AppConfig;
  /**
   * Dependency probes reported by the health endpoints. This is where a database or cache check
   * gets wired in once such a dependency exists; the health feature needs no changes.
   */
  healthChecks?: DependencyCheck[];
  /** Pre-built container for tests; defaults to production container when omitted. */
  container?: AppContainer;
  /** Shared with the container so API and pipeline lines land in the same daily file. */
  logger?: AppLogger;
  /** Runs the idempotent singleton/category repair at a real process boundary. */
  bootstrapProfile?: boolean;
}

/**
 * Creates and configures the Fastify instance without binding a port.
 *
 * Keeping construction separate from listening (`server.ts`) means tests can drive the whole
 * application through `app.inject()` with no sockets, and it keeps the door open for other
 * entry points (for example an `@fastify/aws-lambda` handler) without touching this file.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? defaultConfig;
  const logger = options.logger ?? (await createLogger(config));
  const container = options.container ?? createContainer({ logger });

  if (options.bootstrapProfile === true) {
    await container.profileBootstrap.ensureDefaults();
  }

  const app = Fastify({
    // Widen AppLogger so the returned Fastify instance remains compatible with route plugins.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    loggerInstance: logger as FastifyBaseLogger,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    // Request ids are resolved by our own function so untrusted header values are validated.
    requestIdHeader: false,
    genReqId: resolveRequestId,
    // Required behind an ALB for correct client IPs (rate limiting, logging).
    trustProxy: config.server.trustProxy,
    bodyLimit: config.server.bodyLimitBytes,
    routerOptions: {
      // Caps `:param` length, which bounds URL size along with Node's header limit.
      maxParamLength: config.server.maxParamLength,
    },
    requestTimeout: config.server.requestTimeoutMs,
    keepAliveTimeout: config.server.keepAliveTimeoutMs,
    // Reject `__proto__` / `constructor` payloads outright rather than sanitising them.
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
  });

  // Zod validates every request and serialises every response, and the same schemas produce
  // the OpenAPI document.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerRequestId(app);
  await registerSecurityHeaders(app, config);
  await registerCors(app, config);
  // Registered before the error handler so unmatched routes can be rate limited too.
  await registerRateLimit(app, config);
  registerErrorHandler(app);
  await registerSwagger(app, config);

  /*
   * AUTHENTICATION EXTENSION POINT
   * ------------------------------
   * Nothing is implemented here on purpose. When authentication is added:
   *
   *   1. Create `app/plugins/auth.ts` that verifies the credential (e.g. a Cognito JWT) and
   *      decorates the request with the caller: `request.auth = { userId, scopes }`.
   *   2. Expose it as a route-level hook, not a global one, so public endpoints stay public:
   *        app.decorate('authenticate', async (request) => { ... throw new UnauthorizedError() })
   *   3. Opt individual routes in:
   *        app.get('/private', { preHandler: [app.authenticate], schema }, handler)
   *   4. Throw `UnauthorizedError` / `ForbiddenError`; the error handler already maps them to
   *      401/403 with the standard envelope. Document them per protected route by adding
   *      `401: errorResponseSchema` to that route's `response` map.
   *
   * `/health` must remain unauthenticated for the load balancer.
   */

  const healthChecks = options.healthChecks ?? [];

  // Infrastructure-facing liveness probe. Hidden from the docs because `${prefix}/health`
  // documents the same contract for API consumers.
  await app.register(healthRoutes, { hideFromDocs: true, checks: healthChecks });

  await app.register(
    async (versioned) => {
      await versioned.register(healthRoutes, { checks: healthChecks });
      await versioned.register(async (resources) => {
        registerProfileContext(resources, container.profileResolver);
        await resources.register(jobsRoutes, {
          extractionJobService: container.extractionJobService,
          linkPreviewService: container.linkPreviewService,
          extractRateLimitMax: config.extraction.extractRateLimitMax,
          extractRateLimitWindowMs: config.extraction.extractRateLimitWindowMs,
        });
        await resources.register(recipesRoutes, {
          recipeService: container.recipeService,
        });
        await resources.register(nutritionRoutes, {
          nutritionService: container.nutritionService,
        });
        await resources.register(categoriesRoutes, {
          categoryService: container.categoryService,
          recipeService: container.recipeService,
        });
        await resources.register(cookSessionsRoutes, {
          cookSessionService: container.cookSessionService,
        });
        await resources.register(pantryRoutes, {
          pantryService: container.pantryService,
        });
        await resources.register(shoppingListRoutes, {
          shoppingListService: container.shoppingListService,
        });
        await resources.register(mealPlanRoutes, {
          mealPlanService: container.mealPlanService,
        });
        await resources.register(collectionsRoutes, {
          collectionService: container.collectionService,
        });
        await resources.register(opsRoutes, {
          prisma: container.prisma,
        });
      });
    },
    { prefix: config.api.prefix },
  );

  app.log.info(
    {
      apiPrefix: config.api.prefix,
      docsEnabled: config.api.docsEnabled,
      corsOrigins: config.cors.origins.length,
      rateLimitEnabled: config.rateLimit.enabled,
      requestIdHeader: REQUEST_ID_HEADER,
      logDirectory: config.logging.directory,
    },
    'Application configured',
  );

  return app;
}

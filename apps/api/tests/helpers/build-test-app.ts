import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app/app.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import type { DependencyCheck } from '../../src/features/health/health.types.js';
import { createTestContainer, type AppContainer } from '../../src/shared/di/container.js';

export interface TestAppOptions {
  /** Raw environment overrides, validated through the real configuration schema. */
  env?: Record<string, string>;
  /** Runs before `ready()`, for tests that need to add routes or hooks. */
  setup?: (app: FastifyInstance) => Promise<void> | void;
  /** Stand-ins for future dependency probes (database, cache, ...). */
  healthChecks?: DependencyCheck[];
  /** Pre-built container; defaults to test container with in-memory queue. */
  container?: AppContainer;
}

export function testConfig(env: Record<string, string> = {}): AppConfig {
  return loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env });
}

/**
 * Builds the real application in-process. Requests are driven with `app.inject()`, so no port
 * is bound and no AWS service, database or network access is involved.
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const container = options.container ?? createTestContainer();

  const app = await buildApp({
    config: testConfig(options.env),
    healthChecks: options.healthChecks ?? [],
    container,
  });

  await options.setup?.(app);
  await app.ready();

  return app;
}

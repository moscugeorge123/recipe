import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app/app.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import type { DependencyCheck } from '../../src/features/health/health.types.js';
import {
  FakeAccountDeleter,
  FakeTokenVerifier,
} from '../../src/infrastructure/auth/fake-token-verifier.js';
import { PrismaUserRepository } from '../../src/infrastructure/database/repositories/user.repository.js';
import { prisma } from '../../src/infrastructure/database/prisma/client.js';
import { FirebaseProfileResolver } from '../../src/modules/profiles/application/firebase-profile-resolver.js';
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
  /**
   * Authenticate with fake bearer tokens instead of the implicit default profile. Ignored when
   * `container` is given (build it with {@link createFakeAuthContainer}).
   */
  fakeAuth?: boolean;
}

/**
 * Container whose requests authenticate with fake tokens (`fakeBearer(uid, email)` from
 * `fake-token-verifier.ts`) and resolve to real `users` rows, exactly like Firebase mode.
 * `accountDeleter` records what `DELETE /me` asked Firebase to remove.
 */
export function createFakeAuthContainer(
  accountDeleter: FakeAccountDeleter = new FakeAccountDeleter(),
): AppContainer {
  return createTestContainer({
    profileResolver: new FirebaseProfileResolver(
      new FakeTokenVerifier(),
      new PrismaUserRepository(prisma),
    ),
    accountDeleter,
  });
}

export function testConfig(env: Record<string, string> = {}): AppConfig {
  return loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    LOG_DIR: '',
    ...env,
  });
}

/**
 * Builds the real application in-process. Requests are driven with `app.inject()`, so no port
 * is bound and no AWS service, database or network access is involved.
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const container =
    options.container ??
    (options.fakeAuth === true ? createFakeAuthContainer() : createTestContainer());

  const app = await buildApp({
    config: testConfig(options.env),
    healthChecks: options.healthChecks ?? [],
    container,
  });

  await options.setup?.(app);
  await app.ready();

  return app;
}

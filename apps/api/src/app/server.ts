import type { FastifyInstance } from 'fastify';

import { config as defaultConfig, type AppConfig } from '../config/env.js';
import { prisma } from '../infrastructure/database/prisma/client.js';
import { initSentry } from '../infrastructure/observability/sentry.js';
import { getRedisClient } from '../infrastructure/redis/client.js';
import type { DependencyCheck } from '../features/health/health.types.js';
import { buildApp } from './app.js';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

function createHealthChecks(): DependencyCheck[] {
  return [
    {
      name: 'database',
      check: async (): Promise<void> => {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    {
      name: 'redis',
      check: async (): Promise<void> => {
        const redis = getRedisClient();
        if (redis.status !== 'ready') {
          await redis.connect();
        }
        await redis.ping();
      },
    },
  ];
}

/**
 * Graceful shutdown.
 *
 * ECS/Fargate sends SIGTERM when a task is being replaced (deploys, scaling, spot interruption)
 * and follows with SIGKILL after `stopTimeout`. Handling it properly is what makes rolling
 * deployments invisible to the mobile client:
 *
 *   1. `app.close()` stops the server accepting new connections,
 *   2. in-flight requests are allowed to finish,
 *   3. `onClose` hooks release resources (add database pools and queue consumers there),
 *   4. the process exits on its own once the event loop is empty.
 *
 * A watchdog forces an exit if step 2 or 3 hangs, so a stuck request cannot keep a task alive
 * until SIGKILL. Keep `SHUTDOWN_TIMEOUT_MS` below the ECS `stopTimeout`.
 */
export function registerShutdownHandlers(app: FastifyInstance, config: AppConfig): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      app.log.warn({ signal }, 'Shutdown already in progress');
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, 'Shutdown initiated, draining connections');

    // `unref` so this timer never keeps an otherwise idle process alive.
    const watchdog = setTimeout(() => {
      app.log.error(
        { timeoutMs: config.server.shutdownTimeoutMs },
        'Graceful shutdown timed out, forcing exit',
      );
      process.exit(1);
    }, config.server.shutdownTimeoutMs);
    watchdog.unref();

    app
      .close()
      .then(() => {
        clearTimeout(watchdog);
        app.log.info('Shutdown complete');
      })
      .catch((error: unknown) => {
        clearTimeout(watchdog);
        app.log.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      });
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      shutdown(signal);
    });
  }

  // A process in an unknown state must not keep serving traffic: log, then let the platform
  // replace the task.
  process.on('unhandledRejection', (reason: unknown) => {
    app.log.fatal({ err: reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
    process.exitCode = 1;
  });

  process.on('uncaughtException', (error: Error) => {
    app.log.fatal({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException');
    process.exitCode = 1;
  });
}

/** Builds the application, wires shutdown handling and starts listening. */
export async function startServer(config: AppConfig = defaultConfig): Promise<FastifyInstance> {
  initSentry(config);

  const healthChecks = config.isTest ? [] : createHealthChecks();
  const app = await buildApp({ config, healthChecks });

  registerShutdownHandlers(app, config);

  // Binding to 0.0.0.0 by default is required for container networking.
  await app.listen({ host: config.server.host, port: config.server.port });

  return app;
}

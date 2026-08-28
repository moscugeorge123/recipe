import * as Sentry from '@sentry/node';

import type { AppConfig } from '../../config/env.js';

export function initSentry(config: AppConfig): void {
  if (!config.sentry?.dsn) {
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    release: config.service.version,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export { Sentry };

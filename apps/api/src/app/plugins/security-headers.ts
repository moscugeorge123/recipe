import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/env.js';

/**
 * Secure HTTP response headers.
 *
 * Most of Helmet's defaults target HTML documents and are cheap insurance for a JSON API.
 * The Content-Security-Policy is relaxed just enough for Swagger UI's inline assets when
 * documentation is enabled; API responses themselves are unaffected either way.
 */
export async function registerSecurityHeaders(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: config.api.docsEnabled
      ? {
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
          },
        }
      : // Helmet's strict default policy: nothing loads anything, which is right for JSON.
        true,
    // Swagger UI loads its own assets; COEP would block them without adding any value here.
    crossOriginEmbedderPolicy: false,
    // Only meaningful over HTTPS (TLS terminates at the load balancer), harmless otherwise.
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
    },
  });
}

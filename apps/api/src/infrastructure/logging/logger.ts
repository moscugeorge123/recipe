import { stdTimeFunctions } from 'pino';
import type { FastifyRequest, FastifyServerOptions } from 'fastify';

import type { AppConfig } from '../../config/env.js';

/** Exactly the object Fastify accepts for its `logger` option, minus the `boolean` shorthand. */
export type LoggerOptions = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;

/**
 * Structured JSON logging configuration.
 *
 * The output is one JSON object per line, which CloudWatch Logs ingests natively and
 * can query with Logs Insights. Fastify performs the actual request/response logging,
 * so the application never logs requests a second time.
 */

/**
 * Values that must never reach the logs. Pino redacts these paths regardless of which
 * serializer produced them, so an accidental `log.info({ headers })` is still safe.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'headers["x-api-key"]',
  '*.password',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.secret',
  'password',
  'accessToken',
  'refreshToken',
  'idToken',
  'secret',
];

/**
 * Deliberately minimal request logging: method, URL and route.
 * Headers are omitted entirely (they carry credentials) and the client IP is omitted
 * because it is personal data. Add `remoteAddress` here if your compliance posture allows it.
 */
function serializeRequest(request: FastifyRequest): Record<string, unknown> {
  return {
    method: request.method,
    url: request.url,
    routeUrl: request.routeOptions.url,
  };
}

function serializeReply(reply: { statusCode: number }): Record<string, unknown> {
  return {
    statusCode: reply.statusCode,
  };
}

export function buildLoggerOptions(config: AppConfig): LoggerOptions {
  const options: LoggerOptions = {
    level: config.logging.level,
    // ISO-8601 instead of epoch millis so log lines are readable in the CloudWatch console.
    timestamp: stdTimeFunctions.isoTime,
    // CloudWatch metric filters and Logs Insights match on level names far more easily than numbers.
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: config.service.name,
      version: config.service.version,
      env: config.nodeEnv,
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
      remove: false,
    },
    serializers: {
      req: serializeRequest,
      res: serializeReply,
    },
  };

  // Human-readable logs for local development only. `pino-pretty` is a devDependency and is
  // intentionally absent from the production image.
  if (config.nodeEnv === 'development') {
    return {
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,version,env',
        },
      },
    };
  }

  return options;
}

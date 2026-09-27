import { createRequire } from 'node:module';
import path from 'node:path';

import pino, {
  stdTimeFunctions,
  type DestinationStream,
  type Logger,
  type StreamEntry,
} from 'pino';

const require = createRequire(import.meta.url);
import type { FastifyRequest, FastifyServerOptions } from 'fastify';

import type { AppConfig } from '../../config/env.js';

/** Exactly the object Fastify accepts for its `logger` option, minus the `boolean` shorthand. */
export type LoggerOptions = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;

export type AppLogger = Logger;

export interface FileRollOptions {
  file: string;
  frequency: 'daily';
  mkdir: true;
  extension: '.log';
  dateFormat: 'yyyy-MM-dd';
  limit: { count: number };
  sync: true;
  minLength: 0;
}

/**
 * Structured JSON logging configuration.
 *
 * Stdout stays the CloudWatch path. In every environment except `test`, logs are also written to
 * daily files under `LOG_DIR` (default `./logs`) as `<service>.YYYY-MM-DD.log`.
 *
 * Pretty-print and file destinations run in-process (`pino.multistream`). Worker-thread transports
 * drop lines under `tsx watch`, which is how local API/worker processes start.
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

export type LogProcessName = 'api' | 'worker';

export interface CreateLoggerOptions {
  /** Tags every line so API and worker output can be told apart in the shared files. */
  processName?: LogProcessName;
}

/** Name of the daily file that only receives job-scoped lines (every import step). */
export const IMPORT_LOG_FILE = 'import';

export function buildFileRollOptions(
  config: AppConfig,
  fileName: string = config.service.name,
): FileRollOptions | undefined {
  if (config.nodeEnv === 'test' || !config.logging.directory) {
    return undefined;
  }

  return {
    file: path.resolve(config.logging.directory, fileName),
    frequency: 'daily',
    mkdir: true,
    extension: '.log',
    dateFormat: 'yyyy-MM-dd',
    limit: { count: 14 },
    sync: true,
    minLength: 0,
  };
}

export function buildLoggerOptions(
  config: AppConfig,
  options: CreateLoggerOptions = {},
): LoggerOptions {
  return {
    level: config.logging.level,
    timestamp: stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: config.service.name,
      version: config.service.version,
      env: config.nodeEnv,
      ...(options.processName ? { process: options.processName } : {}),
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
}

async function buildLogStreams(config: AppConfig): Promise<StreamEntry[]> {
  if (config.nodeEnv === 'test') {
    return [];
  }

  const streams: StreamEntry[] = [];

  if (config.nodeEnv === 'development') {
    const pretty = (await import('pino-pretty')).default;
    streams.push({
      stream: pretty({
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,version,env',
        destination: 1,
      }),
    });
  } else if (config.logging.directory) {
    streams.push({
      stream: pino.destination({ dest: 1, sync: false }),
    });
  }

  const rollOptions = buildFileRollOptions(config);
  if (rollOptions) {
    const pinoRoll = require('pino-roll') as (opts: FileRollOptions) => Promise<DestinationStream>;
    streams.push({
      stream: await pinoRoll(rollOptions),
    });

    const importRollOptions = buildFileRollOptions(config, IMPORT_LOG_FILE);
    if (importRollOptions) {
      streams.push({
        stream: jobLinesOnly(await pinoRoll(importRollOptions)),
      });
    }
  }

  return streams;
}

/** Keeps only lines tied to an extraction job, so an import can be read without HTTP polling noise. */
export function isJobLogLine(line: string): boolean {
  return line.includes('"jobId":"');
}

function jobLinesOnly(destination: DestinationStream): DestinationStream {
  // pino.multistream drives children through write / flushSync / end.
  const target = destination as DestinationStream & { flushSync?: () => void; end?: () => void };
  return {
    write(line: string): void {
      if (isJobLogLine(line)) {
        target.write(line);
      }
    },
    flushSync(): void {
      target.flushSync?.();
    },
    end(): void {
      target.end?.();
    },
  } as DestinationStream;
}

export async function createLogger(
  config: AppConfig,
  loggerOptions: CreateLoggerOptions = {},
): Promise<AppLogger> {
  const options = buildLoggerOptions(config, loggerOptions);
  const streams = await buildLogStreams(config);
  if (streams.length === 0) {
    return pino(options);
  }
  return pino(options, pino.multistream(streams));
}

export function silentLogger(): AppLogger {
  return pino({ level: 'silent' });
}

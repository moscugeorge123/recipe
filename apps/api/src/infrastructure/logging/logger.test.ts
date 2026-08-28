import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../config/env.js';
import { buildLoggerOptions } from './logger.js';

describe('buildLoggerOptions', () => {
  it('uses the configured level and tags every line with the service identity', () => {
    const options = buildLoggerOptions(
      loadConfig({ NODE_ENV: 'production', LOG_LEVEL: 'warn', SERVICE_NAME: 'recipes-api' }),
    );

    expect(options.level).toBe('warn');
    expect(options.base).toEqual({ service: 'recipes-api', version: '0.1.0', env: 'production' });
  });

  it('emits level names rather than numbers, for CloudWatch queries', () => {
    const options = buildLoggerOptions(loadConfig({ NODE_ENV: 'production' }));

    expect(options.formatters?.level?.('warn', 40)).toEqual({ level: 'warn' });
  });

  it('redacts credentials and tokens wherever they appear', () => {
    const options = buildLoggerOptions(loadConfig({ NODE_ENV: 'production' }));
    const redact = options.redact;

    expect(redact).toMatchObject({ censor: '[REDACTED]' });
    const paths = typeof redact === 'object' && 'paths' in redact ? redact.paths : [];
    expect(paths).toContain('req.headers.authorization');
    expect(paths).toContain('req.headers.cookie');
    expect(paths).toContain('*.password');
    expect(paths).toContain('*.accessToken');
  });

  it('logs only the method, URL and route for a request, never headers', () => {
    const options = buildLoggerOptions(loadConfig({ NODE_ENV: 'production' }));

    // A stand-in for the parts of FastifyRequest the serializer reads.
    const request = {
      method: 'POST',
      url: '/api/v1/example?token=secret-value',
      routeOptions: { url: '/api/v1/example' },
      headers: { authorization: 'Bearer super-secret' },
      ip: '203.0.113.7',
    } as unknown as FastifyRequest;

    const serialized = options.serializers?.['req']?.(request);

    expect(serialized).toEqual({
      method: 'POST',
      url: '/api/v1/example?token=secret-value',
      routeUrl: '/api/v1/example',
    });
    // Headers and client IP are structurally absent, not merely redacted.
    expect(JSON.stringify(serialized)).not.toContain('super-secret');
    expect(JSON.stringify(serialized)).not.toContain('203.0.113.7');
  });

  it('reduces a reply to its status code', () => {
    const options = buildLoggerOptions(loadConfig({ NODE_ENV: 'production' }));

    expect(options.serializers?.['res']?.({ statusCode: 201 })).toEqual({ statusCode: 201 });
  });

  it('uses ISO timestamps', () => {
    const options = buildLoggerOptions(loadConfig({ NODE_ENV: 'production' }));

    expect(typeof options.timestamp).toBe('function');
    const timestamp = (options.timestamp as () => string)();
    expect(timestamp).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T/);
  });

  it('pretty-prints in development only', () => {
    expect(buildLoggerOptions(loadConfig({ NODE_ENV: 'development' })).transport).toMatchObject({
      target: 'pino-pretty',
    });
    // `pino-pretty` is a devDependency and is absent from the production image.
    expect(buildLoggerOptions(loadConfig({ NODE_ENV: 'production' })).transport).toBeUndefined();
    expect(buildLoggerOptions(loadConfig({ NODE_ENV: 'test' })).transport).toBeUndefined();
  });
});

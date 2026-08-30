import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../config/env.js';
import { buildFileRollOptions, buildLoggerOptions, createLogger } from './logger.js';

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

  it('does not attach a transport (streams are wired in createLogger)', () => {
    expect(buildLoggerOptions(loadConfig({ NODE_ENV: 'development' })).transport).toBeUndefined();
    expect(buildLoggerOptions(loadConfig({ NODE_ENV: 'production' })).transport).toBeUndefined();
  });
});

describe('buildFileRollOptions', () => {
  it('points at a daily file named after the service', () => {
    expect(buildFileRollOptions(loadConfig({ NODE_ENV: 'development', SERVICE_NAME: 'api' }))).toEqual(
      expect.objectContaining({
        file: expect.stringContaining(`${path.sep}api`),
        frequency: 'daily',
        mkdir: true,
        dateFormat: 'yyyy-MM-dd',
        sync: true,
      }),
    );
    expect(
      buildFileRollOptions(loadConfig({ NODE_ENV: 'production', SERVICE_NAME: 'worker' })),
    ).toEqual(
      expect.objectContaining({
        file: expect.stringContaining(`${path.sep}worker`),
        frequency: 'daily',
      }),
    );
  });

  it('is off in tests and when LOG_DIR is empty', () => {
    expect(buildFileRollOptions(loadConfig({ NODE_ENV: 'test' }))).toBeUndefined();
    expect(buildFileRollOptions(loadConfig({ NODE_ENV: 'production', LOG_DIR: '' }))).toBeUndefined();
  });
});

describe('createLogger', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('writes JSON lines to the daily file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'recipe-logs-'));
    dirs.push(dir);

    const log = await createLogger(
      loadConfig({
        NODE_ENV: 'production',
        LOG_DIR: dir,
        LOG_LEVEL: 'info',
        SERVICE_NAME: 'api',
      }),
    );
    log.info({ step: 'logger.test' }, 'daily file write');
    await new Promise<void>((resolve, reject) => {
      log.flush((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const files = (await readdir(dir)).filter((name) => name.endsWith('.log'));
    expect(files.length).toBeGreaterThan(0);
    const contents = await Promise.all(files.map((name) => readFile(path.join(dir, name), 'utf8')));
    expect(contents.some((text) => text.includes('daily file write'))).toBe(true);
    expect(contents.some((text) => text.includes('"step":"logger.test"'))).toBe(true);
  });
});

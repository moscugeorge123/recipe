import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadConfig } from './env.js';

describe('loadConfig', () => {
  it('applies documented defaults when nothing is set', () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe('0.0.0.0');
    expect(config.api.prefix).toBe('/api/v1');
    expect(config.logging.level).toBe('info');
    expect(config.cors.origins).toEqual([]);
    expect(config.rateLimit.enabled).toBe(true);
  });

  it('coerces numeric variables from strings', () => {
    const config = loadConfig({ PORT: '8080', RATE_LIMIT_MAX: '5' });

    expect(config.server.port).toBe(8080);
    expect(config.rateLimit.max).toBe(5);
  });

  it('parses CORS origins into a trimmed list and ignores empty entries', () => {
    const config = loadConfig({
      CORS_ORIGINS: 'http://localhost:8081, http://localhost:19006 ,,',
    });

    expect(config.cors.origins).toEqual(['http://localhost:8081', 'http://localhost:19006']);
  });

  it('enables docs outside production and disables them in production', () => {
    expect(loadConfig({ NODE_ENV: 'development' }).api.docsEnabled).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production' }).api.docsEnabled).toBe(false);
  });

  it('lets ENABLE_DOCS override the environment-based default', () => {
    expect(loadConfig({ NODE_ENV: 'production', ENABLE_DOCS: 'true' }).api.docsEnabled).toBe(true);
    expect(loadConfig({ NODE_ENV: 'development', ENABLE_DOCS: 'false' }).api.docsEnabled).toBe(
      false,
    );
  });

  it('derives environment flags', () => {
    const production = loadConfig({ NODE_ENV: 'production' });

    expect(production.isProduction).toBe(true);
    expect(production.isTest).toBe(false);
  });

  it('accepts PORT=0 to request an ephemeral port', () => {
    expect(loadConfig({ PORT: '0' }).server.port).toBe(0);
  });

  it('applies database, redis and extraction defaults', () => {
    const config = loadConfig({});

    expect(config.database.url).toContain('postgresql://');
    expect(config.redis.url).toBe('redis://localhost:6379');
    expect(config.storage.provider).toBe('local');
    expect(config.extraction.maxRetries).toBe(5);
    expect(config.extraction.queueConcurrency).toBe(2);
  });

  it('parses storage S3 config when bucket and region are set', () => {
    const config = loadConfig({
      STORAGE_PROVIDER: 's3',
      STORAGE_S3_BUCKET: 'my-bucket',
      STORAGE_S3_REGION: 'eu-west-1',
    });

    expect(config.storage.provider).toBe('s3');
    expect(config.storage.s3?.bucket).toBe('my-bucket');
    expect(config.storage.s3?.region).toBe('eu-west-1');
  });

  it.each([
    ['PORT', { PORT: 'not-a-number' }],
    ['PORT out of range', { PORT: '70000' }],
    ['negative PORT', { PORT: '-1' }],
    ['NODE_ENV', { NODE_ENV: 'staging' }],
    ['LOG_LEVEL', { LOG_LEVEL: 'verbose' }],
    ['API_PREFIX without leading slash', { API_PREFIX: 'api/v1' }],
    ['RATE_LIMIT_MAX', { RATE_LIMIT_MAX: '0' }],
    ['TRUST_PROXY', { TRUST_PROXY: 'maybe' }],
  ])('rejects an invalid %s', (_name, env) => {
    expect(() => loadConfig(env)).toThrow(EnvValidationError);
  });

  it('reports every invalid variable at once', () => {
    try {
      loadConfig({ PORT: 'abc', NODE_ENV: 'staging' });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toHaveLength(2);
      expect((error as EnvValidationError).message).toContain('PORT');
      expect((error as EnvValidationError).message).toContain('NODE_ENV');
    }
  });
});

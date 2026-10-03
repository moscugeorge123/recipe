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
    expect(config.logging.directory).toBe('./logs');
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

  it('never uses the development database when NODE_ENV is test', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).database.url).toContain('recipe_api_test');
    expect(
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api',
      }).database.url,
    ).toContain('recipe_api_test');
    expect(
      loadConfig({
        NODE_ENV: 'test',
        TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api_ci',
      }).database.url,
    ).toContain('recipe_api_ci');
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
    expect(config.database.url).toContain('recipe_api');
    expect(config.redis.url).toBe('redis://localhost:6379');
    expect(config.storage.provider).toBe('local');
    expect(config.extraction.maxRetries).toBe(5);
    expect(config.extraction.queueConcurrency).toBe(2);
  });

  it('defaults pantry ingredient models and budgets', () => {
    const config = loadConfig({});

    expect(config.ai.ingredientModel).toBe('gpt-5-nano');
    expect(config.ai.ingredientFallbackModel).toBe('gpt-4.1-nano');
    expect(config.ai.ingredientEscalationModel).toBe('gpt-4o-mini');
    expect(config.ai.ingredientReasoningEffort).toBe('none');
    expect(config.ai.ingredientMaxOutputTokens).toBe(1024);
    expect(config.ai.ingredientMaxItems).toBe(40);
    expect(config.ai.ingredientPromptVersion).toBe('ingredient-enrichment-v2');
  });

  it('rejects GPT-5.6 as a pantry ingredient model', () => {
    expect(() => loadConfig({ AI_INGREDIENT_MODEL: 'gpt-5.6' })).toThrow(EnvValidationError);
    expect(() => loadConfig({ AI_INGREDIENT_FALLBACK_MODEL: 'gpt-5.6-luna' })).toThrow(
      EnvValidationError,
    );
  });

  it('parses optional Meta app credentials', () => {
    const config = loadConfig({
      META_APP_ID: 'app-id',
      META_APP_SECRET: 'app-secret',
    });

    expect(config.providers.metaAppId).toBe('app-id');
    expect(config.providers.metaAppSecret).toBe('app-secret');
    expect(loadConfig({}).providers.metaAppId).toBeUndefined();
  });

  it('defaults YTDLP_PATH to yt-dlp and accepts an override', () => {
    expect(loadConfig({}).providers.ytdlpPath).toBe('yt-dlp');
    expect(loadConfig({ YTDLP_PATH: '/usr/local/bin/yt-dlp' }).providers.ytdlpPath).toBe(
      '/usr/local/bin/yt-dlp',
    );
  });

  it('writes daily files to ./logs except in tests, and LOG_DIR="" disables them', () => {
    expect(loadConfig({}).logging.directory).toBe('./logs');
    expect(loadConfig({ NODE_ENV: 'production' }).logging.directory).toBe('./logs');
    expect(loadConfig({ NODE_ENV: 'test' }).logging.directory).toBeUndefined();
    expect(loadConfig({ LOG_DIR: '' }).logging.directory).toBeUndefined();
    expect(loadConfig({ LOG_DIR: '/var/log/recipe' }).logging.directory).toBe('/var/log/recipe');
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

  it('defaults auth to optional and keeps App Check in monitor mode', () => {
    const config = loadConfig({});

    expect(config.auth.required).toBe(false);
    expect(config.auth.phoneResendSeconds).toBe(60);
    expect(config.auth.phoneMaxAttempts).toBe(5);
    expect(config.auth.recentLoginSeconds).toBe(300);
    expect(config.firebase.appCheckEnforce).toBe(false);
  });

  it('rejects an HMAC secret in production when Firebase credentials are missing', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        AUTH_HMAC_SECRET: 'not-for-production',
      }),
    ).toThrow(EnvValidationError);
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

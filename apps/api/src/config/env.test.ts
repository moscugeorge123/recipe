import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadConfig } from './env.js';

/** Outside NODE_ENV=test the default auth mode is `firebase`, which needs a project id. */
const load = (env: NodeJS.ProcessEnv = {}) =>
  loadConfig({ FIREBASE_PROJECT_ID: 'test-project', ...env });

describe('loadConfig', () => {
  it('applies documented defaults when nothing is set', () => {
    const config = load({});

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
    const config = load({ PORT: '8080', RATE_LIMIT_MAX: '5' });

    expect(config.server.port).toBe(8080);
    expect(config.rateLimit.max).toBe(5);
  });

  it('parses CORS origins into a trimmed list and ignores empty entries', () => {
    const config = load({
      CORS_ORIGINS: 'http://localhost:8081, http://localhost:19006 ,,',
    });

    expect(config.cors.origins).toEqual(['http://localhost:8081', 'http://localhost:19006']);
  });

  it('enables docs outside production and disables them in production', () => {
    expect(load({ NODE_ENV: 'development' }).api.docsEnabled).toBe(true);
    expect(load({ NODE_ENV: 'production' }).api.docsEnabled).toBe(false);
  });

  it('lets ENABLE_DOCS override the environment-based default', () => {
    expect(load({ NODE_ENV: 'production', ENABLE_DOCS: 'true' }).api.docsEnabled).toBe(true);
    expect(load({ NODE_ENV: 'development', ENABLE_DOCS: 'false' }).api.docsEnabled).toBe(false);
  });

  it('never uses the development database when NODE_ENV is test', () => {
    expect(load({ NODE_ENV: 'test' }).database.url).toContain('recipe_api_test');
    expect(
      load({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api',
      }).database.url,
    ).toContain('recipe_api_test');
    expect(
      load({
        NODE_ENV: 'test',
        TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/recipe_api_ci',
      }).database.url,
    ).toContain('recipe_api_ci');
  });

  it('derives environment flags', () => {
    const production = load({ NODE_ENV: 'production' });

    expect(production.isProduction).toBe(true);
    expect(production.isTest).toBe(false);
  });

  it('accepts PORT=0 to request an ephemeral port', () => {
    expect(load({ PORT: '0' }).server.port).toBe(0);
  });

  it('applies database, redis and extraction defaults', () => {
    const config = load({});

    expect(config.database.url).toContain('postgresql://');
    expect(config.database.url).toContain('recipe_api');
    expect(config.redis.url).toBe('redis://localhost:6379');
    expect(config.storage.provider).toBe('local');
    expect(config.extraction.maxRetries).toBe(5);
    expect(config.extraction.queueConcurrency).toBe(2);
  });

  it('defaults pantry ingredient models and budgets', () => {
    const config = load({});

    expect(config.ai.ingredientModel).toBe('gpt-6-luna');
    expect(config.ai.ingredientFallbackModel).toBe('gpt-6-luna');
    expect(config.ai.ingredientEscalationModel).toBe('gpt-6-luna');
    expect(config.ai.ingredientReasoningEffort).toBe('none');
    expect(config.ai.ingredientMaxOutputTokens).toBe(1024);
    expect(config.ai.ingredientMaxItems).toBe(40);
    expect(config.ai.ingredientPromptVersion).toBe('ingredient-enrichment-v2');
  });

  it('defaults to the OpenAI provider', () => {
    const { ai } = load({ OPENAI_API_KEY: 'sk-test', DEEPSEEK_API_KEY: 'ds-test' });

    expect(ai.provider).toBe('openai');
    expect(ai.llmApiKey).toBe('sk-test');
    expect(ai.llmBaseUrl).toBeUndefined();
    expect(ai.defaultModel).toBe('gpt-6-luna');
    expect(ai.visionModel).toBe('gpt-6-luna');
    expect(ai.whisperModel).toBe('whisper-1');
  });

  it('maps every AI scenario onto DeepSeek models when AI_PROVIDER=deepseek', () => {
    const { ai } = load({
      AI_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'ds-test',
      OPENAI_API_KEY: 'sk-test',
      AI_DEFAULT_MODEL: 'gpt-4o',
    });

    expect(ai.provider).toBe('deepseek');
    expect(ai.llmApiKey).toBe('ds-test');
    expect(ai.llmBaseUrl).toBe('https://api.deepseek.com');
    expect(ai.defaultModel).toBe('deepseek-flash');
    expect(ai.visionModel).toBe('deepseek-flash');
    expect(ai.ingredientModel).toBe('deepseek-flash');
    expect(ai.ingredientEscalationModel).toBe('deepseek-flash');
    expect(ai.deepseekThinking).toBe(false);
    // Whisper stays on OpenAI.
    expect(ai.openaiApiKey).toBe('sk-test');
  });

  it('allows the DeepSeek models to be overridden', () => {
    const { ai } = load({
      AI_PROVIDER: 'deepseek',
      DEEPSEEK_FAST_MODEL: 'deepseek-next-fast',
    });

    expect(ai.defaultModel).toBe('deepseek-next-fast');
    expect(ai.visionModel).toBe('deepseek-next-fast');
    expect(ai.llmApiKey).toBeUndefined();
  });

  it('rejects an unknown AI provider', () => {
    expect(() => load({ AI_PROVIDER: 'other' })).toThrow(EnvValidationError);
  });

  it('parses optional Meta app credentials', () => {
    const config = load({
      META_APP_ID: 'app-id',
      META_APP_SECRET: 'app-secret',
    });

    expect(config.providers.metaAppId).toBe('app-id');
    expect(config.providers.metaAppSecret).toBe('app-secret');
    expect(load({}).providers.metaAppId).toBeUndefined();
  });

  it('defaults YTDLP_PATH to yt-dlp and accepts an override', () => {
    expect(load({}).providers.ytdlpPath).toBe('yt-dlp');
    expect(load({ YTDLP_PATH: '/usr/local/bin/yt-dlp' }).providers.ytdlpPath).toBe(
      '/usr/local/bin/yt-dlp',
    );
  });

  it('writes daily files to ./logs except in tests, and LOG_DIR="" disables them', () => {
    expect(load({}).logging.directory).toBe('./logs');
    expect(load({ NODE_ENV: 'production' }).logging.directory).toBe('./logs');
    expect(load({ NODE_ENV: 'test' }).logging.directory).toBeUndefined();
    expect(load({ LOG_DIR: '' }).logging.directory).toBeUndefined();
    expect(load({ LOG_DIR: '/var/log/recipe' }).logging.directory).toBe('/var/log/recipe');
  });

  it('parses storage S3 config when bucket and region are set', () => {
    const config = load({
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
    expect(() => load(env)).toThrow(EnvValidationError);
  });

  it('reports every invalid variable at once', () => {
    try {
      load({ PORT: 'abc', NODE_ENV: 'staging' });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toHaveLength(2);
      expect((error as EnvValidationError).message).toContain('PORT');
      expect((error as EnvValidationError).message).toContain('NODE_ENV');
    }
  });
});

describe('loadConfig authentication', () => {
  const serviceAccount = Buffer.from(
    JSON.stringify({
      project_id: 'tortie-test',
      client_email: 'svc@tortie-test.iam.gserviceaccount.com',
      private_key: 'PRIVATE-KEY-PLACEHOLDER',
    }),
  ).toString('base64');

  it('defaults to implicit in tests and firebase everywhere else', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).auth.mode).toBe('implicit');
    expect(loadConfig({ FIREBASE_PROJECT_ID: 'p' }).auth.mode).toBe('firebase');
    expect(loadConfig({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'p' }).auth.mode).toBe(
      'firebase',
    );
  });

  it('requires a project id in firebase mode', () => {
    expect(() => loadConfig({})).toThrow(EnvValidationError);
    expect(() => loadConfig({ AUTH_MODE: 'firebase', NODE_ENV: 'test' })).toThrow(
      /FIREBASE_PROJECT_ID/,
    );
    expect(() => loadConfig({ FIREBASE_PROJECT_ID: '  ' })).toThrow(EnvValidationError);
  });

  it('allows implicit outside production without a project id', () => {
    const config = loadConfig({ NODE_ENV: 'development', AUTH_MODE: 'implicit' });

    expect(config.auth.mode).toBe('implicit');
    expect(config.auth.firebaseProjectId).toBeUndefined();
  });

  it('rejects implicit auth in production', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'implicit', FIREBASE_PROJECT_ID: 'p' }),
    ).toThrow(/AUTH_MODE/);
  });

  it('rejects an unknown auth mode', () => {
    expect(() => loadConfig({ AUTH_MODE: 'basic', FIREBASE_PROJECT_ID: 'p' })).toThrow(
      EnvValidationError,
    );
  });

  it('groups the Firebase settings and treats empty values as unset', () => {
    const config = loadConfig({
      FIREBASE_PROJECT_ID: 'tortie-test',
      FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccount,
      AUTH_CHECK_REVOKED: 'true',
    });

    expect(config.auth).toEqual({
      mode: 'firebase',
      firebaseProjectId: 'tortie-test',
      firebaseServiceAccountJson: serviceAccount,
      checkRevoked: true,
    });

    const blank = loadConfig({ FIREBASE_PROJECT_ID: 'p', FIREBASE_SERVICE_ACCOUNT_JSON: '' });
    expect(blank.auth.firebaseServiceAccountJson).toBeUndefined();
    expect(blank.auth.checkRevoked).toBe(false);
  });

  it('rejects a service account that is not base64 JSON without echoing it', () => {
    const secret = 'definitely-not-base64-json';

    try {
      loadConfig({ FIREBASE_PROJECT_ID: 'p', FIREBASE_SERVICE_ACCOUNT_JSON: secret });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).message).toContain('FIREBASE_SERVICE_ACCOUNT_JSON');
      expect((error as EnvValidationError).message).not.toContain(secret);
    }
  });

  it('rejects a service account missing required fields', () => {
    const incomplete = Buffer.from(JSON.stringify({ project_id: 'p' })).toString('base64');

    expect(() =>
      loadConfig({ FIREBASE_PROJECT_ID: 'p', FIREBASE_SERVICE_ACCOUNT_JSON: incomplete }),
    ).toThrow(/client_email/);
  });
});

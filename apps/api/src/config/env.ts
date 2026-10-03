import { z } from 'zod';

/**
 * Centralised environment configuration.
 *
 * Environment variables are the only supported way to configure the application,
 * which keeps it compatible with ECS task definitions, Secrets Manager and
 * SSM Parameter Store without any code changes.
 *
 * The raw `KEY=value` shape is an implementation detail of this module: the rest of
 * the application consumes the grouped, strongly typed `AppConfig` object.
 */

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const commaSeparatedList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )
  .pipe(z.array(z.string().min(1)));

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HOST: z.string().min(1).default('0.0.0.0'),
  /** 0 asks the OS for a free port, which tests rely on to avoid collisions. */
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),

  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /**
   * Directory for daily log files (`<service>.YYYY-MM-DD.log`). Default `./logs` outside tests.
   * Set to an empty string to disable file logging (stdout only).
   */
  LOG_DIR: z.string().optional(),

  SERVICE_NAME: z.string().min(1).default('api'),
  SERVICE_VERSION: z.string().min(1).default('0.1.0'),

  API_PREFIX: z
    .string()
    .regex(/^\/[a-z0-9/_-]*$/i, 'API_PREFIX must start with "/" and contain no whitespace')
    .default('/api/v1'),

  /** Leave empty to reject all cross-origin browser requests. Native mobile clients are unaffected. */
  CORS_ORIGINS: commaSeparatedList.default([]),

  /** Enables Swagger UI. Defaults to disabled in production. */
  ENABLE_DOCS: z.stringbool().optional(),

  /** Required when running behind an ALB so client IPs (and rate limiting) work correctly. */
  TRUST_PROXY: z.stringbool().default(false),

  BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024)
    .default(1024 * 1024),
  MAX_PARAM_LENGTH: z.coerce.number().int().positive().max(4096).default(128),

  RATE_LIMIT_ENABLED: z.stringbool().default(true),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
  /** Must exceed the ALB idle timeout (60s by default) to avoid spurious 502s. */
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(72_000),

  /** How long in-flight requests are given to finish after SIGTERM. */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- Database ----------------------------------------------------------------
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/recipe_api'),
  /** Used when NODE_ENV=test. Never point this at the development `recipe_api` database. */
  TEST_DATABASE_URL: z.string().min(1).optional(),

  // --- Redis / queue -----------------------------------------------------------
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // --- Storage -----------------------------------------------------------------
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('./storage'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),

  // --- AI ----------------------------------------------------------------------
  OPENAI_API_KEY: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().min(1).default('gpt-4o-mini'),
  AI_WHISPER_MODEL: z.string().min(1).default('whisper-1'),
  // gpt-4o-mini bills each high-detail frame at ~37k tokens; gpt-4.1-mini at ~2.5k.
  AI_VISION_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  AI_MAX_RETRIES: z.coerce.number().int().nonnegative().max(10).default(5),
  AI_INGREDIENT_MODEL: z
    .string()
    .min(1)
    .default('gpt-5-nano')
    .refine((value) => !/gpt-5\.6/i.test(value), 'GPT-5.6 is not allowed for pantry organization'),
  AI_INGREDIENT_FALLBACK_MODEL: z
    .string()
    .min(1)
    .default('gpt-4.1-nano')
    .refine((value) => !/gpt-5\.6/i.test(value), 'GPT-5.6 is not allowed for pantry organization'),
  AI_INGREDIENT_ESCALATION_MODEL: z.string().min(1).default('gpt-4o-mini'),
  AI_INGREDIENT_REASONING_EFFORT: z
    .enum(['none', 'minimal', 'low', 'medium', 'high'])
    .default('none'),
  AI_INGREDIENT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(4096).default(1024),
  AI_INGREDIENT_MAX_INPUT_TOKENS: z.coerce.number().int().positive().max(16_000).default(2500),
  AI_INGREDIENT_MAX_ITEMS: z.coerce.number().int().positive().max(100).default(40),
  AI_INGREDIENT_MAX_ESCALATIONS: z.coerce.number().int().nonnegative().max(20).default(5),
  AI_INGREDIENT_LOW_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.55),
  AI_INGREDIENT_PROMPT_VERSION: z.string().min(1).default('ingredient-enrichment-v2'),

  // --- Sentry (optional) -------------------------------------------------------
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // --- Extraction pipeline -----------------------------------------------------
  EXTRACTION_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  EXTRACTION_BACKOFF_MS: z.coerce.number().int().positive().default(1_000),
  EXTRACTION_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  EXTRACTION_EXTRACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  EXTRACTION_EXTRACT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  MAX_VIDEO_DURATION_SECONDS: z.coerce.number().int().positive().default(600),
  MEDIA_RETENTION_HOURS: z.coerce.number().int().positive().default(72),
  /** Minimum sampling interval; widened automatically so MAX_FRAMES covers the whole video. */
  FRAME_INTERVAL_SECONDS: z.coerce.number().positive().default(1),
  MAX_FRAMES: z.coerce.number().int().positive().default(150),
  /**
   * A sampled frame is kept only when at least this fraction of its (downscaled, grayscale)
   * pixels differ from the previously kept frame. Low enough that a changed text overlay counts.
   */
  FRAME_DEDUPE_MIN_CHANGED_RATIO: z.coerce.number().min(0).max(1).default(0.002),
  /** Frames sent to OCR per job, sampled evenly across the video(s). */
  OCR_MAX_FRAMES: z.coerce.number().int().positive().max(200).default(24),
  /** Frames + images sent to vision analysis per job (doubled, up to 12+, for high-accuracy jobs). */
  VISION_MAX_IMAGES: z.coerce.number().int().positive().max(50).default(6),
  /** Parallel OCR/vision calls per job. */
  MEDIA_AI_CONCURRENCY: z.coerce.number().int().positive().max(16).default(4),
  /** Carousel/post image slides downloaded and OCR'd (Instagram allows up to 20). */
  MAX_POST_IMAGES: z.coerce.number().int().positive().max(50).default(20),
  /** Videos inside a carousel that get downloaded and processed. */
  MAX_POST_VIDEOS: z.coerce.number().int().nonnegative().max(10).default(3),
  MAX_MEDIA_DOWNLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(200 * 1024 * 1024),
  /** Character budget for OCR + vision text in the extraction prompt (~4 chars per token). */
  EVIDENCE_MEDIA_MAX_CHARS: z.coerce.number().int().positive().default(16_000),
  EVIDENCE_TRANSCRIPT_MAX_CHARS: z.coerce.number().int().positive().default(20_000),
  /** Use YouTube manual/auto captions as the transcript instead of Whisper when available. */
  YOUTUBE_PREFER_CAPTIONS: z.stringbool().default(true),
  FAKE_PIPELINE_DELAY_MS: z.coerce.number().int().nonnegative().default(0),

  // --- External content providers (Phase 5+) -----------------------------------
  APIFY_API_TOKEN: z.string().optional(),
  /** Re-fetch pages that block us (401/402/403/429/503) through Apify's headless browser. */
  WEB_BLOCKED_FALLBACK: z.stringbool().default(true),
  /** Optional Instagram Graph oEmbed app token (`{app-id}|{app-secret}`). */
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  /** Path or name of the yt-dlp binary used for YouTube preview and extraction. */
  YTDLP_PATH: z.string().min(1).default('yt-dlp'),
});

export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/recipe_api_test';

function databaseName(url: string): string | undefined {
  try {
    return new URL(url).pathname.replace(/^\//, '') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Daily file logs default to `./logs` except in tests. An empty `LOG_DIR` turns them off.
 */
export function resolveLogDirectory(nodeEnv: string, logDir?: string): string | undefined {
  if (logDir === '') {
    return undefined;
  }
  if (logDir !== undefined) {
    return logDir;
  }
  return nodeEnv === 'test' ? undefined : './logs';
}

/** Tests must never write to the development `recipe_api` database. */
export function resolveDatabaseUrl(input: {
  nodeEnv: string;
  databaseUrl: string;
  testDatabaseUrl?: string;
}): string {
  if (input.nodeEnv !== 'test') {
    return input.databaseUrl;
  }

  const candidate = input.testDatabaseUrl ?? input.databaseUrl;
  if (databaseName(candidate) === 'recipe_api') {
    return DEFAULT_TEST_DATABASE_URL;
  }

  return candidate;
}

const configSchema = rawEnvSchema.transform((raw) => ({
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  service: {
    name: raw.SERVICE_NAME,
    version: raw.SERVICE_VERSION,
  },
  server: {
    host: raw.HOST,
    port: raw.PORT,
    trustProxy: raw.TRUST_PROXY,
    bodyLimitBytes: raw.BODY_LIMIT_BYTES,
    maxParamLength: raw.MAX_PARAM_LENGTH,
    requestTimeoutMs: raw.REQUEST_TIMEOUT_MS,
    keepAliveTimeoutMs: raw.KEEP_ALIVE_TIMEOUT_MS,
    shutdownTimeoutMs: raw.SHUTDOWN_TIMEOUT_MS,
  },
  logging: {
    level: raw.LOG_LEVEL,
    directory: resolveLogDirectory(raw.NODE_ENV, raw.LOG_DIR),
  },
  api: {
    prefix: raw.API_PREFIX,
    docsEnabled: raw.ENABLE_DOCS ?? raw.NODE_ENV !== 'production',
  },
  cors: {
    origins: raw.CORS_ORIGINS,
  },
  rateLimit: {
    enabled: raw.RATE_LIMIT_ENABLED,
    max: raw.RATE_LIMIT_MAX,
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
  },
  database: {
    url: resolveDatabaseUrl({
      nodeEnv: raw.NODE_ENV,
      databaseUrl: raw.DATABASE_URL,
      ...(raw.TEST_DATABASE_URL !== undefined ? { testDatabaseUrl: raw.TEST_DATABASE_URL } : {}),
    }),
  },
  redis: {
    url: raw.REDIS_URL,
  },
  storage: {
    provider: raw.STORAGE_PROVIDER,
    localPath: raw.STORAGE_LOCAL_PATH,
    s3:
      raw.STORAGE_S3_BUCKET && raw.STORAGE_S3_REGION
        ? {
            bucket: raw.STORAGE_S3_BUCKET,
            region: raw.STORAGE_S3_REGION,
            endpoint: raw.STORAGE_S3_ENDPOINT,
          }
        : undefined,
  },
  ai: {
    openaiApiKey: raw.OPENAI_API_KEY,
    defaultModel: raw.AI_DEFAULT_MODEL,
    whisperModel: raw.AI_WHISPER_MODEL,
    visionModel: raw.AI_VISION_MODEL,
    maxRetries: raw.AI_MAX_RETRIES,
    ingredientModel: raw.AI_INGREDIENT_MODEL,
    ingredientFallbackModel: raw.AI_INGREDIENT_FALLBACK_MODEL,
    ingredientEscalationModel: raw.AI_INGREDIENT_ESCALATION_MODEL,
    ingredientReasoningEffort: raw.AI_INGREDIENT_REASONING_EFFORT,
    ingredientMaxOutputTokens: raw.AI_INGREDIENT_MAX_OUTPUT_TOKENS,
    ingredientMaxInputTokens: raw.AI_INGREDIENT_MAX_INPUT_TOKENS,
    ingredientMaxItems: raw.AI_INGREDIENT_MAX_ITEMS,
    ingredientMaxEscalations: raw.AI_INGREDIENT_MAX_ESCALATIONS,
    ingredientLowConfidence: raw.AI_INGREDIENT_LOW_CONFIDENCE,
    ingredientPromptVersion: raw.AI_INGREDIENT_PROMPT_VERSION,
  },
  sentry: raw.SENTRY_DSN
    ? {
        dsn: raw.SENTRY_DSN,
        tracesSampleRate: raw.SENTRY_TRACES_SAMPLE_RATE,
      }
    : undefined,
  extraction: {
    maxRetries: raw.EXTRACTION_MAX_RETRIES,
    backoffMs: raw.EXTRACTION_BACKOFF_MS,
    queueConcurrency: raw.EXTRACTION_QUEUE_CONCURRENCY,
    extractRateLimitMax: raw.EXTRACTION_EXTRACT_RATE_LIMIT_MAX,
    extractRateLimitWindowMs: raw.EXTRACTION_EXTRACT_RATE_LIMIT_WINDOW_MS,
    maxVideoDurationSeconds: raw.MAX_VIDEO_DURATION_SECONDS,
    mediaRetentionHours: raw.MEDIA_RETENTION_HOURS,
    frameIntervalSeconds: raw.FRAME_INTERVAL_SECONDS,
    maxFrames: raw.MAX_FRAMES,
    frameDedupeMinChangedRatio: raw.FRAME_DEDUPE_MIN_CHANGED_RATIO,
    ocrMaxFrames: raw.OCR_MAX_FRAMES,
    visionMaxImages: raw.VISION_MAX_IMAGES,
    mediaAiConcurrency: raw.MEDIA_AI_CONCURRENCY,
    maxPostImages: raw.MAX_POST_IMAGES,
    maxPostVideos: raw.MAX_POST_VIDEOS,
    maxMediaDownloadBytes: raw.MAX_MEDIA_DOWNLOAD_BYTES,
    evidenceMediaMaxChars: raw.EVIDENCE_MEDIA_MAX_CHARS,
    evidenceTranscriptMaxChars: raw.EVIDENCE_TRANSCRIPT_MAX_CHARS,
    youtubePreferCaptions: raw.YOUTUBE_PREFER_CAPTIONS,
    fakePipelineDelayMs: raw.FAKE_PIPELINE_DELAY_MS,
  },
  providers: {
    apifyApiToken: raw.APIFY_API_TOKEN,
    webBlockedFallback: raw.WEB_BLOCKED_FALLBACK,
    metaAppId: raw.META_APP_ID,
    metaAppSecret: raw.META_APP_SECRET,
    ytdlpPath: raw.YTDLP_PATH,
  },
}));

export type AppConfig = z.infer<typeof configSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates a raw environment source and returns the typed configuration.
 * Exported separately from `config` so it can be unit tested without touching `process.env`.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }

  return result.data;
}

/** Validated at import time so misconfiguration fails fast on startup. */
export const config: AppConfig = loadConfig();

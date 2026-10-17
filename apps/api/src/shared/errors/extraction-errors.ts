import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class InvalidUrlError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: options.message ?? 'Invalid URL',
      ...options,
    });
  }
}

export class UnsupportedSourceError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.UNSUPPORTED_SOURCE,
      statusCode: 400,
      message: options.message ?? 'The provided URL is not currently supported',
      ...options,
    });
  }
}

export class JobNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.JOB_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Extraction job not found',
      ...options,
    });
  }
}

export class JobAlreadyCompletedError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.JOB_ALREADY_COMPLETED,
      statusCode: 409,
      message: options.message ?? 'Extraction job has already completed',
      ...options,
    });
  }
}

export class JobCancelledError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.JOB_CANCELLED,
      statusCode: 409,
      message: options.message ?? 'Extraction job was cancelled',
      ...options,
    });
  }
}

/**
 * Why a link could not be read. NOT_FOUND, PRIVATE and BLOCKED will not change on a retry, so
 * the job fails at once; UNAVAILABLE (timeouts, 5xx) keeps the queue's retries.
 */
export type ContentFailureReason = 'NOT_FOUND' | 'PRIVATE' | 'BLOCKED' | 'UNAVAILABLE';

export const CONTENT_FAILURE_MESSAGES: Record<
  Exclude<ContentFailureReason, 'UNAVAILABLE'>,
  string
> = {
  NOT_FOUND: "This link doesn't exist or has been removed",
  PRIVATE: 'This post is private or needs a login',
  BLOCKED: 'This site blocks automatic import',
};

const NOT_FOUND_PATTERN =
  /does(?:n't| not) exist|not found|no longer available|has been (?:removed|deleted)|was deleted|video unavailable|unavailable video|\b(?:404|410)\b/i;
const PRIVATE_PATTERN =
  /\bprivate\b|log ?in required|login required|sign in to|requires? (?:a )?login|members[- ]only|age[- ]restricted|restricted video/i;

/** Maps provider error text (and an HTTP status when there is one) to a failure reason. */
export function classifyAcquisitionFailure(
  detail: string,
  httpStatus?: number,
): 'NOT_FOUND' | 'PRIVATE' | undefined {
  if (httpStatus === 404 || httpStatus === 410) return 'NOT_FOUND';
  if (httpStatus === 401 || httpStatus === 403) return 'PRIVATE';
  if (NOT_FOUND_PATTERN.test(detail)) return 'NOT_FOUND';
  if (PRIVATE_PATTERN.test(detail)) return 'PRIVATE';
  return undefined;
}

export interface ContentAcquisitionFailedOptions extends AppErrorOptions {
  reason?: ContentFailureReason;
  httpStatus?: number;
}

export class ContentAcquisitionFailedError extends AppError {
  readonly reason: ContentFailureReason | undefined;
  readonly httpStatus: number | undefined;

  constructor(options: ContentAcquisitionFailedOptions = {}) {
    const { reason, httpStatus, ...rest } = options;
    super({
      code: ErrorCode.CONTENT_ACQUISITION_FAILED,
      statusCode: 502,
      message:
        rest.message ??
        (reason && reason !== 'UNAVAILABLE'
          ? CONTENT_FAILURE_MESSAGES[reason]
          : 'Failed to acquire content from source'),
      ...rest,
    });
    this.reason = reason;
    this.httpStatus = httpStatus;
  }

  /** True when retrying the same link cannot help. */
  get permanent(): boolean {
    return this.reason === 'NOT_FOUND' || this.reason === 'PRIVATE' || this.reason === 'BLOCKED';
  }
}

export class MediaProcessingFailedError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.MEDIA_PROCESSING_FAILED,
      statusCode: 502,
      message: options.message ?? 'Media processing failed',
      ...options,
    });
  }
}

/** The link resolved, but its content is not a food or drink recipe. Not retryable. */
export class NotARecipeError extends AppError {
  readonly permanent = true;

  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.NOT_A_RECIPE,
      statusCode: 422,
      message: options.message ?? 'The link does not look like a food recipe',
      ...options,
    });
  }
}

export class ExtractionFailedError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.EXTRACTION_FAILED,
      statusCode: 500,
      message: options.message ?? 'Recipe extraction failed',
      ...options,
    });
  }
}

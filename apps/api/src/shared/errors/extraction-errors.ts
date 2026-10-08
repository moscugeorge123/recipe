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

export class ContentAcquisitionFailedError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.CONTENT_ACQUISITION_FAILED,
      statusCode: 502,
      message: options.message ?? 'Failed to acquire content from source',
      ...options,
    });
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

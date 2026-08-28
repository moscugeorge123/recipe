import { ErrorCode } from './error-codes.js';

/** A single, client-safe explanation of what was wrong with a request. */
export interface ErrorDetail {
  /** Dot/bracket path to the offending field, e.g. `body.name` or `query.pageSize`. */
  path: string;
  message: string;
}

export interface AppErrorOptions {
  message?: string;
  details?: ErrorDetail[];
  cause?: unknown;
}

interface AppErrorParams extends AppErrorOptions {
  code: ErrorCode;
  statusCode: number;
  message: string;
}

/**
 * Base class for every error the application raises deliberately.
 *
 * Anything thrown that is *not* an `AppError` is treated as an unexpected failure by the
 * error handler: it is logged in full and reported to the client as a generic 500.
 * That distinction is what keeps internal details out of API responses.
 *
 * `AppError` intentionally has no dependency on Fastify, so services can throw it from
 * any runtime (HTTP server, Lambda handler, background worker).
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: ErrorDetail[] | undefined;

  constructor(params: AppErrorParams) {
    super(params.message, { cause: params.cause });
    this.name = new.target.name;
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export class ValidationError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message: options.message ?? 'Invalid request',
      ...options,
    });
  }
}

export class BadRequestError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.BAD_REQUEST,
      statusCode: 400,
      message: options.message ?? 'Bad request',
      ...options,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Resource not found',
      ...options,
    });
  }
}

export class ConflictError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.CONFLICT,
      statusCode: 409,
      message: options.message ?? 'Resource already exists',
      ...options,
    });
  }
}

/**
 * Placeholder for the authentication layer that will be added later.
 * Nothing throws this yet; it exists so the error contract and OpenAPI responses are
 * already correct when authentication hooks are introduced.
 */
export class UnauthorizedError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
      message: options.message ?? 'Authentication required',
      ...options,
    });
  }
}

/** Placeholder for the authorization layer that will be added later. See `UnauthorizedError`. */
export class ForbiddenError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.FORBIDDEN,
      statusCode: 403,
      message: options.message ?? 'Insufficient permissions',
      ...options,
    });
  }
}

/** For dependency outages: use once a database or external service is wired up. */
export class ServiceUnavailableError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      statusCode: 503,
      message: options.message ?? 'Service temporarily unavailable',
      ...options,
    });
  }
}

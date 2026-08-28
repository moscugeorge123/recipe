import { describe, expect, it } from 'vitest';

import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from './app-error.js';
import { ErrorCode } from './error-codes.js';

describe('AppError', () => {
  it('exposes the status code, error code and name', () => {
    const error = new NotFoundError({ message: 'Example 1 not found' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe('Example 1 not found');
  });

  it('provides a default message per error type', () => {
    expect(new NotFoundError().message).toBe('Resource not found');
    expect(new UnauthorizedError().message).toBe('Authentication required');
  });

  it('carries validation details', () => {
    const error = new ValidationError({
      details: [{ path: 'body.name', message: 'name is required' }],
    });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.details).toEqual([{ path: 'body.name', message: 'name is required' }]);
  });

  it('keeps the original error as the cause', () => {
    const cause = new Error('connection refused');
    const error = new ServiceUnavailableError({ cause });

    expect(error.cause).toBe(cause);
  });

  it.each([
    [new ValidationError(), 400, ErrorCode.VALIDATION_ERROR],
    [new BadRequestError(), 400, ErrorCode.BAD_REQUEST],
    [new UnauthorizedError(), 401, ErrorCode.UNAUTHORIZED],
    [new ForbiddenError(), 403, ErrorCode.FORBIDDEN],
    [new NotFoundError(), 404, ErrorCode.NOT_FOUND],
    [new ConflictError(), 409, ErrorCode.CONFLICT],
    [new ServiceUnavailableError(), 503, ErrorCode.SERVICE_UNAVAILABLE],
  ])('maps $name to its status and code', (error, statusCode, code) => {
    expect(error.statusCode).toBe(statusCode);
    expect(error.code).toBe(code);
  });
});

describe('isAppError', () => {
  it('recognises application errors', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(
      isAppError(
        new AppError({ code: ErrorCode.CONFLICT, statusCode: 409, message: 'already exists' }),
      ),
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError('boom')).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

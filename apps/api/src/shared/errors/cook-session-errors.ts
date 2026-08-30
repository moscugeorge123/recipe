import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class CookSessionNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.COOK_SESSION_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Cook session not found',
      ...options,
    });
  }
}

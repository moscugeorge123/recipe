import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class PantryItemNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Pantry item not found',
      ...options,
    });
  }
}

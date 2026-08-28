import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class RecipeNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.RECIPE_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Recipe not found',
      ...options,
    });
  }
}

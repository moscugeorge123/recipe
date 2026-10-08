import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class MealPlanEntryNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Meal plan entry not found',
      ...options,
    });
  }
}

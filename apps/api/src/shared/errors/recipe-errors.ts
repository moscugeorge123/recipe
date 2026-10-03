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

export class RecipeRevisionConflictError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.RECIPE_REVISION_CONFLICT,
      statusCode: 409,
      message: options.message ?? 'Recipe changed since this draft was opened',
      ...options,
    });
  }
}

export class RecipeEngagementConflictError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.RECIPE_ENGAGEMENT_CONFLICT,
      statusCode: 409,
      message: options.message ?? 'Recipe changed since this action started',
      ...options,
    });
  }
}

export class RecipeNoteNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.RECIPE_NOTE_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Recipe note not found',
      ...options,
    });
  }
}

export class CategoryNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.CATEGORY_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Category not found',
      ...options,
    });
  }
}

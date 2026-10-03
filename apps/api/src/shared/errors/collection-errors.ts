import { AppError, type AppErrorOptions } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export class CollectionNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.COLLECTION_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Collection not found',
      ...options,
    });
  }
}

export class CollectionNameConflictError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.COLLECTION_NAME_CONFLICT,
      statusCode: 409,
      message: options.message ?? 'A collection with this name already exists',
      ...options,
    });
  }
}

export class CollectionRecipeConflictError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.COLLECTION_RECIPE_CONFLICT,
      statusCode: 409,
      message: options.message ?? 'That recipe is already in this collection',
      ...options,
    });
  }
}

export class CollectionMemberNotFoundError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super({
      code: ErrorCode.COLLECTION_MEMBER_NOT_FOUND,
      statusCode: 404,
      message: options.message ?? 'Recipe is not in this collection',
      ...options,
    });
  }
}

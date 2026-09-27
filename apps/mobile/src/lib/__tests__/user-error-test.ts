import { ApiError } from '@/services/api-client';
import {
  errorCodeOf,
  importErrorCopy,
  importFailureToast,
  mapUserError,
} from '@/lib/user-error';

describe('mapUserError', () => {
  test('maps rate limits to a retry next action without leaking request ids', () => {
    const error = new ApiError(
      'Too many requests',
      429,
      {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests',
          requestId: 'req-secret-123',
          retryable: true,
        },
      },
      'TOO_MANY_REQUESTS',
    );
    const copy = mapUserError(error, 'recipe');
    expect(copy.message).toMatch(/busy/i);
    expect(copy.actionLabel).toBe('Retry');
    expect(copy.retryable).toBe(true);
    expect(copy.message).not.toContain('req-secret-123');
    expect(copy.title).not.toContain('req-secret-123');
  });

  test('maps collection name conflicts to an edit action', () => {
    const error = new ApiError(
      'conflict',
      409,
      { error: { code: 'COLLECTION_NAME_CONFLICT', message: 'taken' } },
      'COLLECTION_NAME_CONFLICT',
    );
    const copy = mapUserError(error, 'collections');
    expect(copy.message).toMatch(/already have a collection/i);
    expect(copy.retryable).toBe(false);
    expect(copy.actionLabel).toBe('Edit name');
  });

  test('keeps import extraction copy warm and retryable', () => {
    const copy = importErrorCopy('EXTRACTION_FAILED');
    expect(copy.title).toBe("We couldn't read that one. Try again?");
    expect(copy.actionLabel).toBe('Try again');
  });

  test('maps NOT_A_RECIPE to non-retryable copy', () => {
    const copy = importErrorCopy('NOT_A_RECIPE');
    expect(copy.title).toMatch(/doesn’t look like a food recipe/);
    expect(copy.retryable).toBe(false);
  });

  test('picks an import toast from the failed job error code', () => {
    expect(importFailureToast(errorCodeOf({ message: 'x', code: 'NOT_A_RECIPE' }))).toBe(
      'That link doesn’t look like a food recipe',
    );
    expect(importFailureToast('UNSUPPORTED_SOURCE', 'TikTok')).toMatch(
      /^TikTok links aren’t supported yet/,
    );
    expect(importFailureToast('UNSUPPORTED_SOURCE')).toMatch(/^That link isn’t supported yet/);
    expect(importFailureToast('EXTRACTION_FAILED')).toBe(
      'Couldn’t read a recipe from that link',
    );
    expect(importFailureToast(undefined, undefined, 'fallback')).toBe('fallback');
  });

  test('uses preview copy for unknown offline failures', () => {
    const copy = mapUserError(new Error('offline'), 'preview');
    expect(copy.message).toMatch(/couldn't unfurl this link/i);
    expect(copy.retryable).toBe(true);
  });
});

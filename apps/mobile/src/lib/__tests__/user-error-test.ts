import { ApiError } from '@/services/api-client';
import { importErrorCopy, mapUserError } from '@/lib/user-error';

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
    const copy = mapUserError(error, 'nutrition');
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

  test('uses preview copy for unknown offline failures', () => {
    const copy = mapUserError(new Error('offline'), 'preview');
    expect(copy.message).toMatch(/couldn't unfurl this link/i);
    expect(copy.retryable).toBe(true);
  });
});

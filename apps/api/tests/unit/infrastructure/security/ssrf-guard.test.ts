import { describe, expect, it } from 'vitest';

import { assertSafeUrl } from '../../../../src/infrastructure/security/ssrf-guard.js';
import { AppError } from '../../../../src/shared/errors/app-error.js';
import { ErrorCode } from '../../../../src/shared/errors/error-codes.js';

describe('ssrf-guard', () => {
  it('accepts public HTTPS URLs', async () => {
    const url = await assertSafeUrl('https://example.com/recipe');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects non-http schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toMatchObject({
      code: ErrorCode.INVALID_URL,
    });
  });

  it('rejects localhost hostnames', async () => {
    await expect(assertSafeUrl('http://localhost/recipe')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects private IP literals', async () => {
    await expect(assertSafeUrl('http://192.168.1.1/recipe')).rejects.toMatchObject({
      code: ErrorCode.INVALID_URL,
    });

    await expect(assertSafeUrl('http://127.0.0.1/recipe')).rejects.toMatchObject({
      code: ErrorCode.INVALID_URL,
    });
  });

  it('rejects malformed URLs', async () => {
    await expect(assertSafeUrl('not-a-url')).rejects.toMatchObject({
      code: ErrorCode.INVALID_URL,
    });
  });
});

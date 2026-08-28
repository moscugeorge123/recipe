import dns from 'node:dns/promises';
import net from 'node:net';

import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '../../shared/errors/error-codes.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
  /^::1$/,
  /^::$/,
];

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(address));
  }

  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') {
    return true;
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80')) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      return isPrivateIp(mapped);
    }
  }

  return false;
}

function assertAllowedHostname(hostname: string): void {
  const lower = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith('.localhost')) {
    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'URL hostname is not allowed',
    });
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'URL resolves to a private or reserved address',
    });
  }
}

async function assertResolvablePublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    assertAllowedHostname(hostname);
    return;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) {
      throw new AppError({
        code: ErrorCode.INVALID_URL,
        statusCode: 400,
        message: 'URL hostname could not be resolved',
      });
    }

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new AppError({
          code: ErrorCode.INVALID_URL,
          statusCode: 400,
          message: 'URL resolves to a private or reserved address',
        });
      }
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'URL hostname could not be resolved',
      cause: error,
    });
  }
}

/** Validates a user-supplied URL before any outbound fetch or provider call. */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'Invalid URL format',
    });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'Only HTTP and HTTPS URLs are supported',
    });
  }

  if (!url.hostname) {
    throw new AppError({
      code: ErrorCode.INVALID_URL,
      statusCode: 400,
      message: 'URL must include a hostname',
    });
  }

  assertAllowedHostname(url.hostname);
  await assertResolvablePublicHost(url.hostname);

  return url;
}

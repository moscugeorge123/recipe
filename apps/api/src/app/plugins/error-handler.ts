import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

import { isRetryableFailure } from '@recipe/contracts';

import { AppError, isAppError, type ErrorDetail } from '../../shared/errors/app-error.js';
import { ErrorCode } from '../../shared/errors/error-codes.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';

/**
 * Centralised error handling: the only place in the application that turns a thrown value
 * into an HTTP response.
 *
 * Rules:
 * 1. Every failure is reported using the same `{ error: { code, message, details? } }` envelope.
 * 2. Only errors we raised on purpose (`AppError`) or Fastify's own client errors expose their
 *    message. Anything else becomes a generic 500 so stack traces, driver errors and internal
 *    identifiers can never leak — in any environment, not just production.
 * 3. The full error is always logged server-side with the request id attached.
 */

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  429: ErrorCode.TOO_MANY_REQUESTS,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Turns `body` + `/items/0/name` into `body.items.0.name`. */
function buildDetailPath(context: string, instancePath: string): string {
  const segments = instancePath.split('/').filter((segment) => segment.length > 0);
  return [context, ...segments].join('.');
}

function toValidationDetails(
  validation: readonly { instancePath: string; message?: string | undefined }[],
  context: string,
): ErrorDetail[] {
  return validation.map((issue) => ({
    path: buildDetailPath(context, issue.instancePath),
    message: issue.message ?? 'Invalid value',
  }));
}

function buildErrorResponse(
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[] | undefined;
    statusCode?: number;
  },
  requestId: string,
): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      requestId,
      retryable: isRetryableFailure(error.statusCode ?? 500, error.code),
    },
  };
}

function resolveError(error: FastifyError): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message: 'Invalid request',
      details: toValidationDetails(error.validation, error.validationContext ?? 'request'),
      cause: error,
    });
  }

  // The response did not match its own schema: a bug on our side, never the client's fault.
  if (isResponseSerializationError(error)) {
    return new AppError({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: 500,
      message: 'Internal server error',
      cause: error,
    });
  }

  // Errors raised by Fastify itself or by official plugins (body limit, malformed JSON,
  // unsupported media type, rate limiting). Their messages are safe to surface.
  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 400 && statusCode < 500) {
    return new AppError({
      code: STATUS_TO_CODE[statusCode] ?? ErrorCode.BAD_REQUEST,
      statusCode,
      message: error.message,
      cause: error,
    });
  }

  return new AppError({
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    statusCode: 500,
    message: 'Internal server error',
    cause: error,
  });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const resolved = resolveError(error);

    if (resolved.statusCode >= 500) {
      // `err` is serialised by Pino with the stack and the original cause.
      request.log.error({ err: error, code: resolved.code }, 'Request failed');
    } else {
      request.log.warn(
        { err: error, code: resolved.code, statusCode: resolved.statusCode },
        'Request rejected',
      );
    }

    return reply
      .status(resolved.statusCode)
      .send(buildErrorResponse(resolved, request.id));
  });

  // Unknown routes bypass route-level hooks, so the rate limiter is attached explicitly here.
  // Without this, an attacker could probe for endpoints without ever hitting a limit.
  const notFoundOptions = app.hasDecorator('rateLimit') ? { preHandler: app.rateLimit() } : {};

  app.setNotFoundHandler(notFoundOptions, (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send(
      buildErrorResponse(
        {
          code: ErrorCode.NOT_FOUND,
          message: `Route ${request.method} ${request.url} not found`,
          statusCode: 404,
        },
        request.id,
      ),
    );
  });
}

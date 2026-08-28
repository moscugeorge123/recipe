import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { FastifyInstance } from 'fastify';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Client-supplied ids are logged, so only accept short, boring values. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Reuses the caller's `X-Request-Id` when it is well formed, otherwise mints a UUID.
 *
 * Accepting the client's id lets a trace span the mobile app and the API. Validating it first
 * prevents an untrusted, unbounded value from being written into every log line for that request.
 */
export function resolveRequestId(request: IncomingMessage): string {
  const header = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;

  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

/**
 * Echoes the request id back to the caller.
 *
 * Fastify already generates the id (see `app.ts`), attaches it to every log line and the error
 * handler includes it in error responses. Returning it as a header as well lets the mobile app
 * attach it to bug reports and crash logs, which makes a single user complaint traceable to
 * exact log lines in CloudWatch.
 */
export function registerRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });
}

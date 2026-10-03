import { z } from 'zod';
import type { ErrorResponse } from '@recipe/contracts';

/**
 * The single error shape every failed request returns, regardless of where the failure
 * originated (validation, application error, plugin, unhandled exception).
 */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().describe('Stable, machine-readable error code'),
      message: z.string().describe('Human-readable summary. Do not parse this.'),
      details: z
        .array(
          z.object({
            path: z.string(),
            message: z.string(),
          }),
        )
        .optional()
        .describe('Field-level problems, present for validation errors'),
      requestId: z.string().optional().describe('Correlates this response with server logs'),
      retryable: z
        .boolean()
        .optional()
        .describe('Whether the client should offer a retry for this failure'),
    }),
  })
  .meta({
    id: 'ErrorResponse',
    description: 'Standard error envelope',
    examples: [
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: [{ path: 'body.name', message: 'Expected string, received number' }],
          requestId: '3f6b1d0e-4c2a-4f21-9a3c-1e5f0b8d9c77',
        },
      },
    ],
  });

export type { ErrorResponse };

/**
 * Failure responses every endpoint can produce, ready to spread into a route's `response` map:
 *
 *   response: { 200: myPayloadSchema, ...standardErrorResponses }
 *
 * Add `404: errorResponseSchema` (or others) per route where they apply.
 */
export const standardErrorResponses = {
  400: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
} as const;

import { z } from 'zod';

const healthStatusSchema = z.enum(['ok', 'error']);

/**
 * Health responses are intentionally *not* wrapped in the `{ data: ... }` envelope: load
 * balancers, ECS container health checks and uptime monitors all expect a flat document.
 */
export const healthResponseSchema = z
  .object({
    status: healthStatusSchema,
    checks: z
      .array(
        z.object({
          name: z.string(),
          status: healthStatusSchema,
          durationMs: z.number().int(),
        }),
      )
      .optional()
      .describe('Per-dependency results. Omitted while the API has no external dependencies.'),
  })
  .meta({
    id: 'HealthResponse',
    examples: [{ status: 'ok' }],
  });

export type HealthResponse = z.infer<typeof healthResponseSchema>;

import { z } from 'zod';

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(40, 'Name must be at most 40 characters'),
});

export type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

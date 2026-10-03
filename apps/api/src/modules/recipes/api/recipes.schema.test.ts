import { describe, expect, it } from 'vitest';

import { recipeListItemSchema } from './recipes.schema.js';

describe('recipe list schema', () => {
  it('accepts backfilled userRecipeId values that are not RFC 4122 UUIDs', () => {
    expect(
      recipeListItemSchema.shape.userRecipeId.safeParse('aaaaaaaa-bbbb-9ccc-0ddd-eeeeeeeeeeee')
        .success,
    ).toBe(true);
  });
});

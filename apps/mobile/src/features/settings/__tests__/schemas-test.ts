import { displayNameSchema } from '@/features/settings/schemas';

describe('displayNameSchema', () => {
  test('accepts a valid name', () => {
    expect(displayNameSchema.parse({ displayName: 'Ada' })).toEqual({
      displayName: 'Ada',
    });
  });

  test('trims surrounding whitespace', () => {
    expect(displayNameSchema.parse({ displayName: '  Ada  ' })).toEqual({
      displayName: 'Ada',
    });
  });

  test('rejects a name that is too short', () => {
    const result = displayNameSchema.safeParse({ displayName: 'A' });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { dbUuid } from './uuid.js';

/** md5-as-uuid from the platform backfill: version nibble is 9, not RFC 4122. */
const MD5_UUID = 'aaaaaaaa-bbbb-9ccc-0ddd-eeeeeeeeeeee';
const RFC_UUID = '11111111-1111-4111-8111-111111111111';

describe('dbUuid', () => {
  it('accepts Postgres UUID values that z.uuid() rejects', () => {
    expect(z.uuid().safeParse(MD5_UUID).success).toBe(false);
    expect(dbUuid().safeParse(MD5_UUID).success).toBe(true);
    expect(dbUuid().safeParse(RFC_UUID).success).toBe(true);
    expect(dbUuid().safeParse('not-a-uuid').success).toBe(false);
  });
});

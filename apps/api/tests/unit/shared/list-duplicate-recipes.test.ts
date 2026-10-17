import { describe, expect, it } from 'vitest';

import { groupDuplicates } from '../../../src/scripts/list-duplicate-recipes.js';

const recipe = (id: string) => ({ id, title: id, createdAt: new Date() });

describe('groupDuplicates', () => {
  it('groups sources that are the same page and skips single imports', () => {
    const groups = groupDuplicates([
      { id: 's1', originalUrl: 'https://youtu.be/dQw4w9WgXcQ?si=a', recipe: recipe('r1') },
      { id: 's2', originalUrl: 'https://youtu.be/dQw4w9WgXcQ?si=b', recipe: recipe('r2') },
      { id: 's3', originalUrl: 'https://example.com/solo', recipe: recipe('r3') },
      { id: 's4', originalUrl: 'https://youtu.be/dQw4w9WgXcQ?si=c', recipe: null },
    ]);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]!.map((r) => r.id)).toEqual(['s1', 's2']);
  });
});

jest.mock('@/features/extraction/api', () => ({
  listExtractionJobs: jest.fn(),
}));

import type { ImportJob } from '@/features/extraction/import-jobs';
import type { JobListItemDto } from '@/features/extraction/schemas';
import { mergeServerJobs } from '@/tortie/data/import-hydrate';

function server(over: Partial<JobListItemDto> = {}): JobListItemDto {
  return {
    id: 's1',
    status: 'COMPLETED',
    progress: 100,
    url: 'https://example.com/pasta',
    title: 'Pasta',
    recipeId: 'r1',
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    ...over,
  };
}

function local(over: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'imp-1',
    url: 'https://example.com/other',
    src: { kind: 'web', name: 'Website', host: 'example.com' },
    status: 'done',
    pct: 100,
    createdAt: 1,
    ...over,
  };
}

describe('mergeServerJobs', () => {
  test('rebuilds done and failed rows from the server', () => {
    const merged = mergeServerJobs(
      [],
      [
        server(),
        server({
          id: 's2',
          status: 'FAILED',
          recipeId: null,
          title: null,
          error: { code: 'NOT_A_RECIPE' },
        }),
        server({ id: 's3', status: 'EXTRACTING_RECIPE', recipeId: null }),
        server({ id: 's4', status: 'CANCELLED', recipeId: null }),
      ],
    );

    expect(merged.map((j) => [j.serverJobId, j.status])).toEqual([
      ['s1', 'done'],
      ['s2', 'failed'],
    ]);
    expect(merged[0]).toMatchObject({ recipeId: 'r1', title: 'Pasta' });
    expect(merged[1]).toMatchObject({
      errorCode: 'NOT_A_RECIPE',
      group: 'not_recipe',
    });
  });

  test('dedupes by server job id and by saved recipe', () => {
    const existing = [
      local({ serverJobId: 's1' }),
      local({ id: 'imp-2', recipeId: 'r9' }),
    ];
    const merged = mergeServerJobs(existing, [
      server(),
      server({ id: 's9', recipeId: 'r9' }),
    ]);
    expect(merged).toBe(existing);
  });
});

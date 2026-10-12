import {
  HISTORY_LIMIT,
  averageProgress,
  brandNameOf,
  historyJobs,
  importSrcOf,
  pillLabel,
  pruneHistory,
  runningJobs,
  type ImportJob,
} from '@/features/extraction/import-jobs';

const job = (over: Partial<ImportJob> & { id: string }): ImportJob => ({
  url: 'https://example.com/r',
  src: { kind: 'web', name: 'Website', host: 'example.com' },
  status: 'running',
  pct: 0,
  createdAt: 1,
  ...over,
});

describe('import jobs', () => {
  test('source of a link', () => {
    expect(importSrcOf('https://www.instagram.com/reel/abc')).toEqual({
      kind: 'instagram',
      name: 'Instagram',
      host: 'instagram.com',
    });
    expect(importSrcOf('https://www.bbcgoodfood.com/recipes/x')).toEqual({
      kind: 'web',
      name: 'Website',
      host: 'bbcgoodfood.com',
    });
  });

  test('only platforms have a brand name', () => {
    expect(brandNameOf(importSrcOf('https://tiktok.com/@a/video/1'))).toBe(
      'TikTok',
    );
    expect(brandNameOf(importSrcOf('https://example.com'))).toBeUndefined();
    expect(
      brandNameOf({ kind: 'scan', name: 'Scanned page', host: 'Scanned page' }),
    ).toBeUndefined();
  });

  test('pill label and average progress count running jobs only', () => {
    expect(pillLabel(1)).toBe('Importing a recipe');
    expect(pillLabel(3)).toBe('Importing 3 recipes');
    const jobs = [
      job({ id: 'a', pct: 20 }),
      job({ id: 'b', pct: 60 }),
      job({ id: 'c', status: 'done', pct: 100 }),
    ];
    expect(runningJobs(jobs)).toHaveLength(2);
    expect(averageProgress(jobs)).toBe(40);
    expect(averageProgress([])).toBe(0);
  });

  test('history is newest first and leaves running jobs out', () => {
    const jobs = [
      job({ id: 'old', status: 'done', finishedAt: 10 }),
      job({ id: 'run' }),
      job({ id: 'new', status: 'failed', finishedAt: 30 }),
    ];
    expect(historyJobs(jobs).map((j) => j.id)).toEqual(['new', 'old']);
  });

  test('pruning keeps running jobs and the newest history', () => {
    const jobs = [
      job({ id: 'run' }),
      ...Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) =>
        job({ id: `h${i}`, status: 'done', finishedAt: i }),
      ),
    ];
    const kept = pruneHistory(jobs);
    expect(kept).toHaveLength(HISTORY_LIMIT + 1);
    expect(kept.some((j) => j.id === 'run')).toBe(true);
    expect(kept.some((j) => j.id === 'h0')).toBe(false);
    expect(kept.some((j) => j.id === `h${HISTORY_LIMIT + 4}`)).toBe(true);
  });
});

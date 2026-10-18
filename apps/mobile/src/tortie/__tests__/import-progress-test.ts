jest.mock('@/features/extraction/api', () => ({
  createExtraction: jest.fn(),
  getExtractionJob: jest.fn(),
  cancelExtraction: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/recipes/api', () => ({ getRecipe: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { createExtraction, getExtractionJob } from '@/features/extraction/api';
import {
  importStageLabel,
  stageBoundsFor,
  targetProgress,
} from '@/features/extraction/import-stages';
import { cancelImport, startImport } from '@/tortie/data/import-engine';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';

const create = createExtraction as jest.Mock;
const poll = getExtractionJob as jest.Mock;

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const jobDto = (status: string, progress: number, extra = {}) => ({
  id: 'srv-1',
  status,
  progress,
  currentStage: status.toLowerCase(),
  recipeId: null,
  error: null,
  startedAt: null,
  completedAt: null,
  ...extra,
});

async function run(ms: number) {
  for (let t = 0; t < ms; t += 100) {
    jest.advanceTimersByTime(100);
    await flush();
  }
}

const pctOf = (id: string) =>
  useImports.getState().jobs.find((j) => j.id === id)!.pct;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useImports.setState({ jobs: [], focusId: null });
  useNav.setState(useNav.getInitialState(), true);
  create.mockResolvedValue({ jobId: 'srv-1', status: 'queued' });
});

afterEach(() => {
  for (const j of useImports.getState().jobs) cancelImport(j.id);
  jest.useRealTimers();
});

describe('stage bounds', () => {
  test('every job status maps to a range, and none overlaps the next', () => {
    const statuses = [
      'QUEUED',
      'ACQUIRING_CONTENT',
      'CONTENT_ACQUIRED',
      'PROCESSING_MEDIA',
      'TRANSCRIBING',
      'ANALYZING_FRAMES',
      'RUNNING_OCR',
      'EXTRACTING_RECIPE',
      'NORMALIZING_RECIPE',
      'VALIDATING_RECIPE',
      'COMPLETED',
    ];
    const label = (s: string) => importStageLabel(stageBoundsFor(s).cap);
    for (const s of statuses.slice(0, 3)) {
      expect(label(s)).toBe('Reading the page');
    }
    for (const s of statuses.slice(3, 7)) {
      expect(label(s)).toBe('Picking out ingredients');
      expect(importStageLabel(stageBoundsFor(s).floor)).toBe(label(s));
    }
    for (const s of statuses.slice(7, 10)) {
      expect(label(s)).toBe('Writing the steps');
      expect(importStageLabel(stageBoundsFor(s).floor)).toBe(label(s));
    }
    expect(label('COMPLETED')).toBe('Plating it up');
  });

  test('unknown or missing status counts as reading the page', () => {
    expect(stageBoundsFor(undefined).cap).toBeLessThan(34);
    expect(stageBoundsFor('SOMETHING_NEW').cap).toBeLessThan(34);
  });

  test('creep is held at the cap and pulled up to the floor', () => {
    expect(targetProgress('ACQUIRING_CONTENT', 5, 80)).toBe(17);
    expect(targetProgress(undefined, 0, 90)).toBe(17);
    expect(targetProgress('EXTRACTING_RECIPE', 0, 10)).toBe(66);
    expect(targetProgress('EXTRACTING_RECIPE', 99, 90)).toBe(93);
  });
});

describe('import progress follows the server job', () => {
  test('never past "Reading the page" while the job is still acquiring', async () => {
    poll.mockResolvedValue(jobDto('ACQUIRING_CONTENT', 5));
    const id = startImport('https://example.com/slow');
    await run(30_000);
    expect(pctOf(id)).toBeLessThan(18);
    expect(importStageLabel(pctOf(id))).toBe('Reading the page');
  });

  test('moves on with the server stage', async () => {
    poll.mockResolvedValue(jobDto('ACQUIRING_CONTENT', 5));
    const id = startImport('https://example.com/slow');
    await run(5_000);
    poll.mockResolvedValue(jobDto('EXTRACTING_RECIPE', 70));
    await run(10_000);
    expect(importStageLabel(pctOf(id))).toBe('Writing the steps');
    expect(pctOf(id)).toBeLessThanOrEqual(93);
  });

  test('a job the server already failed reaches the error within a poll or two', async () => {
    poll.mockResolvedValue(
      jobDto('FAILED', 0, { error: { code: 'NOT_A_RECIPE' } }),
    );
    const id = startImport('https://example.com/news');
    await run(2_500);
    const job = useImports.getState().jobs.find((j) => j.id === id)!;
    expect(job.status).toBe('failed');
    expect(job.pct).toBeLessThan(18);
  });
});

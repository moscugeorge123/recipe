import { ApiError } from '@/services/api-client';

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

import {
  cancelExtraction,
  createExtraction,
  getExtractionJob,
} from '@/features/extraction/api';
import { getRecipe } from '@/features/recipes/api';
import {
  cancelImport,
  retryImport,
  startImport,
} from '@/tortie/data/import-engine';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';

const create = createExtraction as jest.Mock;
const poll = getExtractionJob as jest.Mock;
const recipe = getRecipe as jest.Mock;

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useImports.setState({ jobs: [], focusId: null });
  useNav.setState({ addSheet: false, toastOn: false, toast: '' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('import engine', () => {
  test('a rejected create fails the job into its error group and toasts', async () => {
    create.mockRejectedValue(new ApiError('x', 422, null, 'NOT_A_RECIPE'));
    const id = startImport('https://example.com/not-food');
    await flush();
    const job = useImports.getState().jobs.find((j) => j.id === id)!;
    expect(job.status).toBe('failed');
    expect(job.group).toBe('not_recipe');
    expect(useNav.getState().toastErr).toBe(true);
  });

  test('rate-limited failures lock retry for 15 seconds', async () => {
    create.mockRejectedValue(new ApiError('x', 429, null, 'TOO_MANY_REQUESTS'));
    const id = startImport('https://example.com/busy');
    await flush();
    const job = useImports.getState().jobs.find((j) => j.id === id)!;
    expect(job.group).toBe('rate_limited');
    expect(job.retryAt! - job.finishedAt!).toBe(15_000);
  });

  test('no toast while the sheet is showing the failed job', async () => {
    create.mockRejectedValue(new ApiError('x', 422, null, 'NOT_A_RECIPE'));
    const id = startImport('https://example.com/not-food');
    useImports.getState().setFocus(id);
    useNav.setState({ addSheet: true });
    await flush();
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('cancel drops the job and cancels the server job', async () => {
    create.mockResolvedValue({ jobId: 'srv-1', status: 'queued' });
    const id = startImport('https://example.com/slow');
    await flush();
    cancelImport(id);
    expect(useImports.getState().jobs).toHaveLength(0);
    expect(cancelExtraction).toHaveBeenCalledWith('srv-1');
    expect(useNav.getState().toast).toBe('Import cancelled');
  });

  test('a completed job lands in history and toasts the title in the background', async () => {
    create.mockResolvedValue({ jobId: 'srv-2', status: 'queued' });
    poll.mockResolvedValue({
      id: 'srv-2',
      status: 'COMPLETED',
      progress: 100,
      currentStage: null,
      recipeId: 'r-1',
      error: null,
      startedAt: null,
      completedAt: null,
    });
    recipe.mockResolvedValue({
      title: 'Sicilian Caponata',
      thumbnailUrl: null,
    });
    const id = startImport('https://example.com/caponata');
    await flush();
    for (let i = 0; i < 80; i++) {
      jest.advanceTimersByTime(100);
      await flush();
    }
    const job = useImports.getState().jobs.find((j) => j.id === id)!;
    expect(job.status).toBe('done');
    expect(job.recipeId).toBe('r-1');
    expect(job.title).toBe('Sicilian Caponata');
    expect(useNav.getState().toast).toBe('Sicilian Caponata added to Cookbook');
  });

  test('retry replaces the failed row with a new running job', async () => {
    create.mockRejectedValueOnce(
      new ApiError('x', 500, null, 'EXTRACTION_FAILED'),
    );
    const id = startImport('https://example.com/flaky');
    await flush();
    create.mockResolvedValue({ jobId: 'srv-3', status: 'queued' });
    const next = retryImport(id, { slow: true });
    expect(next).not.toBeNull();
    const jobs = useImports.getState().jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe(next);
    expect(jobs[0]!.status).toBe('running');
    cancelImport(next!);
  });
});

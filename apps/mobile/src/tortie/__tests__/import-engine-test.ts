import { ApiError } from '@/services/api-client';

import {
  cancelExtraction,
  createExtraction,
  createPhotoExtraction,
  getExtractionJob,
} from '@/features/extraction/api';
import {
  PhotoFileError,
  readPhotoAsBase64,
} from '@/features/extraction/photo-files';
import { getRecipe } from '@/features/recipes/api';
import {
  cancelImport,
  retryImport,
  startImport,
  startPhotoImport,
} from '@/tortie/data/import-engine';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';

jest.mock('@/features/extraction/api', () => ({
  createExtraction: jest.fn(),
  createPhotoExtraction: jest.fn(),
  getExtractionJob: jest.fn(),
  cancelExtraction: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/extraction/photo-files', () => {
  class PhotoFileError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { PhotoFileError, readPhotoAsBase64: jest.fn() };
});
jest.mock('@/features/recipes/api', () => ({ getRecipe: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const create = createExtraction as jest.Mock;
const poll = getExtractionJob as jest.Mock;
const createPhoto = createPhotoExtraction as jest.Mock;
const readPhoto = readPhotoAsBase64 as jest.Mock;
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

  describe('photo imports', () => {
    test('uploads the photo as base64 and tracks the job as a scan', async () => {
      readPhoto.mockResolvedValue('QUJD');
      createPhoto.mockResolvedValue({ jobId: 'srv-photo', status: 'queued' });
      const id = startPhotoImport(['file:///page.jpg']);
      const job = useImports.getState().jobs.find((j) => j.id === id)!;
      expect(job.src).toEqual({
        kind: 'scan',
        name: 'Scanned page',
        host: 'Scanned page',
      });
      expect(job.status).toBe('running');
      await flush();
      expect(readPhoto).toHaveBeenCalledWith('file:///page.jpg');
      expect(createPhoto).toHaveBeenCalledWith(
        { images: ['QUJD'] },
        expect.any(AbortSignal),
      );
      cancelImport(id);
      expect(cancelExtraction).toHaveBeenCalledWith('srv-photo');
    });

    test('a photo that is not a recipe fails with photo wording', async () => {
      readPhoto.mockResolvedValue('QUJD');
      createPhoto.mockRejectedValue(
        new ApiError('x', 422, null, 'NOT_A_RECIPE'),
      );
      const id = startPhotoImport(['file:///menu.jpg']);
      await flush();
      const job = useImports.getState().jobs.find((j) => j.id === id)!;
      expect(job.status).toBe('failed');
      expect(job.group).toBe('not_recipe');
      expect(useNav.getState().toast).toMatch(/photo/i);
    });

    test('an unreadable file fails without calling the API', async () => {
      readPhoto.mockRejectedValue(new PhotoFileError('PHOTO_UNREADABLE', 'x'));
      const id = startPhotoImport(['file:///gone.jpg']);
      await flush();
      const job = useImports.getState().jobs.find((j) => j.id === id)!;
      expect(job.status).toBe('failed');
      expect(job.errorCode).toBe('PHOTO_UNREADABLE');
      expect(createPhoto).not.toHaveBeenCalled();
    });

    test('a failed scan cannot be retried from history', async () => {
      readPhoto.mockResolvedValue('QUJD');
      createPhoto.mockRejectedValue(
        new ApiError('x', 500, null, 'EXTRACTION_FAILED'),
      );
      const id = startPhotoImport(['file:///page.jpg']);
      await flush();
      expect(retryImport(id)).toBeNull();
      expect(useImports.getState().jobs).toHaveLength(1);
    });

    test('a running scan never blocks importing a link', async () => {
      readPhoto.mockReturnValue(new Promise(() => undefined));
      const scan = startPhotoImport(['file:///page.jpg']);
      create.mockResolvedValue({ jobId: 'srv-link', status: 'queued' });
      const link = startImport('https://example.com/r');
      expect(link).not.toBe(scan);
      cancelImport(scan);
      cancelImport(link);
    });
  });
});

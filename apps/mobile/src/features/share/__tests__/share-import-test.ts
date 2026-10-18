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

import { cancelExtraction, createExtraction } from '@/features/extraction/api';
import { getRecipe } from '@/features/recipes/api';
import { openSharedLink } from '@/features/share/open-shared-link';
import { sharePhaseOf } from '@/features/share/use-shared-import';
import { cancelImport, startImport } from '@/tortie/data/import-engine';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';

const create = createExtraction as jest.Mock;
const cancelServer = cancelExtraction as jest.Mock;

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useImports.setState({ jobs: [], focusId: null });
  useNav.setState(useNav.getInitialState(), true);
  create.mockResolvedValue({ jobId: 'srv-1', status: 'queued' });
  (getRecipe as jest.Mock).mockResolvedValue({
    title: 'T',
    thumbnailUrl: null,
  });
});

afterEach(() => {
  // Stop the engine ticker.
  for (const j of useImports.getState().jobs) cancelImport(j.id);
  jest.useRealTimers();
});

describe('share screen and the import engine', () => {
  test('closing the share screen leaves a running import alone', async () => {
    openSharedLink('https://example.com/r', null);
    const id = startImport('https://example.com/r');
    useNav.setState({ shareJobId: id });
    await flush();

    useNav.getState().closeShare();
    await flush();

    expect(cancelServer).not.toHaveBeenCalled();
    expect(useImports.getState().jobs[0]?.status).toBe('running');
  });

  test('Cancel stops the import and the server job', async () => {
    const id = startImport('https://example.com/r');
    await flush();
    cancelImport(id);
    expect(cancelServer).toHaveBeenCalledWith('srv-1');
    expect(useImports.getState().jobs).toHaveLength(0);
  });

  test('sharing a link that is importing reopens on that import', async () => {
    const id = startImport('https://youtu.be/abcdefghijk?si=one');
    await flush();
    expect(openSharedLink('https://youtu.be/abcdefghijk?si=two', null)).toBe(
      true,
    );
    expect(useNav.getState().shareJobId).toBe(id);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('a link that is not importing opens fresh', () => {
    openSharedLink('https://example.com/new', 'Title');
    expect(useNav.getState().shareOpen).toBe(true);
    expect(useNav.getState().shareJobId).toBeNull();
  });

  test('a repeated hand-off of the open link is ignored', () => {
    expect(openSharedLink('https://youtu.be/abcdefghijk?si=a', null)).toBe(
      true,
    );
    const nonce = useNav.getState().shareNonce;
    expect(
      openSharedLink('https://www.youtube.com/watch?v=abcdefghijk&si=b', null),
    ).toBe(false);
    expect(useNav.getState().shareNonce).toBe(nonce);
  });

  test('a new share closes the layers underneath it', () => {
    useNav.setState({ clipOn: true, cookOpen: true });
    openSharedLink('https://example.com/new', null);
    expect(useNav.getState().clipOn).toBe(false);
    expect(useNav.getState().cookOpen).toBe(false);
  });

  test('the import button never starts a second job for the same link', async () => {
    const a = startImport('https://example.com/r?utm_source=x');
    const b = startImport('https://www.example.com/r');
    await flush();
    expect(b).toBe(a);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('share phase follows the job status', () => {
    expect(sharePhaseOf(undefined)).toBe(0);
    expect(sharePhaseOf('running')).toBe(1);
    expect(sharePhaseOf('done')).toBe(2);
    expect(sharePhaseOf('failed')).toBe(0);
  });
});

import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render-with-providers';

let mockPreview: { data?: unknown; isFetching: boolean; isError: boolean } = {
  isFetching: false,
  isError: false,
};

jest.mock('@/features/link-preview/hooks/use-link-preview', () => ({
  useLinkPreview: () => mockPreview,
}));
jest.mock('@/tortie/data/import-engine', () => ({
  startImport: jest.fn(() => 'imp-1'),
  cancelImport: jest.fn(),
  findRunningImport: jest.fn(() => undefined),
}));
jest.mock('@/tortie/ui/photo', () => ({ Photo: () => null }));
jest.mock('@/tortie/ui/import-progress', () => ({
  ImportProgress: () => null,
}));
jest.mock('@/tortie/data/recipes', () => ({
  useTRecipe: () => ({ r: undefined }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { startImport } from '@/tortie/data/import-engine';
import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';
import { SharePreview } from '@/tortie/screens/share-preview';

const preview = (over: Record<string, unknown>) => ({
  url: 'x',
  sourceType: 'GENERIC_WEB',
  title: null,
  author: null,
  description: null,
  thumbnails: [],
  ...over,
});

async function share(url: string, data?: unknown, hint: string | null = null) {
  mockPreview = { data, isFetching: false, isError: false };
  await renderWithProviders(<SharePreview />);
  await act(async () => useNav.getState().openShare(url, hint));
}

beforeEach(() => {
  jest.clearAllMocks();
  useImports.setState({ jobs: [], focusId: null });
  useNav.setState(useNav.getInitialState(), true);
});

describe('share preview', () => {
  test('TikTok: no login-wall title, import disabled, reason visible', async () => {
    await share(
      'https://www.tiktok.com/@a/video/1',
      preview({ sourceType: 'TIKTOK', title: 'TikTok - Make Your Day' }),
    );
    expect(screen.queryByText('TikTok - Make Your Day')).toBeNull();
    expect(screen.getByText(/TikTok links can’t be imported yet/)).toBeTruthy();
    const button = screen.getByLabelText('Not supported yet');
    await fireEvent.press(button);
    expect(startImport).not.toHaveBeenCalled();
  });

  test('a page that does not look like a recipe is flagged before any import', async () => {
    await share(
      'https://en.wikipedia.org/wiki/Cat',
      preview({ title: 'Cat - Wikipedia', looksLikeRecipe: false }),
    );
    expect(screen.getByText(/doesn’t look like a recipe/)).toBeTruthy();
    expect(screen.queryByLabelText('Import recipe')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Import anyway'));
    expect(screen.getByLabelText('Import recipe')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Import recipe'));
    expect(startImport).toHaveBeenCalledTimes(1);
  });

  test('a recipe page imports straight away', async () => {
    await share(
      'https://example.com/soup',
      preview({ title: 'Tomato soup', looksLikeRecipe: true }),
    );
    expect(screen.queryByText(/doesn’t look like a recipe/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Import recipe'));
    expect(startImport).toHaveBeenCalledTimes(1);
  });

  test('Instagram with no preview data shows a note, not the hostname as a title', async () => {
    await share(
      'https://www.instagram.com/reel/abc',
      preview({ sourceType: 'INSTAGRAM' }),
    );
    expect(screen.getByText(/Preview not available/)).toBeTruthy();
    // The domain appears once, in the small line under the card, not as a headline.
    expect(screen.getAllByText('instagram.com')).toHaveLength(1);
    expect(screen.getByLabelText('Import from Instagram')).toBeTruthy();
  });

  test('Back leaves a running import running', async () => {
    useImports.setState({
      jobs: [
        {
          id: 'imp-9',
          url: 'https://example.com/soup',
          src: { kind: 'web', name: 'Website', host: 'example.com' },
          status: 'running',
          pct: 20,
          createdAt: 1,
        },
      ],
      focusId: null,
    });
    await share('https://example.com/soup', preview({ title: 'Soup' }));
    await act(async () => useNav.setState({ shareJobId: 'imp-9' }));
    expect(screen.getByLabelText('Cancel import')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(useNav.getState().shareOpen).toBe(false);
    const { cancelImport } = jest.requireMock('@/tortie/data/import-engine');
    expect(cancelImport).not.toHaveBeenCalled();
    expect(useImports.getState().jobs[0]?.status).toBe('running');
  });
});

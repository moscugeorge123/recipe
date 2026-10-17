import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render-with-providers';

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));
jest.mock('@/features/link-preview/hooks/use-link-preview', () => ({
  useLinkPreview: () => ({ data: undefined, isFetching: false }),
}));
jest.mock('@/tortie/data/import-engine', () => ({
  startImport: jest.fn(() => 'imp-1'),
  retryImport: jest.fn(),
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

import { useImports } from '@/tortie/import-store';
import { useNav } from '@/tortie/nav-store';
import { AddRecipeSheet } from '@/tortie/screens/add-recipe';

const PLACEHOLDER = 'Paste a recipe link';
const value = () => screen.getByPlaceholderText(PLACEHOLDER).props.value;

async function nav(fn: () => void) {
  await act(async () => fn());
}

async function typeLink(text: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), text);
}

beforeEach(() => {
  useImports.setState({ jobs: [], focusId: null });
  useNav.setState(useNav.getInitialState(), true);
});

describe('Add recipe sheet', () => {
  test('open, type, close, reopen: the field is empty', async () => {
    await renderWithProviders(<AddRecipeSheet />);

    await nav(() => useNav.getState().openAdd());
    await typeLink('https://example.com/old-link');
    expect(value()).toBe('https://example.com/old-link');

    await nav(() => useNav.getState().closeAdd());
    // The text stays while the sheet slides away, then clears.
    expect(value()).toBe('https://example.com/old-link');
    await waitFor(() => expect(value()).toBe(''), { timeout: 3000 });

    await nav(() => useNav.getState().openAdd());
    expect(value()).toBe('');
  });

  test('reopening before the sheet has finished closing still starts empty', async () => {
    await renderWithProviders(<AddRecipeSheet />);
    await nav(() => useNav.getState().openAdd());
    await typeLink('https://example.com/typed');
    await nav(() => useNav.getState().closeAdd());
    await nav(() => useNav.getState().openAdd());
    expect(value()).toBe('');
  });

  test('going to the camera keeps what was typed', async () => {
    await renderWithProviders(<AddRecipeSheet />);
    await nav(() => useNav.getState().openAdd());
    await typeLink('https://example.com/typed');
    await nav(() => useNav.getState().openCam());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });
    await nav(() => useNav.getState().closeCam(true));
    expect(value()).toBe('https://example.com/typed');
  });

  test('Edit link on a failed import puts the failed link back', async () => {
    useImports.setState({
      jobs: [
        {
          id: 'imp-failed',
          url: 'https://example.com/typo',
          src: { kind: 'web', name: 'Website', host: 'example.com' },
          status: 'failed',
          pct: 10,
          createdAt: 1,
          finishedAt: 2,
          errorCode: 'INVALID_URL',
          group: 'cant_open',
        },
      ],
      focusId: null,
    });
    await renderWithProviders(<AddRecipeSheet />);
    await nav(() => useNav.getState().openAddJob('imp-failed'));
    await fireEvent.press(await screen.findByText('Edit link'));
    expect(value()).toBe('https://example.com/typo');
  });
});

import { act, renderHook } from '@testing-library/react-native';

import { useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { finishWelcome, useWelcomeGate } from '@/tortie/screens/welcome';

const recipes = {
  list: [] as { id: string }[],
  isLoading: false,
  isError: false,
};

jest.mock('@/tortie/data/recipes', () => ({
  useTRecipes: () => recipes,
}));
jest.mock('@/tortie/prefs-store', () => {
  const actual = jest.requireActual('@/tortie/prefs-store');
  return { ...actual, usePrefsHydrated: () => true };
});

beforeEach(() => {
  jest.useFakeTimers();
  recipes.list = [];
  recipes.isLoading = false;
  recipes.isError = false;
  useTortiePrefs.getState().set({ welcomed: false });
  useNav.setState(useNav.getInitialState(), true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useWelcomeGate', () => {
  test('opens the tour for an empty library', async () => {
    await renderHook(() => useWelcomeGate());
    expect(useNav.getState().welcome).toBe(true);
    expect(useTortiePrefs.getState().welcomed).toBe(false);
  });

  test('marks an existing kitchen as welcomed without showing the tour', async () => {
    recipes.list = [{ id: 'r1' }];
    await renderHook(() => useWelcomeGate());
    expect(useNav.getState().welcome).toBe(false);
    expect(useTortiePrefs.getState().welcomed).toBe(true);
  });

  test('waits while recipes load or fail', async () => {
    recipes.isLoading = true;
    const { rerender } = await renderHook(() => useWelcomeGate());
    expect(useNav.getState().welcome).toBe(false);

    recipes.isLoading = false;
    recipes.isError = true;
    await rerender({});
    expect(useNav.getState().welcome).toBe(false);
  });

  test('never reopens once welcomed', async () => {
    useTortiePrefs.getState().set({ welcomed: true });
    await renderHook(() => useWelcomeGate());
    expect(useNav.getState().welcome).toBe(false);
  });
});

describe('finishWelcome', () => {
  test('closes the tour, remembers it and can hand off to the Add sheet', () => {
    useNav.getState().openWelcome();
    finishWelcome(true);
    expect(useNav.getState().welcome).toBe(false);
    expect(useTortiePrefs.getState().welcomed).toBe(true);
    expect(useNav.getState().addSheet).toBe(false);

    act(() => {
      jest.runAllTimers();
    });
    expect(useNav.getState().addSheet).toBe(true);
  });
});

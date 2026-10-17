import { useCook } from '@/tortie/cook-store';
import { openImportedRecipe, useNav } from '@/tortie/nav-store';

const OVERLAY_FLAGS = [
  'addSheet',
  'cam',
  'menu',
  'menuBulk',
  'nc',
  'fs',
  'cal',
  'pedOn',
  'gedOn',
  'grocEdit',
  'grocPickOn',
  'notesOn',
  'clipOn',
  'edit',
  'cookOpen',
  'welcome',
] as const;

beforeEach(() => {
  useNav.setState(useNav.getInitialState(), true);
});

describe('closeOverlays', () => {
  test('clears every overlay flag', () => {
    useNav.setState(
      Object.fromEntries(OVERLAY_FLAGS.map((k) => [k, true])) as object,
    );
    useNav.getState().closeOverlays();
    const s = useNav.getState();
    for (const k of OVERLAY_FLAGS) expect(s[k]).toBe(false);
  });

  test('leaves the cook session alone', () => {
    useCook.getState().keep('r1', 2);
    const before = useCook.getState().active;
    useNav.setState({ cookOpen: true, clipOn: true, notesOn: true });
    useNav.getState().closeOverlays();
    expect(useNav.getState().cookOpen).toBe(false);
    expect(useCook.getState().active).toEqual(before);
    expect(useCook.getState().activeOn).toBe(true);
  });

  test('keeps the profile and Imports screens unless asked', () => {
    useNav.setState({ prof: true, imports: true });
    useNav.getState().closeOverlays();
    expect(useNav.getState().prof).toBe(true);
    useNav.getState().closeOverlays(true);
    expect(useNav.getState().prof).toBe(false);
    expect(useNav.getState().imports).toBe(false);
  });

  test('openImportedRecipe closes the clip viewer and opens the recipe', () => {
    useNav.setState({ clipOn: true, cookOpen: true });
    openImportedRecipe('abc');
    const s = useNav.getState();
    expect(s.clipOn).toBe(false);
    expect(s.cookOpen).toBe(false);
    expect(s.detailOpen).toBe(true);
    expect(s.detailId).toBe('abc');
  });
});

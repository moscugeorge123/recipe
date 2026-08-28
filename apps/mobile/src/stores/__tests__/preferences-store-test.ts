import {
  DEFAULT_DISPLAY_NAME,
  usePreferencesStore,
} from '@/stores/preferences-store';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  test('starts with the default display name', () => {
    expect(usePreferencesStore.getState().displayName).toBe(
      DEFAULT_DISPLAY_NAME,
    );
  });

  test('updates the display name', () => {
    usePreferencesStore.getState().setDisplayName('Ada');

    expect(usePreferencesStore.getState().displayName).toBe('Ada');
  });

  test('resets back to the default display name', () => {
    usePreferencesStore.getState().setDisplayName('Ada');
    usePreferencesStore.getState().reset();

    expect(usePreferencesStore.getState().displayName).toBe(
      DEFAULT_DISPLAY_NAME,
    );
  });
});

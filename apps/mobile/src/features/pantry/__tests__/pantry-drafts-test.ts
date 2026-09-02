import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPantryDraft,
  readPantryDraft,
  writePantryDraft,
} from '@/features/pantry/pantry-drafts';

describe('pantry drafts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('survives a round-trip so retry does not clear typed input', async () => {
    await writePantryDraft({
      text: 'gochujang\nsalt',
      preview: [],
      unresolved: [],
    });
    await expect(readPantryDraft()).resolves.toEqual({
      text: 'gochujang\nsalt',
      preview: [],
      unresolved: [],
    });
    await clearPantryDraft();
    await expect(readPantryDraft()).resolves.toEqual({
      text: '',
      preview: [],
      unresolved: [],
    });
  });
});

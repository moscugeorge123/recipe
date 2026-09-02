import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  OrganizedPantryItem,
  UnresolvedPantryLine,
} from '@/features/pantry/types';

const KEY = 'mise.pantry-draft.v1';

export type PantryDraft = {
  text: string;
  preview: OrganizedPantryItem[];
  unresolved: UnresolvedPantryLine[];
};

export async function readPantryDraft(): Promise<PantryDraft> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return { text: '', preview: [], unresolved: [] };
    }
    const parsed = JSON.parse(raw) as Partial<PantryDraft>;
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      preview: Array.isArray(parsed.preview) ? parsed.preview : [],
      unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
    };
  } catch {
    return { text: '', preview: [], unresolved: [] };
  }
}

export async function writePantryDraft(draft: PantryDraft): Promise<void> {
  try {
    if (
      !draft.text.trim() &&
      draft.preview.length === 0 &&
      draft.unresolved.length === 0
    ) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Draft persistence is best-effort.
  }
}

export async function clearPantryDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

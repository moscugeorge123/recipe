import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'mise.note-draft.v1';

function keyFor(recipeId: string): string {
  return `${PREFIX}.${recipeId}`;
}

export async function readNoteDraft(recipeId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(keyFor(recipeId))) ?? '';
  } catch {
    return '';
  }
}

export async function writeNoteDraft(
  recipeId: string,
  body: string,
): Promise<void> {
  try {
    const trimmed = body.trimStart();
    if (!trimmed) {
      await AsyncStorage.removeItem(keyFor(recipeId));
      return;
    }
    await AsyncStorage.setItem(keyFor(recipeId), body);
  } catch {
    // Draft persistence is best-effort.
  }
}

export async function clearNoteDraft(recipeId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(recipeId));
  } catch {
    // Ignore.
  }
}

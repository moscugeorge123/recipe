import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isRecipeEditorValues,
  type RecipeEditorValues,
} from '@/features/recipes/editor-form';

const PREFIX = 'mise.recipe-editor-draft.v1';
const PERSIST_MS = 250;

export type RecipeEditorDraft = {
  recipeId: string;
  revisionNumber: number;
  updatedAt: string;
  values: RecipeEditorValues;
};

const memory = new Map<string, RecipeEditorDraft>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function keyFor(recipeId: string): string {
  return `${PREFIX}.${recipeId}`;
}

export function peekRecipeEditorDraft(
  recipeId: string,
): RecipeEditorDraft | null {
  return memory.get(recipeId) ?? null;
}

export function rememberRecipeEditorDraft(
  recipeId: string,
  revisionNumber: number,
  values: RecipeEditorValues,
): RecipeEditorDraft {
  const record: RecipeEditorDraft = {
    recipeId,
    revisionNumber,
    updatedAt: new Date().toISOString(),
    values,
  };
  memory.set(recipeId, record);
  const existing = persistTimers.get(recipeId);
  if (existing) clearTimeout(existing);
  persistTimers.set(
    recipeId,
    setTimeout(() => {
      persistTimers.delete(recipeId);
      void writeRecipeEditorDraft(record);
    }, PERSIST_MS),
  );
  return record;
}

export async function writeRecipeEditorDraft(
  record: RecipeEditorDraft,
): Promise<void> {
  memory.set(record.recipeId, record);
  try {
    await AsyncStorage.setItem(keyFor(record.recipeId), JSON.stringify(record));
  } catch {
    // Draft persistence is best-effort.
  }
}

export async function readRecipeEditorDraft(
  recipeId: string,
): Promise<RecipeEditorDraft | null> {
  const cached = memory.get(recipeId);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(keyFor(recipeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecipeEditorDraft;
    if (
      !parsed ||
      parsed.recipeId !== recipeId ||
      typeof parsed.revisionNumber !== 'number' ||
      !isRecipeEditorValues(parsed.values)
    ) {
      return null;
    }
    memory.set(recipeId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function clearRecipeEditorDraft(recipeId: string): Promise<void> {
  memory.delete(recipeId);
  const timer = persistTimers.get(recipeId);
  if (timer) {
    clearTimeout(timer);
    persistTimers.delete(recipeId);
  }
  try {
    await AsyncStorage.removeItem(keyFor(recipeId));
  } catch {
    // Ignore.
  }
}

export function forgetRecipeEditorDraftMemory(recipeId?: string): void {
  if (recipeId) {
    memory.delete(recipeId);
    const timer = persistTimers.get(recipeId);
    if (timer) {
      clearTimeout(timer);
      persistTimers.delete(recipeId);
    }
    return;
  }
  memory.clear();
  for (const timer of persistTimers.values()) clearTimeout(timer);
  persistTimers.clear();
}

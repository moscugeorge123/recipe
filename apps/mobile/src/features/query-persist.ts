import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'mise.query.v1';

export function persistKeyFor(parts: readonly unknown[]): string {
  return `${PREFIX}:${JSON.stringify(parts)}`;
}

export async function readPersistedQuery<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writePersistedQuery(
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort.
  }
}

/**
 * Network-first with a durable fallback. Callers surface `fromCache` so the
 * UI can show a last-known-data state instead of a blank error.
 */
export async function networkFirst<T>(
  key: string,
  load: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await load();
    await writePersistedQuery(key, data);
    return { data, fromCache: false };
  } catch (error) {
    const cached = await readPersistedQuery<T>(key);
    if (cached != null) {
      return { data: cached, fromCache: true };
    }
    throw error;
  }
}

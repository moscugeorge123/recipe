import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper around expo-secure-store.
 *
 * Use this only for small sensitive values (tokens, secrets). Do not store
 * general application state here — that belongs in Zustand or TanStack Query.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

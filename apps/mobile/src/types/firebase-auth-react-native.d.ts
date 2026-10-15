import type { Persistence } from 'firebase/auth';

/**
 * Metro resolves `firebase/auth` to the React Native build, which exports
 * `getReactNativePersistence`, but TypeScript resolves the default (web)
 * typings that omit it. Declare the one function we use.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}

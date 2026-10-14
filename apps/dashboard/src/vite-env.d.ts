/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIXTURES?: string;
  /** Absolute API origin, without a trailing slash. Empty in local dev (Vite proxies `/api`). */
  readonly VITE_API_BASE?: string;
}

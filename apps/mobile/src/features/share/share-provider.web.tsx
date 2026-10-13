import type { ReactNode } from 'react';

/** Web has no share sheet. The native provider lives in `share-provider.tsx`. */
export function ShareRoot({ children }: { children: ReactNode }) {
  return children;
}

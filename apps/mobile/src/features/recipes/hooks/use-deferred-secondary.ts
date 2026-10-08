import { useEffect, useState } from 'react';

/** Starts secondary detail work (notes) after the first paint. */
export function useDeferredSecondary(active: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return active && ready;
}

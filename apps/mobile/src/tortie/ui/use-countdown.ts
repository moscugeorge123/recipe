import { useEffect, useState } from 'react';

import { retrySecondsLeft } from '@/features/extraction/error-groups';

/** Whole seconds until `until` (epoch ms), re-rendering twice a second. 0 when free. */
export function useCountdown(until: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const left = retrySecondsLeft(until, now);
  useEffect(() => {
    if (!until) return;
    const sync = () => {
      const t = Date.now();
      setNow(t);
      if (retrySecondsLeft(until, t) === 0) clearInterval(iv);
    };
    const iv = setInterval(sync, 500);
    const first = setTimeout(sync, 0);
    return () => {
      clearInterval(iv);
      clearTimeout(first);
    };
  }, [until]);
  return left;
}

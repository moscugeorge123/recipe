import { useEffect, useState } from 'react';

import { DAISY_COPY, type DaisyCopyBucket } from '@/components/daisy/phase';

export const DAISY_COPY_ROTATE_MS = 2300;

export function useDaisyCopy(bucket: DaisyCopyBucket) {
  // The cursor carries its bucket so a state change restarts the rotation
  // without needing to reset it from an effect body.
  const [cursor, setCursor] = useState({ bucket, index: 0 });

  useEffect(() => {
    if (DAISY_COPY[bucket].length <= 1) {
      return;
    }
    const id = setInterval(() => {
      setCursor((current) =>
        current.bucket === bucket
          ? { bucket, index: current.index + 1 }
          : { bucket, index: 0 },
      );
    }, DAISY_COPY_ROTATE_MS);
    return () => clearInterval(id);
  }, [bucket]);

  const lines = DAISY_COPY[bucket];
  const index = cursor.bucket === bucket ? cursor.index : 0;
  return lines[index % lines.length] ?? lines[0] ?? '';
}

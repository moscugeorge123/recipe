import { useEffect, useState } from 'react';

import {
  DAISY_BEATS,
  type DaisyBeat,
  type DaisyPhase,
} from '@/components/daisy/phase';

// Blink, beats and the chip highlight each run on their own timer so the
// composite never lands on a visible restart point.
export function useDaisyBeats(phase: DaisyPhase, reduced: boolean) {
  const [blinking, setBlinking] = useState(false);
  const [beat, setBeat] = useState<DaisyBeat>('settle');
  const [chip, setChip] = useState(0);
  const analyzing = phase === 'analyzing' && !reduced;

  useEffect(() => {
    if (reduced) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        () => {
          if (cancelled) {
            return;
          }
          setBlinking(true);
          timer = setTimeout(() => {
            if (cancelled) {
              return;
            }
            setBlinking(false);
            loop();
          }, 130);
        },
        2400 + Math.random() * 2600,
      );
    };
    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduced]);

  useEffect(() => {
    if (!analyzing) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        () => {
          if (cancelled) {
            return;
          }
          setBeat((previous) => {
            let next = previous;
            while (next === previous) {
              next =
                DAISY_BEATS[Math.floor(Math.random() * DAISY_BEATS.length)] ??
                'settle';
            }
            return next;
          });
          loop();
        },
        1100 + Math.random() * 900,
      );
    };
    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [analyzing]);

  useEffect(() => {
    if (!analyzing) {
      return;
    }
    const id = setInterval(() => {
      setChip((current) => current + 1);
    }, 2300);
    return () => clearInterval(id);
  }, [analyzing]);

  return {
    beat: analyzing ? beat : 'settle',
    blink: blinking && !reduced,
    chipFocus: analyzing ? chip % 3 : -1,
  };
}

import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { DaisyCat } from '@/components/daisy/daisy-cat';
import { DaisyCards } from '@/components/daisy/daisy-cards';
import { DaisyImportCard } from '@/components/daisy/daisy-import-card';
import {
  DAISY_CHIP_BAND,
  DAISY_CHIP_GAP,
  type DaisyPhase,
} from '@/components/daisy/phase';
import { useDaisyBeats } from '@/components/daisy/use-daisy-beats';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';

export type DaisyMascotProps = {
  phase: DaisyPhase;
  size?: number;
  showCards?: boolean;
  variant?: 'full' | 'face';
  reducedMotion?: boolean;
};

export function DaisyMascot({
  phase,
  size = 240,
  showCards = true,
  variant = 'full',
  reducedMotion,
}: DaisyMascotProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const { beat, blink, chipFocus } = useDaisyBeats(phase, reduced);
  const prevPhase = useRef(phase);
  const stage = variant === 'full' && showCards;
  const cards =
    showCards &&
    variant === 'full' &&
    !reduced &&
    (phase === 'analyzing' || phase === 'processing' || phase === 'success');

  useEffect(() => {
    const previous = prevPhase.current;
    if (
      (phase === 'analyzing' || phase === 'processing') &&
      previous !== 'analyzing' &&
      previous !== 'processing' &&
      !reduced
    ) {
      hapticLight().catch(() => undefined);
    }
    if (phase === 'success' && previous !== 'success' && !reduced) {
      hapticSuccess().catch(() => undefined);
    }
    prevPhase.current = phase;
  }, [phase, reduced]);

  const cat = (
    <DaisyCat
      beat={beat}
      blink={blink}
      phase={phase}
      reducedMotion={reduced}
      size={size}
      variant={variant}
    />
  );

  if (!stage) {
    return (
      <View
        testID="daisy-mascot"
        accessibilityElementsHidden
        importantForAccessibility="no"
        pointerEvents="none"
      >
        {cat}
      </View>
    );
  }

  // The band above Daisy is real layout, so nothing can be clipped. The
  // matching bottom margin pulls the group up by half the band, which lands
  // Daisy herself on the optical centre of the screen.
  return (
    <View
      testID="daisy-mascot"
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{
        width: '100%',
        alignItems: 'center',
        marginBottom: DAISY_CHIP_BAND + DAISY_CHIP_GAP,
      }}
    >
      <View style={{ width: '100%', maxWidth: 360, alignItems: 'center' }}>
        <View
          style={{
            alignSelf: 'stretch',
            height: DAISY_CHIP_BAND,
            marginBottom: DAISY_CHIP_GAP,
          }}
        >
          {cards ? (
            <DaisyCards
              focus={chipFocus}
              phase={phase}
              reducedMotion={reduced}
            />
          ) : null}
          <DaisyImportCard phase={phase} reducedMotion={reduced} />
        </View>
        {cat}
      </View>
    </View>
  );
}

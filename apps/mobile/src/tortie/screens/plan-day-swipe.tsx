import { useCallback, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { hapticSelection } from '@/lib/haptics';
import {
  planDayShift,
  shouldCommitDaySwipe,
} from '@/tortie/data/plan-day-shift';
import { planLogicalCursor, usePlan } from '@/tortie/data/plan';

function applyDaySwipe(
  translationX: number,
  velocityX: number,
  translationY: number,
) {
  if (!shouldCommitDaySwipe(translationX, velocityX, translationY)) return;

  const state = usePlan.getState();
  const { wk, day } = planLogicalCursor(state);
  const { setDay, goDate } = state;
  const next = planDayShift(wk, day, translationX);
  if (next.kind === 'noop') return;

  if (next.kind === 'setDay') {
    if (next.day === day) return;
    setDay(next.day);
  } else {
    if (next.wk === wk && next.day === day) return;
    goDate(next.wk, next.day);
  }
  void hapticSelection();
}

/** Horizontal pan over plan scroll content to move one day (incl. week edges). */
export function PlanDaySwipe({ children }: { children: ReactNode }) {
  const onSwipe = useCallback(
    (tx: number, vx: number, ty: number) => applyDaySwipe(tx, vx, ty),
    [],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          runOnJS(onSwipe)(e.translationX, e.velocityX, e.translationY);
        }),
    [onSwipe],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

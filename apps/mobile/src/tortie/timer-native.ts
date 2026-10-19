import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { TimerAction } from '@/tortie/timer-clock';

export type CookTimerNative = {
  /** Hand timers over: a card each, and an alarm for running ones when `ring`. */
  arm: (
    timers: {
      key: string;
      title: string;
      /** 0 while paused. */
      endsAt: number;
      paused: boolean;
      remSec: number;
      ring: boolean;
    }[],
  ) => void;
  /** Take them back: clears every card and alarm, returns the presses since `arm`. */
  disarm: () => TimerAction[];
  takeLaunchKey: () => string | null;
  addListener: (
    event: 'onOpen',
    listener: (e: { key: string }) => void,
  ) => { remove: () => void };
};

/**
 * Android's timer notifications (modules/cook-timer-live). When present it
 * also rings finished timers, in place of expo-notifications. Missing in
 * Expo Go and on iOS.
 */
export const cookTimerNative =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<CookTimerNative>('CookTimerLive')
    : null;

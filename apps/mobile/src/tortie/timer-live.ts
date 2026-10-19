import { AppState, type AppStateStatus } from 'react-native';

import { useCook } from '@/tortie/cook-store';
import { useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import {
  applyTimerActions,
  liveTimerKeys,
  splitTimerKey,
} from '@/tortie/timer-clock';
import { cookTimerNative, type CookTimerNative } from '@/tortie/timer-native';

/**
 * Running and paused timers stay on screen while Tortie is closed (Android):
 * it hands them to the native side on leaving the foreground, which shows a
 * card each and rings running ones at zero. Pause, resume, × and Stop work on the cards; Tortie
 * replays them when it comes back and the cards clear. A tap opens the step.
 */
export function startLiveTimers(): () => void {
  if (!cookTimerNative) return () => undefined;
  const native = cookTimerNative;
  const onChange = (state: AppStateStatus) => {
    if (!useCook.persist.hasHydrated()) return;
    if (state === 'active') takeBack(native);
    else if (state === 'background') handOver(native);
  };
  const appSub = AppState.addEventListener('change', onChange);
  const openSub = native.addListener('onOpen', ({ key }) => openStep(key));
  const boot = () => {
    takeBack(native);
    const key = native.takeLaunchKey();
    if (key) openStep(key);
  };
  const unsubHydrate = useCook.persist.onFinishHydration(boot);
  if (useCook.persist.hasHydrated()) boot();

  return () => {
    appSub.remove();
    openSub.remove();
    unsubHydrate();
  };
}

function handOver(native: CookTimerNative) {
  useCook.getState().tick();
  const { timers } = useCook.getState();
  const ring = useTortiePrefs.getState().timerAlerts;
  const live = liveTimerKeys(timers, Date.now()).map((key) => {
    const timer = timers[key]!;
    return {
      key,
      title: timer.title || timer.recipeTitle || 'Cooking timer',
      endsAt: timer.run ? timer.endsAt! : 0,
      paused: !timer.run,
      remSec: timer.rem,
      ring,
    };
  });
  try {
    native.arm(live);
  } catch {
    // Notifications blocked: timer-alarm already told the cook.
  }
}

function takeBack(native: CookTimerNative) {
  let actions;
  try {
    actions = native.disarm();
  } catch {
    return;
  }
  if (actions.length > 0) {
    const timers = useCook.getState().timers;
    const next = applyTimerActions(timers, actions, Date.now());
    if (next !== timers) useCook.setState({ timers: next });
  }
  useCook.getState().tick();
}

function openStep(key: string) {
  const parts = splitTimerKey(key);
  if (!parts) return;
  useNav.getState().set({ timerHeld: null });
  const cook = useCook.getState();
  cook.begin(parts.recipeId);
  cook.setStep(parts.step);
  useNav.getState().openCook(parts.recipeId);
}

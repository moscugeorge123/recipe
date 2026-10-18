# Q23. No alarm sound when a cooking timer finishes

🔴 High · mobile · Finding **F81** (reported by the product owner; the first QA pass listed "timer alarms/notifications" under *Not tested*)

## Problem

A cooking timer reaches zero and nothing rings. Every finished timer must sound an alarm, whether the app is in the foreground (cook mode or any other screen), in the background, or closed.

## Evidence

Reported on a device; no screenshot. `D3-cook-timer-settings` is done, and `timer-alarm.ts` / `timer-clock.ts` exist, so the feature was built. Something in the chain is silent, or the sound depends on a path that does not run.

## Root cause (hypothesis: run the checks below first)

The **only** thing that makes noise is an OS notification scheduled at `endsAt` (`tortie/timer-alarm.ts`, `schedule()`). The foreground path in `cook-store.ts` `tick()` only calls `toast('Timer done — …')`, and `cook.tsx` only fires a **haptic**. There is no in-app sound at all. So the alarm is silent whenever the notification does not ring:

1. **Alarms are switched off in Expo Go on Android** (`alarmsSupported` is false; a `console.warn` in `__DEV__` is the only sign).
2. **Notification permission denied or never asked.** `ensurePermission()` runs only when something needs scheduling. If it returns false, `reconcile()` cancels the alarm and returns, with no fallback and no message to the user (Android 13+ `POST_NOTIFICATIONS`).
3. **The "Timer alerts" preference is off** (`prefs.timerAlerts`): `diffAlarms` then schedules nothing, and the haptic is skipped too.
4. **Android channels are immutable.** `cook-alarms-v1` is created once with the sound; if an earlier build created it without the sound (or the installed dev client was built before `expo-notifications` got the `sounds` plugin entry), it stays silent until the channel id changes or the app is reinstalled. Check `adb shell dumpsys notification | grep -A8 cook-alarms`.
5. **Foreground race.** The notification and the 1 s ticker both fire at `endsAt`. When the app is in the foreground the notification is delivered through `setNotificationHandler`, which is only installed after the first `loadNotifications()` call. If that has not run yet, the foreground notification is dropped.

## Fix

1. **Add an in-app alarm that does not depend on notifications.** When `tick()` / `projectTimers` reports a finished timer (the existing `finished` list) and the app is active, play `assets/sounds/cook_alarm.wav` with `expo-audio` (not installed yet; native module, so the dev client must be rebuilt). Loop it until the user dismisses the timer, taps Stop on the toast, or 30 s pass. Respect `timerAlerts`.
2. Keep the OS notification for background/closed. When the app is foregrounded set `shouldPlaySound: false` in the handler so the sound is not played twice, and let the in-app alarm ring.
3. If notification permission is refused, show a one-time toast ("Allow notifications so timers can ring when Tortie is closed") and keep the in-app alarm working.
4. Bump the channel id (`cook-alarms-v2`) so a silent channel from an older build is replaced.
5. Add a **"Test alarm"** row next to the *Timer alerts* setting in Profile that plays the sound and fires a notification in 5 s. It makes the next report diagnosable in 10 seconds.
6. Audio mode: play through the alarm/media stream, mix with other audio, and play in silent mode on iOS.

## Acceptance criteria

- A timer finishing in cook mode, on another tab, or on Today rings until dismissed.
- With the app backgrounded or killed, the notification rings (dev build, notifications allowed).
- With notifications denied, the foreground still rings and the user is told why the background will not.
- *Timer alerts* off means no sound and no haptic.
- Finishing two timers at once rings once, not twice over itself.

## Tests

- Jest: a pure `shouldRing(finished, prefs, appState)` helper; `tick()` calls the alarm player once per finished timer; the player stops on `dismiss`.
- Manual (dev build, Pixel 6): 1-minute timer in cook mode; same with the app backgrounded; same with the app swiped away; same with notifications denied; volume on/off; do-not-disturb.

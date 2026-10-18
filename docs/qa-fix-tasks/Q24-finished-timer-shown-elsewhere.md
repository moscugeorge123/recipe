# Q24. A timer that finished on its own screen keeps showing on other screens

🟠 Medium · mobile · Finding **F82**

## Problem

A timer runs out while the cook is looking at its step. They see "Done" and carry on. Later, on other steps, the **same finished timer** is still pinned in the dock at the bottom, and the "Timer done — …" toast can also appear on whatever screen they happen to be on. A timer that finished in front of the user should not follow them around.

## Evidence

Reported on a device; no screenshot.

## Root cause (verified in code)

* `Dock` in `tortie/screens/cook.tsx` lists a timer when `(t.run || t.rem < t.total) && k !== visibleKey`. A finished timer has `rem === 0 < total`, so it stays in the dock on every step except its own, until the user presses ✕ (`dismiss`). Nothing records that the user already saw it finish.
* `useCook.tick()` (`tortie/cook-store.ts`) shows `toast('Timer done — …')` for every finished timer on **any** screen, including when the user is on the timer's own step and already sees the "Done" state.
* `StepTimer` has no "acknowledged" state.

## Fix

1. Add `seen?: boolean` (or `doneSeenAt`) to `StepTimer`. Set it when a timer reaches zero **while its step is the visible one in cook mode**, or when the user opens its step afterwards.
2. Dock filter: hide finished timers that are `seen`. A finished timer the user has **not** seen (finished while they were on another step or tab) stays in the dock until they open it, then it is marked seen and leaves the dock.
3. Toast: skip it when the finished timer's step is the visible cook step; keep it for finishes the user might have missed.
4. Restarting the timer (+1 min, start) clears `seen`.
5. Persist the flag with the rest of `tortie-cook` and add a version bump or default (`seen` missing means false) so old persisted timers still load.

## Acceptance criteria

- Timer finishes on its own step → no dock pill on other steps, no toast.
- Timer finishes while the user is on another step or tab → pill + toast, and the pill disappears after the user opens that step.
- The OS alarm ([Q23](Q23-timer-alarm-sound.md)) still rings in both cases; this task only changes what is drawn.
- Restarting a finished timer shows it in the dock again while it runs.

## Tests

- Jest: `projectTimers` + the visible-key rule (finished while visible, finished while hidden, restarted); dock filter helper pulled out as a pure function.
- Manual: 1-minute timer on step 2, stay on step 2, then go to step 3; repeat leaving to step 3 before it ends.

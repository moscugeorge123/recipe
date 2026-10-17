/**
 * In-app cooking alarm. Plays the bundled alarm sound on loop while the app
 * is open, independent of OS notifications (which cover background/closed).
 * Uses expo-video's audio playback, already in the dev client, so no native
 * rebuild is needed.
 */
const MAX_RING_MS = 30_000;

type Player = {
  loop: boolean;
  volume: number;
  audioMixingMode?: string;
  play: () => void;
  pause: () => void;
  release: () => void;
};

let player: Player | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let ringing = false;
let generation = 0;

export const isRinging = () => ringing;

/** Starts the looping alarm. A second call while ringing only extends the 30 s cap. */
export function startAlarm(): void {
  armStop();
  if (ringing) return;
  ringing = true;
  const mine = ++generation;
  void (async () => {
    try {
      const { createVideoPlayer } = await import('expo-video');
      if (!ringing || mine !== generation) return;
      const source: number = require('../../assets/sounds/cook_alarm.wav');
      const p = createVideoPlayer(source) as unknown as Player;
      p.loop = true;
      p.volume = 1;
      try {
        p.audioMixingMode = 'mixWithOthers';
      } catch {
        /* older runtimes */
      }
      player = p;
      p.play();
    } catch {
      if (mine === generation) ringing = false;
    }
  })();
}

/** Stops the alarm if it is ringing. Safe to call any time. */
export function stopAlarm(): void {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  ringing = false;
  generation++;
  const p = player;
  player = null;
  if (!p) return;
  try {
    p.pause();
    p.release();
  } catch {
    /* already released */
  }
}

function armStop() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(stopAlarm, MAX_RING_MS);
}

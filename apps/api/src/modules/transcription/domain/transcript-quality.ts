/**
 * Whisper returns an empty string, bracketed sound tags, or stock "outro" phrases when a video
 * has only music or silence. Those must not reach the extractor as if they were narration.
 */
const SOUND_TAG = /[[(（【]\s*(music|musique|música|musik|applause|laughter|silence|sound|noise|instrumental|no speech|blank_audio)[^\])）】]*[\])）】]/giu;
const MUSIC_SYMBOLS = /[♪♫♬🎵🎶]/gu;

const HALLUCINATION_PHRASES = [
  'thank you for watching',
  'thanks for watching',
  'thank you so much for watching',
  'please subscribe',
  'like and subscribe',
  'subscribe to my channel',
  'see you in the next video',
  'see you next time',
  'subtitles by the amara.org community',
  'transcribed by',
  'thank you',
  'bye',
  'you',
];

const HALLUCINATION_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${HALLUCINATION_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`,
  'gu',
);

const MIN_MEANINGFUL_CHARS = 15;

function normalize(text: string): string {
  return text
    .replace(SOUND_TAG, ' ')
    .replace(MUSIC_SYMBOLS, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a speech-to-text result contains actual narration worth using as evidence. */
export function isMeaningfulTranscript(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }

  const remaining = normalize(text)
    .replace(HALLUCINATION_PATTERN, ' ')
    .replace(/[.\s]+/g, ' ')
    .trim();

  if (remaining.length < MIN_MEANINGFUL_CHARS) {
    return false;
  }

  const words = remaining.split(' ');
  const distinct = new Set(words);
  // A single token repeated ("la la la la ...") is a music hallucination, not speech.
  return !(words.length >= 4 && distinct.size <= 2);
}

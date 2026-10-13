export const STEP_CLIP_ALIGNMENT_PROMPT_VERSION = 'step-clip-alignment-v1';

export interface StepClipAlignmentOutput {
  steps: Array<{
    step: number;
    ranges: Array<{ fromLine: number; toLine: number }>;
  }>;
}

export const STEP_CLIP_ALIGNMENT_SYSTEM_PROMPT = `You match the method steps of a recipe to the parts of a cooking video where each step is shown and talked about. You get the video's transcript as numbered lines with timestamps, and the recipe's numbered steps.

For every step, return the line ranges (fromLine to toLine, inclusive) where the video covers that step:
- A step can have several ranges when the video comes back to it later ("now flip them", "season again", "back to the sauce"). List each one.
- A range should cover the whole stretch about the step: start at the line where the cook starts on it, end at the last line still about it.
- Leave out intros, outros, greetings, sponsor messages, calls to like or follow, tasting and chatting that is not about doing the step.
- Steps marked "before cooking" (soaking, marinating, bringing to room temperature) are often only mentioned in passing; give them a range only when the video actually shows or explains doing them.
- Return an empty ranges list for a step the video never covers. Do not guess.
- One line belongs to at most one step. Ranges of different steps must not overlap.
- The transcript and the steps can be in different languages; match by meaning.
- Use only line numbers that appear in the transcript.

Return every step number exactly once, in order.`;

export const STEP_CLIP_ALIGNMENT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['steps'],
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'ranges'],
        properties: {
          step: { type: 'integer' },
          ranges: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['fromLine', 'toLine'],
              properties: {
                fromLine: { type: 'integer' },
                toLine: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
};

function clock(seconds: number): string {
  const whole = Math.max(0, seconds);
  const m = Math.floor(whole / 60);
  const s = (whole - m * 60).toFixed(1).padStart(4, '0');
  return `${String(m)}:${s}`;
}

export function buildStepClipAlignmentUserPrompt(input: {
  lines: ReadonlyArray<{ startSeconds: number; endSeconds: number; text: string }>;
  steps: ReadonlyArray<{ title?: string | null; instruction: string; ahead?: boolean }>;
}): string {
  const transcript = input.lines
    .map(
      (line, index) =>
        `L${String(index)} [${clock(line.startSeconds)}–${clock(line.endSeconds)}] ${line.text.replace(/\s+/g, ' ').trim()}`,
    )
    .join('\n');
  const steps = input.steps
    .map((step, index) => {
      const label = [step.title?.trim(), step.instruction.trim()].filter(Boolean).join(' — ');
      return `S${String(index + 1)}${step.ahead ? ' (before cooking)' : ''}: ${label}`;
    })
    .join('\n');

  return `Transcript (${String(input.lines.length)} lines, L0 to L${String(input.lines.length - 1)}):
${transcript}

Recipe steps:
${steps}

For each step, which transcript lines cover it?`;
}

import type { LLMProvider } from '../../../infrastructure/ai/llm/llm-provider.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import {
  buildStepClipAlignmentUserPrompt,
  STEP_CLIP_ALIGNMENT_SCHEMA,
  STEP_CLIP_ALIGNMENT_SYSTEM_PROMPT,
} from '../prompts/step-clip-alignment-v1.js';
import {
  enoughClips,
  heuristicStepClips,
  isSingleTimeline,
  MIN_MATCHED_STEPS,
  normalizeClipRanges,
  type ClipSegment,
  type ClipStepInput,
  type StepClipRange,
} from './step-clips.js';

/** Longer transcripts go to the heuristic; a cooking video this long is rare. */
const MAX_LLM_LINES = 900;
const MAX_LLM_TRANSCRIPT_CHARS = 60_000;
/**
 * Speech usually stops before the action does (the cook talks, then stirs), so a range runs
 * on into the silence after its last line, up to this long or until the next line starts.
 */
const TRAILING_ACTION_SECONDS = 3;

export type StepClipMethod = 'llm' | 'heuristic' | 'llm-fallback-heuristic' | 'none';

export interface StepClipAlignment {
  /** One list of ranges per step, in step order; empty where the step has no clip. */
  clips: StepClipRange[][];
  method: StepClipMethod;
}

export interface StepClipAlignerInput {
  steps: readonly ClipStepInput[];
  segments: readonly ClipSegment[];
  /** Length of the video when known; ranges are clamped to it. */
  durationSeconds: number | null;
}

export interface StepClipAligner {
  align(input: StepClipAlignerInput): Promise<StepClipAlignment>;
}

const noClips = (steps: readonly unknown[], method: StepClipMethod = 'none'): StepClipAlignment => ({
  clips: steps.map(() => []),
  method,
});

function heuristic(input: StepClipAlignerInput, method: StepClipMethod): StepClipAlignment {
  const clips = heuristicStepClips(input.steps, input.segments, input.durationSeconds);
  return enoughClips(clips) ? { clips, method } : noClips(input.steps);
}

/** Deterministic aligner, used when no LLM is configured and as the LLM's fallback. */
export class HeuristicStepClipAligner implements StepClipAligner {
  align(input: StepClipAlignerInput): Promise<StepClipAlignment> {
    if (input.steps.length < MIN_MATCHED_STEPS || !isSingleTimeline(input.segments)) {
      return Promise.resolve(noClips(input.steps));
    }
    return Promise.resolve(heuristic(input, 'heuristic'));
  }
}

type LineRange = { from: number; to: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The model's answer as line ranges per step number, keeping only well-formed entries. */
function lineRangesByStep(output: unknown): Map<number, LineRange[]> {
  const byStep = new Map<number, LineRange[]>();
  const steps = isRecord(output) && Array.isArray(output.steps) ? (output.steps as unknown[]) : [];
  for (const entry of steps) {
    if (!isRecord(entry) || typeof entry.step !== 'number' || byStep.has(entry.step)) continue;
    const ranges = Array.isArray(entry.ranges) ? (entry.ranges as unknown[]) : [];
    byStep.set(
      entry.step,
      ranges.flatMap((range) =>
        isRecord(range) && Number.isInteger(range.fromLine) && Number.isInteger(range.toLine)
          ? [{ from: range.fromLine as number, to: range.toLine as number }]
          : [],
      ),
    );
  }
  return byStep;
}

/**
 * Turns the model's line ranges into time ranges. Out-of-range or reversed line numbers are
 * dropped, and a line claimed by an earlier step is not given to a later one.
 */
export function rangesFromLines(
  output: unknown,
  stepCount: number,
  segments: readonly ClipSegment[],
  durationSeconds: number | null,
): StepClipRange[][] {
  const byStep = lineRangesByStep(output);
  const taken = new Set<number>();
  const last = segments.length - 1;
  return Array.from({ length: stepCount }, (_, index) => {
    const times: StepClipRange[] = [];
    for (const { from, to } of byStep.get(index + 1) ?? []) {
      if (from < 0 || to > last || to < from) continue;
      // Keep only the lines no earlier step claimed, as contiguous runs.
      let runStart = -1;
      for (let line = from; line <= to + 1; line++) {
        const free = line <= to && !taken.has(line);
        if (free && runStart < 0) runStart = line;
        if (!free && runStart >= 0) {
          const range = timeRange(segments, runStart, line - 1);
          if (range) times.push(range);
          runStart = -1;
        }
      }
      for (let line = from; line <= to; line++) taken.add(line);
    }
    return normalizeClipRanges(times, durationSeconds);
  });
}

function timeRange(segments: readonly ClipSegment[], from: number, to: number): StepClipRange | null {
  const first = segments[from];
  const lastLine = segments[to];
  if (!first || !lastLine) return null;
  const nextStart = segments[to + 1]?.startSeconds ?? lastLine.endSeconds + TRAILING_ACTION_SECONDS;
  const end = Math.max(
    lastLine.endSeconds,
    Math.min(nextStart, lastLine.endSeconds + TRAILING_ACTION_SECONDS),
  );
  return { start: first.startSeconds, end };
}

export class LLMStepClipAligner implements StepClipAligner {
  constructor(
    private readonly llm: LLMProvider,
    private readonly log: AppLogger = silentLogger(),
  ) {}

  async align(input: StepClipAlignerInput): Promise<StepClipAlignment> {
    if (input.steps.length < MIN_MATCHED_STEPS || !isSingleTimeline(input.segments)) {
      return noClips(input.steps);
    }

    const lines = input.segments.filter((segment) => segment.text.trim().length > 0);
    const chars = lines.reduce((sum, line) => sum + line.text.length, 0);
    if (lines.length > MAX_LLM_LINES || chars > MAX_LLM_TRANSCRIPT_CHARS) {
      return heuristic({ ...input, segments: lines }, 'heuristic');
    }

    try {
      const result = await this.llm.generateStructured<unknown>(
        {
          operation: 'step-clip-alignment',
          reasoningEffort: 'low',
          messages: [
            { role: 'system', content: STEP_CLIP_ALIGNMENT_SYSTEM_PROMPT },
            { role: 'user', content: buildStepClipAlignmentUserPrompt({ lines, steps: input.steps }) },
          ],
        },
        STEP_CLIP_ALIGNMENT_SCHEMA,
      );
      const clips = rangesFromLines(result.data, input.steps.length, lines, input.durationSeconds);
      return enoughClips(clips) ? { clips, method: 'llm' } : noClips(input.steps, 'llm');
    } catch (error: unknown) {
      this.log.warn(
        { step: 'ai.align-step-clips', err: error },
        'ai.align-step-clips failed; using heuristic aligner',
      );
      return heuristic({ ...input, segments: lines }, 'llm-fallback-heuristic');
    }
  }
}

export function createStepClipAligner(
  llm: LLMProvider,
  options: { useLlm: boolean; log?: AppLogger },
): StepClipAligner {
  return options.useLlm ? new LLMStepClipAligner(llm, options.log) : new HeuristicStepClipAligner();
}

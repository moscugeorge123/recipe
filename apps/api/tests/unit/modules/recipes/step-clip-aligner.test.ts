import { describe, expect, it, vi } from 'vitest';

import type { LLMInput, LLMProvider } from '../../../../src/infrastructure/ai/llm/llm-provider.js';
import {
  HeuristicStepClipAligner,
  LLMStepClipAligner,
  rangesFromLines,
} from '../../../../src/modules/recipes/application/step-clip-aligner.js';
import type { ClipSegment } from '../../../../src/modules/recipes/application/step-clips.js';
import type { StepClipAlignmentOutput } from '../../../../src/modules/recipes/prompts/step-clip-alignment-v1.js';

function seg(startSeconds: number, endSeconds: number, text: string): ClipSegment {
  return { startSeconds, endSeconds, text };
}

// L0..L7
const TRANSCRIPT: ClipSegment[] = [
  seg(0, 3, 'Hi guys, welcome back'),
  seg(4, 8, 'First slice the mushrooms nice and thin'),
  seg(8, 12, 'and chop a couple of garlic cloves'),
  seg(13, 18, 'Into a hot pan with butter, fry the mushrooms'),
  seg(25, 29, 'Meanwhile boil the pasta in salted water'),
  seg(30, 34, 'Back to the mushrooms, flip them so they brown evenly'),
  seg(35, 39, 'Drain the pasta and toss everything together'),
  seg(40, 43, 'Follow me for more recipes'),
];

const STEPS = [
  { title: 'Slice', instruction: 'Slice the mushrooms and chop the garlic.' },
  { title: 'Fry', instruction: 'Fry the mushrooms in butter until golden, turning once.' },
  { title: 'Boil', instruction: 'Boil the pasta in salted water.' },
  { title: 'Toss', instruction: 'Drain the pasta and toss with the mushrooms.' },
];

const MODEL_ANSWER: StepClipAlignmentOutput = {
  steps: [
    { step: 1, ranges: [{ fromLine: 1, toLine: 2 }] },
    {
      step: 2,
      ranges: [
        { fromLine: 3, toLine: 3 },
        { fromLine: 5, toLine: 5 },
      ],
    },
    { step: 3, ranges: [{ fromLine: 4, toLine: 4 }] },
    { step: 4, ranges: [{ fromLine: 6, toLine: 6 }] },
  ],
};

function fakeLlm(answer: () => unknown): LLMProvider & { calls: LLMInput[] } {
  const calls: LLMInput[] = [];
  return {
    calls,
    generateStructured: vi.fn((input: LLMInput) => {
      calls.push(input);
      return Promise.resolve({
        data: answer() as never,
        model: 'test',
        usage: { inputTokens: 1, outputTokens: 1 },
        durationMs: 1,
      });
    }),
  };
}

describe('rangesFromLines', () => {
  it('turns line ranges into time ranges, with several ranges per step', () => {
    expect(rangesFromLines(MODEL_ANSWER, 4, TRANSCRIPT, 45)).toEqual([
      // Runs into the silence after the last line, up to the next line.
      [{ start: 4, end: 13 }],
      [
        // Ends 3 s after speech when the next line is further away.
        { start: 13, end: 21 },
        { start: 30, end: 35 },
      ],
      [{ start: 25, end: 30 }],
      [{ start: 35, end: 40 }],
    ]);
  });

  it('drops invalid line numbers and lines another step already took', () => {
    const answer: StepClipAlignmentOutput = {
      steps: [
        { step: 1, ranges: [{ fromLine: 1, toLine: 3 }] },
        {
          step: 2,
          ranges: [
            { fromLine: 3, toLine: 5 },
            { fromLine: 9, toLine: 12 },
            { fromLine: 6, toLine: 4 },
          ],
        },
        { step: 7, ranges: [{ fromLine: 0, toLine: 0 }] },
      ],
    };
    expect(rangesFromLines(answer, 2, TRANSCRIPT, null)).toEqual([
      [{ start: 4, end: 21 }],
      [{ start: 25, end: 35 }],
    ]);
  });
});

describe('LLMStepClipAligner', () => {
  it('sends numbered, timed lines and numbered steps', async () => {
    const llm = fakeLlm(() => MODEL_ANSWER);
    const result = await new LLMStepClipAligner(llm).align({
      steps: STEPS,
      segments: TRANSCRIPT,
      durationSeconds: 45,
    });

    expect(result.method).toBe('llm');
    expect(result.clips[1]).toHaveLength(2);
    const prompt = llm.calls[0]!.messages[1]!.content;
    expect(prompt).toContain('L1 [0:04.0–0:08.0] First slice the mushrooms nice and thin');
    expect(prompt).toContain('S2: Fry — Fry the mushrooms in butter until golden, turning once.');
    expect(llm.calls[0]!.operation).toBe('step-clip-alignment');
  });

  it('gives no clips when the model places fewer than two steps', async () => {
    const llm = fakeLlm(() => ({
      steps: [{ step: 1, ranges: [{ fromLine: 1, toLine: 2 }] }],
    }));
    const result = await new LLMStepClipAligner(llm).align({
      steps: STEPS,
      segments: TRANSCRIPT,
      durationSeconds: 45,
    });
    expect(result.clips).toEqual([[], [], [], []]);
  });

  it('falls back to the heuristic when the model call fails', async () => {
    const llm: LLMProvider = {
      generateStructured: vi.fn(() => Promise.reject(new Error('timeout'))),
    };
    const result = await new LLMStepClipAligner(llm).align({
      steps: STEPS,
      segments: TRANSCRIPT,
      durationSeconds: 45,
    });
    expect(result.method).toBe('llm-fallback-heuristic');
    expect(result.clips.filter((ranges) => ranges.length > 0).length).toBeGreaterThanOrEqual(2);
  });

  it('skips the model for merged carousel timelines', async () => {
    const llm = fakeLlm(() => MODEL_ANSWER);
    const result = await new LLMStepClipAligner(llm).align({
      steps: STEPS,
      segments: [seg(10, 12, 'slice the mushrooms'), seg(2, 4, 'fry the mushrooms')],
      durationSeconds: null,
    });
    expect(result).toEqual({ clips: [[], [], [], []], method: 'none' });
    expect(llm.calls).toHaveLength(0);
  });
});

describe('HeuristicStepClipAligner', () => {
  it('places one range per matched step', async () => {
    const result = await new HeuristicStepClipAligner().align({
      steps: STEPS,
      segments: TRANSCRIPT,
      durationSeconds: 45,
    });
    expect(result.method).toBe('heuristic');
    expect(result.clips.every((ranges) => ranges.length <= 1)).toBe(true);
  });
});

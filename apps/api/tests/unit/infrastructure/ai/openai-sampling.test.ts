import { describe, expect, it } from 'vitest';

import { chatSampling } from '../../../../src/infrastructure/ai/llm/openai-provider.js';

describe('chatSampling', () => {
  it('maps none to minimal for gpt-5-nano', () => {
    expect(chatSampling('gpt-5-nano', { reasoningEffort: 'none' })).toEqual({
      reasoning_effort: 'minimal',
    });
  });

  it('keeps an explicit gpt-5 effort', () => {
    expect(chatSampling('gpt-5-nano', { reasoningEffort: 'low' })).toEqual({
      reasoning_effort: 'low',
    });
  });

  it('treats gpt-6-luna as a reasoning model: effort when given, never a temperature', () => {
    expect(chatSampling('gpt-6-luna', { reasoningEffort: 'none' })).toEqual({
      reasoning_effort: 'minimal',
    });
    expect(chatSampling('gpt-6-luna', { reasoningEffort: 'high' })).toEqual({
      reasoning_effort: 'high',
    });
    expect(chatSampling('gpt-6-luna', { temperature: 0.2 })).toEqual({});
  });

  it('omits reasoning_effort for models that reject it', () => {
    expect(chatSampling('gpt-4.1-nano', { reasoningEffort: 'none' })).toEqual({
      temperature: 0.2,
    });
    expect(chatSampling('gpt-4o-mini', { reasoningEffort: 'none', temperature: 0 })).toEqual({
      temperature: 0,
    });
  });
});

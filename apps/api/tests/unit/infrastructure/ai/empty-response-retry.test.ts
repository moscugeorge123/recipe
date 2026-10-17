import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../src/config/env.js';
import { retryOnEmptyResponse } from '../../../../src/infrastructure/ai/llm/chat-client.js';
import { OpenAIProvider } from '../../../../src/infrastructure/ai/llm/openai-provider.js';

type Completion = OpenAI.Chat.Completions.ChatCompletion;

const completion = (content: string | null, completionTokens = 5): Completion =>
  ({
    id: 'c',
    object: 'chat.completion',
    created: 0,
    model: 'm',
    choices: [
      {
        index: 0,
        finish_reason: content === null ? 'length' : 'stop',
        logprobs: null,
        message: { role: 'assistant', content, refusal: null },
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: completionTokens,
      total_tokens: 10 + completionTokens,
    },
  }) as Completion;

const script = (...replies: Completion[]) => {
  const call = vi.fn<() => Promise<Completion>>();
  for (const reply of replies) call.mockResolvedValueOnce(reply);
  return call;
};

describe('retryOnEmptyResponse', () => {
  it('returns a non-empty first reply without retrying', async () => {
    const call = script(completion('{"a":1}'));
    const onEmpty = vi.fn();

    const response = await retryOnEmptyResponse(call, onEmpty);

    expect(call).toHaveBeenCalledTimes(1);
    expect(onEmpty).not.toHaveBeenCalled();
    expect(response.choices[0]?.message.content).toBe('{"a":1}');
  });

  it('retries up to 2 more times and sums token usage over every attempt', async () => {
    const call = script(completion(null), completion('   '), completion('{"a":1}'));
    const onEmpty = vi.fn();

    const response = await retryOnEmptyResponse(call, onEmpty);

    expect(call).toHaveBeenCalledTimes(3);
    expect(onEmpty.mock.calls.map(([info]) => [info.attempt, info.retriesLeft])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(response.choices[0]?.message.content).toBe('{"a":1}');
    expect(response.usage).toEqual({ prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 });
  });

  it('gives up after 3 attempts and returns the empty reply', async () => {
    const call = script(completion(null), completion(null), completion(null), completion('late'));
    const onEmpty = vi.fn();

    const response = await retryOnEmptyResponse(call, onEmpty);

    expect(call).toHaveBeenCalledTimes(3);
    expect(onEmpty.mock.calls.at(-1)?.[0].retriesLeft).toBe(0);
    expect(response.choices[0]?.message.content).toBeNull();
  });

  it('does not retry a thrown error', async () => {
    const call = vi.fn<() => Promise<Completion>>().mockRejectedValue(new Error('boom'));

    await expect(retryOnEmptyResponse(call, vi.fn())).rejects.toThrow('boom');
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('OpenAIProvider empty responses', () => {
  const config = loadConfig({ NODE_ENV: 'test', LOG_DIR: '', OPENAI_API_KEY: 'sk-test' });
  const input = { messages: [{ role: 'user' as const, content: 'hi' }] };

  const providerWith = (create: ReturnType<typeof script>) => {
    const provider = new OpenAIProvider(config, null);
    (provider as unknown as { client: unknown }).client = { chat: { completions: { create } } };
    return provider;
  };

  it('recovers when a retry returns content', async () => {
    const create = script(completion(null), completion(null), completion('{"ok":true}'));

    const result = await providerWith(create).generateStructured<{ ok: boolean }>(input, {});

    expect(create).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual({ ok: true });
    expect(result.usage.outputTokens).toBe(15);
  });

  it('throws after 3 empty replies', async () => {
    const create = script(completion(null), completion(null), completion(null));

    await expect(providerWith(create).generateStructured(input, {})).rejects.toThrow(
      'OpenAI returned empty response',
    );
    expect(create).toHaveBeenCalledTimes(3);
  });
});

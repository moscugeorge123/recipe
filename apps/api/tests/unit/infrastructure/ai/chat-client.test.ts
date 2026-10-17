import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../../src/config/env.js';
import {
  createChatClient,
  outputTokenLimit,
  structuredRequest,
} from '../../../../src/infrastructure/ai/llm/chat-client.js';

const load = (env: NodeJS.ProcessEnv) =>
  loadConfig({ FIREBASE_PROJECT_ID: 'test-project', ...env });

const schema = { type: 'object', properties: { a: { type: 'string' } } };
const messages = [
  { role: 'system' as const, content: 'Be brief.' },
  { role: 'user' as const, content: 'hi' },
];

describe('outputTokenLimit', () => {
  it('uses max_completion_tokens for OpenAI, which rejects max_tokens', () => {
    expect(outputTokenLimit(load({}), 1024)).toEqual({ max_completion_tokens: 1024 });
  });

  it('uses max_tokens for DeepSeek', () => {
    expect(outputTokenLimit(load({ AI_PROVIDER: 'deepseek' }), 1024)).toEqual({
      max_tokens: 1024,
    });
  });
});

describe('structuredRequest', () => {
  it('uses strict json_schema for OpenAI and leaves the messages alone', () => {
    const request = structuredRequest(load({}), 'out', schema, messages);

    expect(request.messages).toEqual(messages);
    expect(request.params).toEqual({
      response_format: { type: 'json_schema', json_schema: { name: 'out', strict: true, schema } },
    });
  });

  it('uses json_object with the schema in the system prompt for DeepSeek', () => {
    const request = structuredRequest(load({ AI_PROVIDER: 'deepseek' }), 'out', schema, messages);

    expect(request.params).toEqual({
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
    expect(request.messages[0]?.content).toContain('Be brief.');
    expect(request.messages[0]?.content).toContain('JSON');
    expect(request.messages[0]?.content).toContain(JSON.stringify(schema));
    expect(request.messages[1]).toEqual(messages[1]);
  });

  it('adds a system message when the caller sent none, and honours DEEPSEEK_THINKING', () => {
    const request = structuredRequest(
      load({ AI_PROVIDER: 'deepseek', DEEPSEEK_THINKING: 'true' }),
      'out',
      schema,
      [{ role: 'user', content: 'hi' }],
    );

    expect(request.messages).toHaveLength(2);
    expect(request.messages[0]?.role).toBe('system');
    expect(request.params.thinking).toEqual({ type: 'enabled' });
  });
});

describe('createChatClient', () => {
  it('points DeepSeek at its own base URL', () => {
    const client = createChatClient(
      load({ AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'ds-test' }),
      'test',
    );

    expect(client.baseURL).toBe('https://api.deepseek.com');
  });

  it('names the key that is missing for the selected provider', () => {
    expect(() => createChatClient(load({ AI_PROVIDER: 'deepseek' }), 'X')).toThrow(
      'DEEPSEEK_API_KEY is required for X',
    );
    expect(() => createChatClient(load({}), 'X')).toThrow('OPENAI_API_KEY is required for X');
  });
});

import OpenAI from 'openai';

import type { AppConfig } from '../../../config/env.js';
import type { LLMMessage } from './llm-provider.js';

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

interface StructuredParams {
  response_format: NonNullable<ChatParams['response_format']>;
  /** DeepSeek-only request field; the OpenAI SDK passes unknown body fields through. */
  thinking?: { type: 'enabled' | 'disabled' };
}

/** Env var that holds the key for the selected provider, for error messages. */
export function llmKeyName(config: AppConfig): string {
  return config.ai.provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY';
}

/** Chat client for the selected provider. DeepSeek speaks the OpenAI protocol at another base URL. */
export function createChatClient(config: AppConfig, consumer: string): OpenAI {
  if (!config.ai.llmApiKey) {
    throw new Error(`${llmKeyName(config)} is required for ${consumer}`);
  }
  return new OpenAI({
    apiKey: config.ai.llmApiKey,
    maxRetries: config.ai.maxRetries,
    ...(config.ai.llmBaseUrl ? { baseURL: config.ai.llmBaseUrl } : {}),
  });
}

/**
 * Output cap field for the selected provider. Current OpenAI models reject `max_tokens` and want
 * `max_completion_tokens` (which also covers reasoning tokens); DeepSeek only knows `max_tokens`.
 */
export function outputTokenLimit(
  config: AppConfig,
  tokens: number,
): { max_tokens: number } | { max_completion_tokens: number } {
  return config.ai.provider === 'deepseek'
    ? { max_tokens: tokens }
    : { max_completion_tokens: tokens };
}

type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

/** How many times an empty reply is re-requested, on top of the first attempt. */
export const EMPTY_RESPONSE_RETRIES = 2;

export function hasContent(response: ChatCompletion): boolean {
  return Boolean(response.choices[0]?.message.content?.trim());
}

/**
 * Runs `call` and re-runs it when the model answers with no content, up to
 * EMPTY_RESPONSE_RETRIES more times. Thrown errors are not retried here: the SDK already retries
 * 429 / 5xx / timeouts (`maxRetries`). The returned response is the last attempt, with token usage
 * summed over every attempt so empty replies still show up in cost tracking. `onEmpty` runs after
 * each empty attempt, with `retriesLeft` 0 when the last one came back empty too.
 */
export async function retryOnEmptyResponse(
  call: () => Promise<ChatCompletion>,
  onEmpty: (info: { attempt: number; retriesLeft: number; response: ChatCompletion }) => void,
): Promise<ChatCompletion> {
  let promptTokens = 0;
  let completionTokens = 0;
  let sawUsage = false;
  const withTotalUsage = (response: ChatCompletion): ChatCompletion =>
    sawUsage
      ? {
          ...response,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
        }
      : response;

  for (let attempt = 1; ; attempt += 1) {
    const response = await call();
    if (response.usage) {
      sawUsage = true;
      promptTokens += response.usage.prompt_tokens;
      completionTokens += response.usage.completion_tokens;
    }
    if (hasContent(response)) {
      return withTotalUsage(response);
    }

    const retriesLeft = EMPTY_RESPONSE_RETRIES + 1 - attempt;
    onEmpty({ attempt, retriesLeft, response });
    if (retriesLeft <= 0) {
      return withTotalUsage(response);
    }
  }
}

/**
 * Request fields that make the model answer with JSON matching `schema`.
 *
 * OpenAI enforces the schema (`json_schema`, strict). DeepSeek only offers `json_object`, which
 * guarantees valid JSON but not its shape, so the schema is added to the system prompt instead.
 * DeepSeek also thinks by default, which is slow and ignores `temperature`, so thinking is
 * switched off unless DEEPSEEK_THINKING is set. Spread `params` into the request body.
 */
export function structuredRequest(
  config: AppConfig,
  name: string,
  schema: Record<string, unknown>,
  messages: LLMMessage[],
): { messages: LLMMessage[]; params: StructuredParams } {
  if (config.ai.provider !== 'deepseek') {
    return {
      messages,
      params: {
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      },
    };
  }

  const instruction = [
    'Respond with a single JSON object and nothing else: no prose, no code fences.',
    `It must conform to this JSON Schema: ${JSON.stringify(schema)}`,
  ].join('\n');
  const firstSystem = messages.findIndex((message) => message.role === 'system');
  const withSchema: LLMMessage[] =
    firstSystem === -1
      ? [{ role: 'system', content: instruction }, ...messages]
      : messages.map((message, index) =>
          index === firstSystem
            ? { ...message, content: `${message.content}\n\n${instruction}` }
            : message,
        );

  return {
    messages: withSchema,
    params: {
      response_format: { type: 'json_object' },
      thinking: { type: config.ai.deepseekThinking ? 'enabled' : 'disabled' },
    },
  };
}

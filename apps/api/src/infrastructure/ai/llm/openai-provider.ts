import OpenAI from 'openai';

import type { AppConfig } from '../../../config/env.js';
import { silentLogger, type AppLogger } from '../../logging/logger.js';
import type { AIUsageTracker } from '../usage/ai-usage-tracker.js';
import {
  createChatClient,
  outputTokenLimit,
  retryOnEmptyResponse,
  structuredRequest,
} from './chat-client.js';
import type { LLMInput, LLMProvider, LLMResult, ReasoningEffort } from './llm-provider.js';

const RESPONSE_SNIPPET_CHARS = 500;

/**
 * Chat-completions LLM provider. Serves OpenAI, or any OpenAI-compatible vendor (DeepSeek) when
 * `config.ai.provider` selects one.
 */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(
    private readonly config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
    private readonly log: AppLogger = silentLogger(),
  ) {
    this.client = createChatClient(config, 'OpenAIProvider');
    this.defaultModel = config.ai.defaultModel;
  }

  async generateStructured<T>(
    input: LLMInput,
    schema: Record<string, unknown>,
  ): Promise<LLMResult<T>> {
    const model = input.model ?? this.defaultModel;
    const startedAt = Date.now();
    const fields = {
      step: 'ai.llm',
      operation: input.operation ?? 'structured_generation',
      model,
      promptChars: input.messages.reduce((sum, m) => sum + m.content.length, 0),
      ...ingredientPrompt(input),
    };
    this.log.info(fields, 'ai.llm started');

    const isDeepSeek = this.config.ai.provider === 'deepseek';
    const request = structuredRequest(this.config, 'structured_output', schema, input.messages);

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await retryOnEmptyResponse(
        () =>
          this.client.chat.completions.create({
            model,
            messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
            ...request.params,
            // DeepSeek has no reasoning_effort for the models used here and thinks via `thinking`.
            ...(isDeepSeek
              ? { temperature: input.temperature ?? 0.2 }
              : chatSampling(model, input)),
            ...outputTokenLimit(this.config, input.maxTokens ?? 4096),
          }),
        ({ attempt, retriesLeft, response: empty }) => {
          const choice = empty.choices[0];
          this.log.warn(
            {
              ...fields,
              attempt,
              retriesLeft,
              durationMs: Date.now() - startedAt,
              finishReason: choice?.finish_reason ?? null,
              refusal: choice?.message.refusal ?? null,
              outputTokens: empty.usage?.completion_tokens ?? 0,
            },
            retriesLeft > 0
              ? 'ai.llm returned an empty response; retrying'
              : 'ai.llm returned an empty response; out of retries',
          );
        },
      );
    } catch (error: unknown) {
      this.log.error(
        { ...fields, durationMs: Date.now() - startedAt, ...openAIErrorFields(error), err: error },
        'ai.llm failed',
      );
      throw error;
    }

    const durationMs = Date.now() - startedAt;
    const choice = response.choices[0];
    const content = choice?.message.content;
    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
    const resultFields = {
      ...fields,
      durationMs,
      finishReason: choice?.finish_reason ?? null,
      ...usage,
      responseChars: content?.length ?? 0,
    };

    if (!content?.trim()) {
      this.log.error(
        { ...resultFields, refusal: choice?.message.refusal ?? null },
        'ai.llm failed: empty response',
      );
      throw new Error(`${isDeepSeek ? 'DeepSeek' : 'OpenAI'} returned empty response`);
    }

    if (choice?.finish_reason === 'length') {
      this.log.warn(resultFields, 'ai.llm hit the token limit; output may be truncated');
    }

    if (this.usageTracker && this.jobId) {
      await this.usageTracker.track({
        jobId: this.jobId,
        provider: this.config.ai.provider,
        model,
        operation: 'structured_generation',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        durationMs,
      });
    }

    let data: T;
    try {
      data = JSON.parse(content) as T;
    } catch (error: unknown) {
      this.log.error(
        {
          ...resultFields,
          responseSnippet: content.slice(0, RESPONSE_SNIPPET_CHARS),
          ...ingredientOutput(input, content),
          err: error,
        },
        'ai.llm failed: response is not valid JSON',
      );
      throw error;
    }

    this.log.info(
      { ...resultFields, ...ingredientOutput(input, content) },
      'ai.llm completed',
    );

    return {
      data,
      model,
      usage,
      durationMs,
    };
  }
}

/**
 * gpt-5 and later (gpt-6-luna included) are reasoning models: they accept reasoning_effort, but
 * not `none` (lowest is `minimal`), and reject a custom temperature, so none is sent.
 * gpt-4.1 and gpt-4o reject reasoning_effort, so those calls use temperature.
 */
export function chatSampling(
  model: string,
  input: Pick<LLMInput, 'reasoningEffort' | 'temperature'>,
):
  | { reasoning_effort: Exclude<ReasoningEffort, 'none'> }
  | { temperature: number }
  | Record<string, never> {
  if (/gpt-[5-9]/i.test(model)) {
    if (input.reasoningEffort === undefined) {
      return {};
    }
    return {
      reasoning_effort: input.reasoningEffort === 'none' ? 'minimal' : input.reasoningEffort,
    };
  }
  return { temperature: input.temperature ?? 0.2 };
}

/**
 * Ingredient calls log the raw line and the model text; Ask Tortie (recipe edit mode) logs every
 * message sent and the raw reply. Other operations stay summarized.
 */
function ingredientPrompt(input: LLMInput): Record<string, unknown> {
  if (input.operation === 'recipe_assist') {
    return { input: input.messages };
  }
  if (!input.operation?.startsWith('pantry_organize')) {
    return {};
  }
  return {
    input: input.messages.find((message) => message.role === 'user')?.content ?? '',
  };
}

function ingredientOutput(input: LLMInput, content: string): Record<string, unknown> {
  if (input.operation !== 'recipe_assist' && !input.operation?.startsWith('pantry_organize')) {
    return {};
  }
  return { output: content };
}

/** Status / code / request id from an OpenAI SDK error, for logs. */
export function openAIErrorFields(error: unknown): Record<string, unknown> {
  if (!(error instanceof OpenAI.APIError)) {
    return {};
  }
  return {
    httpStatus: error.status ?? null,
    errorCode: error.code ?? null,
    errorType: error.type ?? null,
    openaiRequestId: error.requestID ?? null,
  };
}

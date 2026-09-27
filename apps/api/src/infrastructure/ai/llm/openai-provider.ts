import OpenAI from 'openai';

import type { AppConfig } from '../../../config/env.js';
import { silentLogger, type AppLogger } from '../../logging/logger.js';
import type { AIUsageTracker } from '../usage/ai-usage-tracker.js';
import type { LLMInput, LLMProvider, LLMResult } from './llm-provider.js';

const RESPONSE_SNIPPET_CHARS = 500;

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(
    config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
    private readonly log: AppLogger = silentLogger(),
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAIProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey, maxRetries: config.ai.maxRetries });
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
    };
    this.log.info(fields, 'ai.llm started');

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.client.chat.completions.create({
        model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema,
          },
        },
        ...(input.reasoningEffort !== undefined
          ? { reasoning_effort: input.reasoningEffort }
          : { temperature: input.temperature ?? 0.2 }),
        ...(input.maxTokens !== undefined
          ? { max_completion_tokens: input.maxTokens }
          : { max_tokens: 4096 }),
      });
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

    if (!content) {
      this.log.error(
        { ...resultFields, refusal: choice?.message.refusal ?? null },
        'ai.llm failed: empty response',
      );
      throw new Error('OpenAI returned empty response');
    }

    if (choice.finish_reason === 'length') {
      this.log.warn(resultFields, 'ai.llm hit the token limit; output may be truncated');
    }

    if (this.usageTracker && this.jobId) {
      await this.usageTracker.track({
        jobId: this.jobId,
        provider: 'openai',
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
        { ...resultFields, responseSnippet: content.slice(0, RESPONSE_SNIPPET_CHARS), err: error },
        'ai.llm failed: response is not valid JSON',
      );
      throw error;
    }

    this.log.info(resultFields, 'ai.llm completed');

    return {
      data,
      model,
      usage,
      durationMs,
    };
  }
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

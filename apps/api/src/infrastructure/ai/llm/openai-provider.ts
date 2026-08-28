import OpenAI from 'openai';

import type { AppConfig } from '../../../config/env.js';
import type { AIUsageTracker } from '../usage/ai-usage-tracker.js';
import type { LLMInput, LLMProvider, LLMResult } from './llm-provider.js';

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(
    config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAIProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey });
    this.defaultModel = config.ai.defaultModel;
  }

  async generateStructured<T>(
    input: LLMInput,
    schema: Record<string, unknown>,
  ): Promise<LLMResult<T>> {
    const model = input.model ?? this.defaultModel;
    const startedAt = Date.now();

    const response = await this.client.chat.completions.create({
      model,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 4096,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          strict: true,
          schema,
        },
      },
    });

    const durationMs = Date.now() - startedAt;
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };

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

    return {
      data: JSON.parse(content) as T,
      model,
      usage,
      durationMs,
    };
  }
}

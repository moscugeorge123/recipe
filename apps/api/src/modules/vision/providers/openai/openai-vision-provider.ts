import type OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.js';
import {
  createChatClient,
  outputTokenLimit,
  retryOnEmptyResponse,
  structuredRequest,
} from '../../../../infrastructure/ai/llm/chat-client.js';
import { openAIErrorFields } from '../../../../infrastructure/ai/llm/openai-provider.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { silentLogger, type AppLogger } from '../../../../infrastructure/logging/logger.js';
import { tracePhotoImport } from '../../../../infrastructure/logging/photo-import-trace.js';
import type {
  ImageInput,
  VisionAnalysis,
  VisionContext,
  VisionProvider,
  VisionObservation,
} from '../../domain/types.js';

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['type', 'description', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['observations'],
  additionalProperties: false,
} as const;

export class OpenAIVisionProvider implements VisionProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
    private readonly log: AppLogger = silentLogger(),
  ) {
    this.client = createChatClient(config, 'OpenAIVisionProvider');
    this.model = config.ai.visionModel;
  }

  async analyzeImages(images: ImageInput[], ctx?: VisionContext): Promise<VisionAnalysis[]> {
    const results: VisionAnalysis[] = [];

    for (const image of images) {
      const startedAt = Date.now();
      const base64 = image.data.toString('base64');
      const prompt =
        ctx?.prompt ?? (image.mediaKind === 'image' ? IMAGE_PROMPT : FRAME_PROMPT);

      const fields = {
        step: 'ai.vision.call',
        model: this.model,
        imageBytes: image.data.byteLength,
        ...originFields(image),
      };

      const request = structuredRequest(this.config, 'vision_analysis', VISION_SCHEMA, [
        { role: 'system', content: prompt },
      ]);

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await retryOnEmptyResponse(
          () =>
            this.client.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: request.messages[0]?.content ?? prompt },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: `data:${image.mimeType};base64,${base64}` },
                    },
                  ],
                },
              ],
              ...request.params,
              ...outputTokenLimit(this.config, 1024),
            }),
          ({ attempt, retriesLeft, response: empty }) => {
            this.log.warn(
              {
                ...fields,
                attempt,
                retriesLeft,
                finishReason: empty.choices[0]?.finish_reason ?? null,
                outputTokens: empty.usage?.completion_tokens ?? 0,
              },
              retriesLeft > 0
                ? 'ai.vision.call returned an empty response; retrying'
                : 'ai.vision.call returned an empty response; out of retries',
            );
          },
        );
      } catch (error: unknown) {
        this.log.error(
          { ...fields, durationMs: Date.now() - startedAt, ...openAIErrorFields(error), err: error },
          'ai.vision.call failed',
        );
        this.tracePhoto('failed', { ...fields, durationMs: Date.now() - startedAt }, error);
        throw error;
      }

      const durationMs = Date.now() - startedAt;
      const choice = response.choices[0];
      const content = choice?.message.content;
      const resultFields = {
        ...fields,
        durationMs,
        finishReason: choice?.finish_reason ?? null,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };
      if (!content?.trim()) {
        this.log.warn(resultFields, 'ai.vision.call returned no content; image skipped');
        this.tracePhoto('completed', { ...resultFields, modelResponse: content ?? null, observations: [] });
        continue;
      }

      let parsed: { observations: VisionObservation[] };
      try {
        parsed = JSON.parse(content) as { observations: VisionObservation[] };
      } catch (error: unknown) {
        this.log.warn(
          { ...resultFields, responseSnippet: content.slice(0, 300) },
          'ai.vision.call returned invalid JSON; image skipped',
        );
        this.tracePhoto('failed', { ...resultFields, modelResponse: content }, error);
        continue;
      }
      this.log.info(
        { ...resultFields, observations: parsed.observations.length },
        'ai.vision.call completed',
      );
      this.tracePhoto('completed', {
        ...resultFields,
        modelResponse: content,
        observations: parsed.observations,
      });

      if (this.usageTracker && this.jobId) {
        await this.usageTracker.track({
          jobId: this.jobId,
          provider: this.config.ai.provider,
          model: this.model,
          operation: 'vision_analysis',
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          durationMs,
        });
      }

      results.push({
        observations: parsed.observations,
        provider: { name: this.config.ai.provider, model: this.model },
        ...originFields(image),
      });
    }

    return results;
  }

  /** Picture imports keep each vision reply. Other sources do not. */
  private tracePhoto(phase: 'completed' | 'failed', data: unknown, error?: unknown): void {
    if (this.log.bindings().sourceType !== 'PHOTO') return;
    tracePhotoImport({
      ...(this.jobId ? { jobId: this.jobId } : {}),
      step: 'ai.vision.call',
      phase,
      data,
      ...(error !== undefined ? { error } : {}),
    });
  }
}

const FRAME_PROMPT =
  'Analyze this cooking video frame. Identify ingredients (with visible amounts), cooking techniques, equipment, doneness cues, and any visible recipe text.';

const IMAGE_PROMPT =
  'Analyze this image from a recipe post (possibly one slide of a carousel). Identify the dish, visible ingredients and amounts, cooking steps shown, and any visible recipe text.';

function originFields(image: ImageInput): Partial<VisionAnalysis> {
  return {
    ...(image.timestampSeconds !== undefined ? { timestampSeconds: image.timestampSeconds } : {}),
    ...(image.mediaKind ? { mediaKind: image.mediaKind } : {}),
    ...(image.slideIndex !== undefined ? { slideIndex: image.slideIndex } : {}),
  };
}

/** Returns empty vision analysis for tests. */
export class MockVisionProvider implements VisionProvider {
  async analyzeImages(images: ImageInput[]): Promise<VisionAnalysis[]> {
    return images.map((image) => ({
      observations: [],
      provider: { name: 'mock', model: 'mock-vision' },
      ...originFields(image),
    }));
  }
}

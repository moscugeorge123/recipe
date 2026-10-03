import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.js';
import { openAIErrorFields } from '../../../../infrastructure/ai/llm/openai-provider.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { silentLogger, type AppLogger } from '../../../../infrastructure/logging/logger.js';
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
    config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
    private readonly log: AppLogger = silentLogger(),
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAIVisionProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey, maxRetries: config.ai.maxRetries });
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

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
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
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'vision_analysis',
              strict: true,
              schema: VISION_SCHEMA,
            },
          },
          max_tokens: 1024,
        });
      } catch (error: unknown) {
        this.log.error(
          { ...fields, durationMs: Date.now() - startedAt, ...openAIErrorFields(error), err: error },
          'ai.vision.call failed',
        );
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
      if (!content) {
        this.log.warn(resultFields, 'ai.vision.call returned no content; image skipped');
        continue;
      }

      let parsed: { observations: VisionObservation[] };
      try {
        parsed = JSON.parse(content) as { observations: VisionObservation[] };
      } catch {
        this.log.warn(
          { ...resultFields, responseSnippet: content.slice(0, 300) },
          'ai.vision.call returned invalid JSON; image skipped',
        );
        continue;
      }
      this.log.info(
        { ...resultFields, observations: parsed.observations.length },
        'ai.vision.call completed',
      );

      if (this.usageTracker && this.jobId) {
        await this.usageTracker.track({
          jobId: this.jobId,
          provider: 'openai',
          model: this.model,
          operation: 'vision_analysis',
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          durationMs,
        });
      }

      results.push({
        observations: parsed.observations,
        provider: { name: 'openai', model: this.model },
        ...originFields(image),
      });
    }

    return results;
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

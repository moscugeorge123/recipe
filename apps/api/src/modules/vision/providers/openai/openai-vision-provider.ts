import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
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
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAIVisionProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey });
    this.model = config.ai.visionModel;
  }

  async analyzeImages(images: ImageInput[], ctx?: VisionContext): Promise<VisionAnalysis[]> {
    const results: VisionAnalysis[] = [];

    for (const image of images) {
      const startedAt = Date.now();
      const base64 = image.data.toString('base64');
      const prompt =
        ctx?.prompt ??
        'Analyze this cooking video frame. Identify ingredients, cooking techniques, and any visible recipe text.';

      const response = await this.client.chat.completions.create({
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

      const durationMs = Date.now() - startedAt;
      const content = response.choices[0]?.message.content;
      if (!content) {
        continue;
      }

      let parsed: { observations: VisionObservation[] };
      try {
        parsed = JSON.parse(content) as { observations: VisionObservation[] };
      } catch {
        continue;
      }

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
        ...(image.timestampSeconds !== undefined
          ? { timestampSeconds: image.timestampSeconds }
          : {}),
      });
    }

    return results;
  }
}

/** Returns empty vision analysis for tests. */
export class MockVisionProvider implements VisionProvider {
  async analyzeImages(images: ImageInput[]): Promise<VisionAnalysis[]> {
    return images.map((image) => ({
      observations: [],
      provider: { name: 'mock', model: 'mock-vision' },
      ...(image.timestampSeconds !== undefined
        ? { timestampSeconds: image.timestampSeconds }
        : {}),
    }));
  }
}

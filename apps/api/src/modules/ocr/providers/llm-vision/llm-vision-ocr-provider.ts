import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import type { ImageInput, OCRProvider, OCRResult } from '../../domain/types.js';

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['text', 'confidence'],
  additionalProperties: false,
} as const;

export class LLMVisionOCRProvider implements OCRProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for LLMVisionOCRProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey });
    this.model = config.ai.visionModel;
  }

  async analyzeImage(image: ImageInput): Promise<OCRResult> {
    const startedAt = Date.now();
    const base64 = image.data.toString('base64');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Extract all visible text from this image. Return the text exactly as shown and a confidence score between 0 and 1. If there is no text, return an empty string and confidence 0.',
        },
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
      temperature: 0.1,
      max_tokens: 1024,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ocr_result',
          strict: true,
          schema: OCR_SCHEMA,
        },
      },
    });

    const durationMs = Date.now() - startedAt;
    if (this.usageTracker && this.jobId) {
      await this.usageTracker.track({
        jobId: this.jobId,
        provider: 'openai',
        model: this.model,
        operation: 'ocr',
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        durationMs,
      });
    }

    const parsed = parseOcrJson(response.choices[0]?.message.content);

    return {
      text: parsed.text,
      confidence: parsed.confidence,
      boundingBoxes: [],
      provider: { name: 'llm-vision', model: this.model },
      ...(image.timestampSeconds !== undefined
        ? { timestampSeconds: image.timestampSeconds }
        : {}),
    };
  }
}

function parseOcrJson(content: string | null | undefined): { text: string; confidence: number } {
  if (!content) {
    return { text: '', confidence: 0 };
  }

  try {
    const parsed = JSON.parse(content) as { text?: unknown; confidence?: unknown };
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch {
    return { text: '', confidence: 0 };
  }
}

/** Returns empty OCR for tests when no text overlay is expected. */
export class MockOCRProvider implements OCRProvider {
  async analyzeImage(image: ImageInput): Promise<OCRResult> {
    return {
      text: '',
      confidence: 0,
      boundingBoxes: [],
      provider: { name: 'mock', model: 'mock-ocr' },
      ...(image.timestampSeconds !== undefined
        ? { timestampSeconds: image.timestampSeconds }
        : {}),
    };
  }
}

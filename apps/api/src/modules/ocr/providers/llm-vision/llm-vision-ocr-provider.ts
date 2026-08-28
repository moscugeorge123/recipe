import type { AppConfig } from '../../../../config/env.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import type { LLMProvider } from '../../../../infrastructure/ai/llm/llm-provider.js';
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
  constructor(
    private readonly llm: LLMProvider,
    private readonly config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
  ) {
    void this.config;
    void this.usageTracker;
    void this.jobId;
  }

  async analyzeImage(image: ImageInput): Promise<OCRResult> {
    const base64 = image.data.toString('base64');
    const result = await this.llm.generateStructured<{ text: string; confidence: number }>(
      {
        messages: [
          {
            role: 'system',
            content:
              'Extract all visible text from this image. Return the text exactly as shown and a confidence score between 0 and 1.',
          },
          {
            role: 'user',
            content: `data:${image.mimeType};base64,${base64}`,
          },
        ],
        model: this.config.ai.visionModel,
      },
      OCR_SCHEMA,
    );

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      boundingBoxes: [],
      provider: { name: 'llm-vision', model: result.model },
      ...(image.timestampSeconds !== undefined
        ? { timestampSeconds: image.timestampSeconds }
        : {}),
    };
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

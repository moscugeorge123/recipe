import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.js';
import { openAIErrorFields } from '../../../../infrastructure/ai/llm/openai-provider.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import { silentLogger, type AppLogger } from '../../../../infrastructure/logging/logger.js';
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
    private readonly log: AppLogger = silentLogger(),
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for LLMVisionOCRProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey, maxRetries: config.ai.maxRetries });
    this.model = config.ai.visionModel;
  }

  async analyzeImage(image: ImageInput): Promise<OCRResult> {
    const startedAt = Date.now();
    const base64 = image.data.toString('base64');
    const fields = {
      step: 'ai.ocr.call',
      model: this.model,
      imageBytes: image.data.byteLength,
      ...originFields(image),
    };

    const response = await this.client.chat.completions
      .create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: OCR_SYSTEM_PROMPT,
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
      max_tokens: 1500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ocr_result',
          strict: true,
          schema: OCR_SCHEMA,
        },
      },
      })
      .catch((error: unknown) => {
        this.log.error(
          { ...fields, durationMs: Date.now() - startedAt, ...openAIErrorFields(error), err: error },
          'ai.ocr.call failed',
        );
        throw error;
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

    const content = response.choices[0]?.message.content;
    const parsed = parseOcrJson(content);
    const resultFields = {
      ...fields,
      durationMs,
      finishReason: response.choices[0]?.finish_reason ?? null,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      textChars: parsed.text.length,
      confidence: parsed.confidence,
    };
    if (content && !parsed.text && parsed.confidence === 0 && !/"text"\s*:\s*""/.test(content)) {
      this.log.warn(
        { ...resultFields, responseSnippet: content.slice(0, 300) },
        'ai.ocr.call returned unparseable content; treated as no text',
      );
    } else {
      this.log.info(resultFields, 'ai.ocr.call completed');
    }

    return {
      text: parsed.text,
      confidence: parsed.confidence,
      boundingBoxes: [],
      provider: { name: 'llm-vision', model: this.model },
      ...originFields(image),
    };
  }
}

const OCR_SYSTEM_PROMPT = [
  'Extract all readable text from this image (a recipe video frame, text overlay, or recipe card/slide).',
  'Return the text exactly as shown, in reading order, preserving line breaks, list bullets, numbers, fractions and units (e.g. "1 ½ cups", "200 g", "350°F").',
  'Omit watermarks, usernames/handles, app UI chrome and like/share counters.',
  'Also return a confidence score between 0 and 1. If there is no readable text, return an empty string and confidence 0.',
].join(' ');

function originFields(image: ImageInput): Partial<OCRResult> {
  return {
    ...(image.timestampSeconds !== undefined ? { timestampSeconds: image.timestampSeconds } : {}),
    ...(image.mediaKind ? { mediaKind: image.mediaKind } : {}),
    ...(image.slideIndex !== undefined ? { slideIndex: image.slideIndex } : {}),
  };
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
      ...originFields(image),
    };
  }
}

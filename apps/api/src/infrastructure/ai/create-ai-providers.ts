import type { AppConfig } from '../../config/env.js';
import { MockLLMProvider } from '../ai/llm/mock-llm-provider.js';
import type { LLMProvider } from '../ai/llm/llm-provider.js';
import { OpenAIProvider } from '../ai/llm/openai-provider.js';
import type { AIUsageTracker } from '../ai/usage/ai-usage-tracker.js';
import { MockOCRProvider } from '../../modules/ocr/providers/llm-vision/llm-vision-ocr-provider.js';
import { LLMVisionOCRProvider } from '../../modules/ocr/providers/llm-vision/llm-vision-ocr-provider.js';
import type { OCRProvider } from '../../modules/ocr/domain/types.js';
import {
  MockTranscriptionProvider,
  OpenAITranscriptionProvider,
} from '../../modules/transcription/providers/openai/openai-transcription-provider.js';
import type { TranscriptionProvider } from '../../modules/transcription/domain/types.js';
import {
  MockVisionProvider,
  OpenAIVisionProvider,
} from '../../modules/vision/providers/openai/openai-vision-provider.js';
import type { VisionProvider } from '../../modules/vision/domain/types.js';

export interface AIProviders {
  llm: LLMProvider;
  transcription: TranscriptionProvider;
  ocr: OCRProvider;
  vision: VisionProvider;
}

export function createAIProviders(
  config: AppConfig,
  usageTracker: AIUsageTracker | null,
  jobId?: string,
): AIProviders {
  if (config.ai.openaiApiKey) {
    const llm = new OpenAIProvider(config, usageTracker, jobId);
    return {
      llm,
      transcription: new OpenAITranscriptionProvider(config, usageTracker, jobId),
      ocr: new LLMVisionOCRProvider(llm, config, usageTracker, jobId),
      vision: new OpenAIVisionProvider(config, usageTracker, jobId),
    };
  }

  const llm = new MockLLMProvider();
  return {
    llm,
    transcription: new MockTranscriptionProvider(),
    ocr: new MockOCRProvider(),
    vision: new MockVisionProvider(),
  };
}

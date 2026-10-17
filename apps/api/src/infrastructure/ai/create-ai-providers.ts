import type { AppConfig } from '../../config/env.js';
import { MockLLMProvider } from '../ai/llm/mock-llm-provider.js';
import { llmKeyName } from '../ai/llm/chat-client.js';
import type { LLMProvider } from '../ai/llm/llm-provider.js';
import { OpenAIProvider } from '../ai/llm/openai-provider.js';
import type { AIUsageTracker } from '../ai/usage/ai-usage-tracker.js';
import { silentLogger, type AppLogger } from '../logging/logger.js';
import { MockOCRProvider } from '../../modules/ocr/providers/llm-vision/llm-vision-ocr-provider.js';
import { LLMVisionOCRProvider } from '../../modules/ocr/providers/llm-vision/llm-vision-ocr-provider.js';
import type { OCRProvider } from '../../modules/ocr/domain/types.js';
import {
  MockTranscriptionProvider,
  NoTranscriptionProvider,
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
  log: AppLogger = silentLogger(),
): AIProviders {
  if (config.ai.llmApiKey) {
    const llm = new OpenAIProvider(config, usageTracker, jobId, log);
    return {
      llm,
      transcription: createTranscriptionProvider(config, usageTracker, jobId, log),
      ocr: new LLMVisionOCRProvider(config, usageTracker, jobId, log),
      vision: new OpenAIVisionProvider(config, usageTracker, jobId, log),
    };
  }

  log.warn(
    { step: 'ai.providers', provider: 'mock' },
    `${llmKeyName(config)} is not set; using mock AI providers (results are placeholders)`,
  );
  const llm = new MockLLMProvider();
  return {
    llm,
    transcription: new MockTranscriptionProvider(),
    ocr: new MockOCRProvider(),
    vision: new MockVisionProvider(),
  };
}

/** Whisper is OpenAI-only, so it needs OPENAI_API_KEY even when another provider serves the LLM. */
function createTranscriptionProvider(
  config: AppConfig,
  usageTracker: AIUsageTracker | null,
  jobId: string | undefined,
  log: AppLogger,
): TranscriptionProvider {
  if (config.ai.openaiApiKey) {
    return new OpenAITranscriptionProvider(config, usageTracker, jobId, log);
  }
  log.warn(
    { step: 'ai.providers', provider: config.ai.provider, transcription: 'none' },
    'OPENAI_API_KEY is not set; spoken audio will not be transcribed (Whisper is OpenAI-only)',
  );
  return new NoTranscriptionProvider();
}

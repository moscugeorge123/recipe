import OpenAI from 'openai';
import { Readable } from 'node:stream';

import type { AppConfig } from '../../../../config/env.js';
import type { AIUsageTracker } from '../../../../infrastructure/ai/usage/ai-usage-tracker.js';
import type {
  AudioInput,
  TranscriptionOptions,
  TranscriptionProvider,
  Transcript,
} from '../../domain/types.js';

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    config: AppConfig,
    private readonly usageTracker: AIUsageTracker | null,
    private readonly jobId?: string,
  ) {
    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAITranscriptionProvider');
    }
    this.client = new OpenAI({ apiKey: config.ai.openaiApiKey });
    this.model = config.ai.whisperModel;
  }

  async transcribe(audio: AudioInput, opts?: TranscriptionOptions): Promise<Transcript> {
    const model = opts?.model ?? this.model;
    const startedAt = Date.now();

    const file = await OpenAI.toFile(audio.data, audio.filename ?? 'audio.mp3', {
      type: audio.mimeType,
    });

    const response = await this.client.audio.transcriptions.create({
      file,
      model,
      ...(opts?.language ? { language: opts.language } : {}),
      response_format: 'verbose_json',
    });

    const durationMs = Date.now() - startedAt;
    const durationMinutes = audio.data.byteLength / (16000 * 2 * 60);

    if (this.usageTracker && this.jobId) {
      await this.usageTracker.track({
        jobId: this.jobId,
        provider: 'openai',
        model,
        operation: 'transcription',
        inputTokens: Math.round(durationMinutes * 1000),
        outputTokens: 0,
        durationMs,
      });
    }

    const segments =
      'segments' in response && Array.isArray(response.segments)
        ? response.segments.map((seg) => ({
            startSeconds: seg.start,
            endSeconds: seg.end,
            text: seg.text,
            confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.8,
          }))
        : [];

    return {
      language: opts?.language ?? 'en',
      fullText: response.text,
      segments,
      provider: { name: 'openai', model },
    };
  }
}

/** Returns deterministic transcript for tests and no-API-key pipeline runs. */
export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_audio: AudioInput, opts?: TranscriptionOptions): Promise<Transcript> {
    void Readable;
    return {
      language: opts?.language ?? 'en',
      fullText: 'Mix the spaghetti with garlic and olive oil. Cook for ten minutes.',
      segments: [
        {
          startSeconds: 0,
          endSeconds: 5,
          text: 'Mix the spaghetti with garlic and olive oil.',
          confidence: 0.9,
        },
        {
          startSeconds: 5,
          endSeconds: 10,
          text: 'Cook for ten minutes.',
          confidence: 0.85,
        },
      ],
      provider: { name: 'mock', model: 'mock-whisper' },
    };
  }
}

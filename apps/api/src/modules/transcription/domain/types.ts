import type { Prisma } from '@prisma/client';

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number;
}

export interface Transcript {
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  provider: Prisma.InputJsonValue;
  /** Speech-to-text on the audio, or captions/subtitles supplied by the platform. */
  source?: 'speech' | 'manual_captions' | 'auto_captions';
}

export interface AudioInput {
  data: Buffer;
  mimeType: string;
  filename?: string;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
}

export interface TranscriptionProvider {
  transcribe(audio: AudioInput, opts?: TranscriptionOptions): Promise<Transcript>;
}

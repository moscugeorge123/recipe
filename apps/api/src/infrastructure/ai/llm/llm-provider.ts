export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMInput {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResult<T> {
  data: T;
  model: string;
  usage: LLMUsage;
  durationMs: number;
}

/** Structured JSON generation from an LLM. */
export interface LLMProvider {
  generateStructured<T>(input: LLMInput, schema: Record<string, unknown>): Promise<LLMResult<T>>;
}

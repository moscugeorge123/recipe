export interface JobOptions {
  extractNutrition: boolean;
  extractImages: boolean;
  highAccuracy: boolean;
}

export function parseJobOptions(raw: unknown): JobOptions {
  const record =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    extractNutrition: record.extractNutrition === true,
    extractImages: record.extractImages !== false,
    highAccuracy: record.highAccuracy === true,
  };
}

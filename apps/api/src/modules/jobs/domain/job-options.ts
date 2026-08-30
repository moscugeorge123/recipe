export interface JobOptions {
  extractNutrition: boolean;
  extractImages: boolean;
  highAccuracy: boolean;
  selectedThumbnailUrl?: string;
}

export function parseJobOptions(raw: unknown): JobOptions {
  const record =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const selectedThumbnailUrl =
    typeof record.selectedThumbnailUrl === 'string' && record.selectedThumbnailUrl.length > 0
      ? record.selectedThumbnailUrl
      : undefined;

  return {
    extractNutrition: record.extractNutrition === true,
    extractImages: record.extractImages !== false,
    highAccuracy: record.highAccuracy === true,
    ...(selectedThumbnailUrl ? { selectedThumbnailUrl } : {}),
  };
}

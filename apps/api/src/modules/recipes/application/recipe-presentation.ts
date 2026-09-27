import { reconcileTemperature } from '../../normalization/domain/measurement-conversion.js';

const SOURCE_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  GENERIC_WEB: 'Website',
};

export function sourceLabelFromType(sourceType: string | undefined): string {
  if (!sourceType) {
    return 'Website';
  }
  return SOURCE_LABELS[sourceType] ?? sourceType;
}

export function difficultyFromMinutes(minutes: number | null): 'Easy' | 'Medium' | 'Hard' | null {
  if (minutes == null) {
    return null;
  }
  if (minutes < 30) {
    return 'Easy';
  }
  if (minutes <= 50) {
    return 'Medium';
  }
  return 'Hard';
}

/** Extracted/user-set difficulty wins; recipes imported before it existed fall back to time. */
export function resolveDifficulty(
  stored: string | null,
  minutes: number | null,
): 'Easy' | 'Medium' | 'Hard' | null {
  if (stored === 'Easy' || stored === 'Medium' || stored === 'Hard') {
    return stored;
  }
  return difficultyFromMinutes(minutes);
}

/** Older recipes only had calories when the source stated them. */
export function nutritionSourceOf(
  stored: string | null,
  calories: number | null,
): 'stated' | 'estimated' | null {
  if (stored === 'stated' || stored === 'estimated') {
    return stored;
  }
  return calories === null ? null : 'stated';
}

/** Stored °C/°F, or parsed from the step text for steps saved before those columns existed. */
export function stepTemperature(step: {
  temperature: string | null;
  instruction: string;
  temperatureCelsius: number | null;
  temperatureFahrenheit: number | null;
}): { temperatureCelsius: number | null; temperatureFahrenheit: number | null } {
  if (step.temperatureCelsius !== null || step.temperatureFahrenheit !== null) {
    const resolved = reconcileTemperature({
      celsius: step.temperatureCelsius,
      fahrenheit: step.temperatureFahrenheit,
    });
    return {
      temperatureCelsius: resolved?.celsius ?? null,
      temperatureFahrenheit: resolved?.fahrenheit ?? null,
    };
  }
  const parsed = reconcileTemperature({ text: step.temperature, instruction: step.instruction });
  return {
    temperatureCelsius: parsed?.celsius ?? null,
    temperatureFahrenheit: parsed?.fahrenheit ?? null,
  };
}

export function minutesFromTimes(
  prep: number | null,
  cook: number | null,
  total: number | null,
): number | null {
  if (total != null) {
    return total;
  }
  const summed = (prep ?? 0) + (cook ?? 0);
  return summed > 0 ? summed : null;
}

export function creatorFromSource(author: string | null, sourceLabel: string): string {
  return author && author.length > 0 ? author : sourceLabel;
}

export function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function stringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function authorFromMetadata(metadata: unknown): string | null {
  return stringField(metadataRecord(metadata), 'author', 'uploader', 'creator');
}

export function thumbnailFromMetadata(metadata: unknown): string | null {
  return stringField(metadataRecord(metadata), 'thumbnailUrl', 'thumbnail');
}

export function ingredientHintForStep(
  instruction: string,
  ingredients: { name: string; quantity: unknown; unit: string | null }[],
): string | null {
  const hintParts = ingredients
    .filter((ing) =>
      instruction.toLowerCase().includes(ing.name.split(',')[0]?.toLowerCase() ?? ''),
    )
    .slice(0, 2)
    .map((ing) => {
      const qty =
        typeof ing.quantity === 'string' || typeof ing.quantity === 'number'
          ? String(ing.quantity)
          : '';
      const unit = ing.unit ? ` ${ing.unit}` : '';
      return `${qty}${unit} ${ing.name}`.trim();
    });

  return hintParts.length > 0 ? hintParts.join('|') : null;
}

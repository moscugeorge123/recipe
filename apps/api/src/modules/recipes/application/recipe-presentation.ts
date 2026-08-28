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

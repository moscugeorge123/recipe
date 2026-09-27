export type RevisionSummarySnapshot = {
  source: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty?: string | null;
  calories: number | null;
  cuisine: string | null;
  categories: Array<{ slug: string; name: string }>;
  ingredients: Array<{
    name: string;
    canonicalName: string | null;
    quantity: string | null;
    unit: string | null;
    preparation: string | null;
    optional: boolean;
    emoji: string | null;
    colorToken: string | null;
    category: string;
    sortOrder: number;
  }>;
  steps: Array<{
    stepOrder: number;
    instruction: string;
    durationMinutes: number | null;
    temperature: string | null;
    stage: string;
  }>;
};

function countMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function sameMultiset(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = countMap(left);
  for (const value of right) {
    const remaining = counts.get(value);
    if (!remaining) return false;
    counts.set(value, remaining - 1);
  }
  return true;
}

function addedAndRemoved(
  current: string[],
  previous: string[],
): { added: number; removed: number } {
  const prevCounts = countMap(previous);
  const currCounts = countMap(current);
  let added = 0;
  let removed = 0;
  for (const [signature, count] of currCounts) {
    const previousCount = prevCounts.get(signature) ?? 0;
    if (count > previousCount) added += count - previousCount;
  }
  for (const [signature, count] of prevCounts) {
    const currentCount = currCounts.get(signature) ?? 0;
    if (count > currentCount) removed += count - currentCount;
  }
  return { added, removed };
}

function ingredientSignature(item: RevisionSummarySnapshot['ingredients'][number]): string {
  return [
    item.name,
    item.canonicalName ?? '',
    item.quantity ?? '',
    item.unit ?? '',
    item.preparation ?? '',
    item.optional ? '1' : '0',
    item.emoji ?? '',
    item.colorToken ?? '',
    item.category,
  ].join('\0');
}

function stepSignature(item: RevisionSummarySnapshot['steps'][number]): string {
  return [item.instruction, item.durationMinutes ?? '', item.temperature ?? '', item.stage].join(
    '\0',
  );
}

function describeCollection(noun: string, current: string[], previous: string[]): string | null {
  if (current.join('\n') === previous.join('\n')) return null;
  if (sameMultiset(current, previous)) return `Reordered ${noun}`;
  const { added, removed } = addedAndRemoved(current, previous);
  if (added === 0 && removed === 0) return `Updated ${noun}`;
  const parts: string[] = [];
  if (added) parts.push(`added ${String(added)}`);
  if (removed) parts.push(`removed ${String(removed)}`);
  const label = `${noun.slice(0, 1).toUpperCase()}${noun.slice(1)}`;
  return `${label}: ${parts.join(', ')}`;
}

function describeScalar(
  label: string,
  current: string | number | null,
  previous: string | number | null,
  unit?: string,
): string | null {
  if (current === previous) return null;
  if (current == null || current === '') return `Cleared ${label}`;
  const formatted = unit ? `${String(current)} ${unit}` : String(current);
  return previous == null || previous === ''
    ? `Set ${label} to ${formatted}`
    : `Changed ${label} to ${formatted}`;
}

export function summarizeRevision(
  revision: RevisionSummarySnapshot,
  previous: RevisionSummarySnapshot | undefined,
): string[] {
  if (!previous) {
    return ['Original imported recipe'];
  }
  if (revision.source === 'RESTORE') {
    return ['Restored an earlier version as a new revision'];
  }

  const changes: string[] = [];
  if (revision.title !== previous.title) {
    changes.push(`Renamed to “${revision.title}”`);
  }
  if (revision.description !== previous.description) {
    changes.push(revision.description ? 'Updated the description' : 'Removed the description');
  }

  const servings = describeScalar('servings', revision.servings, previous.servings);
  if (servings) changes.push(servings);
  const prep = describeScalar(
    'prep time',
    revision.prepTimeMinutes,
    previous.prepTimeMinutes,
    'min',
  );
  if (prep) changes.push(prep);
  const cook = describeScalar(
    'cook time',
    revision.cookTimeMinutes,
    previous.cookTimeMinutes,
    'min',
  );
  if (cook) changes.push(cook);
  const total = describeScalar(
    'total time',
    revision.totalTimeMinutes,
    previous.totalTimeMinutes,
    'min',
  );
  if (total) changes.push(total);
  const difficulty = describeScalar(
    'level',
    revision.difficulty ?? null,
    previous.difficulty ?? null,
  );
  if (difficulty) changes.push(difficulty);
  const calories = describeScalar('calories', revision.calories, previous.calories);
  if (calories) changes.push(calories);
  const cuisine = describeScalar('cuisine', revision.cuisine, previous.cuisine);
  if (cuisine) changes.push(cuisine);

  const previousSlugs = previous.categories.map((item) => item.slug);
  const currentSlugs = revision.categories.map((item) => item.slug);
  if (previousSlugs.join() !== currentSlugs.join()) {
    const previousNames = new Map(previous.categories.map((item) => [item.slug, item.name]));
    const currentNames = new Map(revision.categories.map((item) => [item.slug, item.name]));
    const added = currentSlugs
      .filter((slug) => !previousSlugs.includes(slug))
      .map((slug) => currentNames.get(slug) ?? slug);
    const removed = previousSlugs
      .filter((slug) => !currentSlugs.includes(slug))
      .map((slug) => previousNames.get(slug) ?? slug);
    const parts: string[] = [];
    if (added.length) parts.push(`added ${added.join(', ')}`);
    if (removed.length) parts.push(`removed ${removed.join(', ')}`);
    changes.push(
      parts.length > 0 ? `Updated categories (${parts.join('; ')})` : 'Reordered categories',
    );
  }

  const ingredients = describeCollection(
    'ingredients',
    revision.ingredients.map(ingredientSignature),
    previous.ingredients.map(ingredientSignature),
  );
  if (ingredients) changes.push(ingredients);

  const steps = describeCollection(
    'steps',
    revision.steps.map(stepSignature),
    previous.steps.map(stepSignature),
  );
  if (steps) changes.push(steps);

  return changes.length > 0 ? changes : ['Saved without field changes'];
}

export function toRevisionSummarySnapshot(revision: {
  source: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty?: string | null;
  calories: number | null;
  cuisine: string | null;
  categories: Array<{ slug: string; name: string }>;
  ingredients: Array<{
    name: string;
    canonicalName: string | null;
    quantity: { toString(): string } | string | null;
    unit: string | null;
    preparation: string | null;
    optional: boolean;
    emoji: string | null;
    colorToken: string | null;
    category: string;
    sortOrder: number;
  }>;
  steps: Array<{
    stepOrder: number;
    instruction: string;
    durationMinutes: number | null;
    temperature: string | null;
    stage: string;
  }>;
}): RevisionSummarySnapshot {
  return {
    source: revision.source,
    title: revision.title,
    description: revision.description,
    servings: revision.servings,
    prepTimeMinutes: revision.prepTimeMinutes,
    cookTimeMinutes: revision.cookTimeMinutes,
    totalTimeMinutes: revision.totalTimeMinutes,
    difficulty: revision.difficulty ?? null,
    calories: revision.calories,
    cuisine: revision.cuisine,
    categories: revision.categories.map((item) => ({ slug: item.slug, name: item.name })),
    ingredients: revision.ingredients.map((item) => ({
      name: item.name,
      canonicalName: item.canonicalName,
      quantity: item.quantity == null ? null : item.quantity.toString(),
      unit: item.unit,
      preparation: item.preparation,
      optional: item.optional,
      emoji: item.emoji,
      colorToken: item.colorToken,
      category: item.category,
      sortOrder: item.sortOrder,
    })),
    steps: revision.steps.map((item) => ({
      stepOrder: item.stepOrder,
      instruction: item.instruction,
      durationMinutes: item.durationMinutes,
      temperature: item.temperature,
      stage: item.stage,
    })),
  };
}

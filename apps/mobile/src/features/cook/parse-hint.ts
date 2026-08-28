export type HintChip = {
  qty: string;
  name: string;
};

const UNIT =
  /^(g|kg|ml|l|oz|lb|tsp|tbsp|cup|cups|handful|pinch|clove|cloves)$/i;

export function parseIngredientHint(hint: string | null): HintChip[] {
  if (!hint) {
    return [];
  }

  return hint
    .split('|')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split(/\s+/);
      const first = parts[0];
      if (first && /^\d/.test(first) && parts[1] && UNIT.test(parts[1])) {
        return {
          qty: `${first} ${parts[1]}`,
          name: parts.slice(2).join(' ') || parts[1],
        };
      }
      if (first && /^\d/.test(first) && parts.length > 1) {
        return { qty: first, name: parts.slice(1).join(' ') };
      }
      return { qty: '', name: chunk };
    });
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

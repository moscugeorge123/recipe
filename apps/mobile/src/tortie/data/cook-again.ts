/** Recipes the cook has finished, most cooked first. Never pads with uncooked ones. */
export function cookAgainList<T extends { cooked: number }>(list: readonly T[]): T[] {
  return list
    .filter((recipe) => recipe.cooked > 0)
    .sort((a, b) => b.cooked - a.cooked)
    .slice(0, 4);
}

/**
 * Split ordinary pantry paste into items. Newlines and commas start new items;
 * numeric thousands such as `1,000 g flour` stay together.
 */
export function parsePantryLines(text: string): string[] {
  const items: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const parts = line
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (const part of parts) {
      const previous = items[items.length - 1];
      if (
        previous !== undefined &&
        /^\d+$/.test(previous) &&
        /^\d/.test(part)
      ) {
        items[items.length - 1] = `${previous},${part}`;
      } else {
        items.push(part);
      }
    }
  }

  return items;
}

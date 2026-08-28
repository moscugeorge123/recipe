/** Capitalizes the first character and lowercases the rest: "wholemeal pitta" → "Wholemeal pitta". */
export function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lower = trimmed.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

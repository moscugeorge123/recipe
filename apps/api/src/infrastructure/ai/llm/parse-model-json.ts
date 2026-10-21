/**
 * Parses a model reply that was asked for one JSON object.
 * Accepts a markdown fence, a short preamble, trailing commas, and raw control
 * characters. Still throws when the object itself is malformed.
 */
export function parseModelJson(content: string): unknown {
  const stripped = stripCodeFence(content.trim());
  try {
    return JSON.parse(stripped);
  } catch {
    const cleaned = extractJsonObject(stripped)
      .replace(/[\u0000-\u001F]+/g, ' ')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fenced?.[1]?.trim() ?? text;
}

/** Drops prose before the first object and after the last closing brace. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return text;
  }
  return text.slice(start, end + 1);
}

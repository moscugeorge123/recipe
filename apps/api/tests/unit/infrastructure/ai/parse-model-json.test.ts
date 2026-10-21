import { describe, expect, it } from 'vitest';

import { parseModelJson } from '../../../../src/infrastructure/ai/llm/parse-model-json.js';

describe('parseModelJson', () => {
  it('parses a JSON object', () => {
    expect(parseModelJson('{"title":"Soup"}')).toEqual({ title: 'Soup' });
  });

  it('strips a json code fence', () => {
    expect(parseModelJson('```json\n{"title":"Soup"}\n```')).toEqual({ title: 'Soup' });
  });

  it('ignores a preamble and a trailing comma', () => {
    expect(parseModelJson('Here is the recipe:\n{"title":"Soup",}')).toEqual({ title: 'Soup' });
  });

  it('throws when a property is missing its comma', () => {
    expect(() => parseModelJson('{"title":"Soup" "servings":2}')).toThrow(SyntaxError);
  });
});

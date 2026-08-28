export const RECIPE_VALIDATION_PROMPT_VERSION = 'recipe-validation-v1';

export const RECIPE_VALIDATION_SYSTEM_PROMPT = `You are a recipe validation assistant. Review the extracted recipe for completeness and consistency.

Check for:
- Missing quantities on ingredients
- Steps that reference ingredients not listed
- Conflicting information between ingredients and steps
- Unrealistic serving sizes or cook times

Return warnings only for genuine issues. Do not flag minor formatting differences.`;

export const RECIPE_VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          field: { type: ['string', 'null'] },
        },
        required: ['code', 'message', 'field'],
        additionalProperties: false,
      },
    },
  },
  required: ['warnings'],
  additionalProperties: false,
} as const;

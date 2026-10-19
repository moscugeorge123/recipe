import { describe, expect, it } from 'vitest';

import { displayNameForm } from '../../../../src/modules/normalization/domain/units.js';

describe('displayNameForm', () => {
  it('singularizes a bare noun', () => {
    expect(displayNameForm('Lemons')).toBe('lemon');
  });

  it('keeps a phrase as written', () => {
    expect(displayNameForm('Lemon wedges')).toBe('lemon wedges');
  });
});

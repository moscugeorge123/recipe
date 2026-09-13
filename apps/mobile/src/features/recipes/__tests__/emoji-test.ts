import { isOneEmoji } from '@/features/recipes/emoji';

describe('isOneEmoji', () => {
  it('accepts a single food emoji', () => {
    expect(isOneEmoji('🥣')).toBe(true);
    expect(isOneEmoji('🍝')).toBe(true);
  });

  it('accepts ZWJ and skin-tone sequences as one emoji', () => {
    expect(isOneEmoji('👨‍🍳')).toBe(true);
    expect(isOneEmoji('👍🏽')).toBe(true);
  });

  it('rejects empty, text, and multiple emoji', () => {
    expect(isOneEmoji('')).toBe(false);
    expect(isOneEmoji('a')).toBe(false);
    expect(isOneEmoji('🥣🍝')).toBe(false);
    expect(isOneEmoji('🥣 pasta')).toBe(false);
  });
});

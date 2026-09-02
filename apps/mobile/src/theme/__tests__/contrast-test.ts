import { cookTokensDark } from '@/theme/cook-tokens';
import { colors } from '@/theme/tokens';

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
}

function linear(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = linear(channel(hex, 0));
  const g = linear(channel(hex, 1));
  const b = linear(channel(hex, 2));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

describe('Airbnb contrast pairs', () => {
  test('ink on canvas meets body contrast', () => {
    expect(contrast(colors.espresso, colors.cream)).toBeGreaterThanOrEqual(4.5);
  });

  test('on-dark on cook ink canvas meets body contrast', () => {
    expect(contrast(cookTokensDark.text, cookTokensDark.bg)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  test('white on Rausch meets large-control contrast', () => {
    expect(contrast(colors.onPrimary, colors.paprika)).toBeGreaterThanOrEqual(3);
  });
});

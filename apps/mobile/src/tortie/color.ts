const cache = new Map<string, string>();

function toHex(v: number): string {
  const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return c.toString(16).padStart(2, '0');
}

function gamma(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/** CSS `oklch(L C H)` → sRGB hex (React Native has no oklch support). */
export function oklch(l: number, c: number, h: number): string {
  const key = `${l}|${c}|${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const hex = `#${toHex(gamma(r))}${toHex(gamma(g))}${toHex(gamma(bl))}`;
  cache.set(key, hex);
  return hex;
}

/** Emoji tile tint for a hue. */
export const tint = (h: number) => oklch(0.95, 0.035, h);
/** Photo placeholder stripe pair for a hue. */
export const stripeA = (h: number) => oklch(0.885, 0.045, h);
export const stripeB = (h: number) => oklch(0.855, 0.052, h);
/** Photo placeholder caption colour. */
export const phCaption = (h: number) => oklch(0.42, 0.06, h);

/** Stable hue (0–359) for any string id, used when the API gives no hue. */
export function hueOf(seed: string): number {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  return x % 360;
}

/** `#RRGGBB` + alpha → `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + toHex(alpha);
}

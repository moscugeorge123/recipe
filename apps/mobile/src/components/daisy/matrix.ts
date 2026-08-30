/**
 * react-native-svg only exposes `matrix` as a native prop on groups; the
 * friendlier `rotation` / `originX` / `scale` props are folded into a matrix
 * during JS render, so Reanimated cannot animate them. Everything that moves is
 * therefore expressed as an affine matrix computed on the UI thread.
 *
 * The array is SVG's own `matrix(a b c d e f)` layout:
 *
 *   [ a c tx ]
 *   [ b d ty ]
 */
export type SvgMatrix = number[];

/**
 * Rotates and scales about (originX, originY), then translates by (dx, dy) —
 * the same order CSS applies `transform-origin` in the prototype.
 */
export function affine(
  dx: number,
  dy: number,
  degrees: number,
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number,
): SvgMatrix {
  'worklet';
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const a = cos * scaleX;
  const b = sin * scaleX;
  const c = -sin * scaleY;
  const d = cos * scaleY;

  return [
    a,
    b,
    c,
    d,
    dx + originX - (a * originX + c * originY),
    dy + originY - (b * originX + d * originY),
  ];
}

export function translate(dx: number, dy: number): SvgMatrix {
  'worklet';
  return [1, 0, 0, 1, dx, dy];
}

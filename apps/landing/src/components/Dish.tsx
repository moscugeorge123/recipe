import type { ReactNode } from 'react';

export type DishKind = 'guac' | 'pancakes' | 'soup' | 'salad';

const TABLE: Record<DishKind, [string, string]> = {
  guac: ['#ffdbcf', '#fbc8b6'],
  pancakes: ['#c7ecce', '#accfb1'],
  soup: ['#eef3ea', '#d9e4d4'],
  salad: ['#fff1d6', '#f7ddb0'],
};

/** Top-down illustrated plate, used as recipe "photos" throughout the page. */
export function Dish({ kind, className, spin = true }: { kind: DishKind; className?: string; spin?: boolean }) {
  const [bg, stripe] = TABLE[kind];
  const id = `dish-${kind}`;
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}-cloth`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="22" height="22" fill={bg} />
          <rect width="9" height="22" fill={stripe} opacity=".55" />
        </pattern>
        <radialGradient id={`${id}-shade`} cx="50%" cy="45%" r="55%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".18" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}-cloth)`} />
      <ellipse cx="104" cy="108" rx="78" ry="76" fill="#243024" opacity=".12" />
      <g className={spin ? 'dish-spin' : undefined}>{PLATES[kind]}</g>
      {SIDES[kind]}
    </svg>
  );
}

const PLATES: Record<DishKind, ReactNode> = {
  guac: (
    <>
      <circle cx="100" cy="100" r="72" fill="#a23e18" />
      <circle cx="100" cy="100" r="64" fill="#c4572c" />
      <circle cx="100" cy="100" r="56" fill="#9cbf5a" />
      <path d="M62 92c12-14 30-20 44-14s24 2 34 10" stroke="#b9d77a" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M66 118c16 8 30 10 46 4s22-2 28-8" stroke="#7fa544" strokeWidth="6" fill="none" strokeLinecap="round" />
      {[
        [80, 82, '#e2543a'],
        [118, 76, '#e2543a'],
        [128, 112, '#e2543a'],
        [88, 124, '#e2543a'],
        [104, 104, '#f6f1e4'],
        [72, 106, '#f6f1e4'],
        [116, 128, '#f6f1e4'],
      ].map(([x, y, c], i) => (
        <rect key={i} x={Number(x) - 4} y={Number(y) - 4} width="8" height="8" rx="2" fill={String(c)} transform={`rotate(${i * 23} ${x} ${y})`} />
      ))}
      {[
        [96, 86],
        [110, 116],
        [80, 96],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}c4-6 10-6 12 0-4 4-8 4-12 0Z`} fill="#3f7a3a" />
      ))}
    </>
  ),
  pancakes: (
    <>
      <circle cx="100" cy="100" r="74" fill="#ffffff" />
      <circle cx="100" cy="100" r="66" fill="#f3f4ef" />
      <circle cx="100" cy="100" r="52" fill="#c9823c" />
      <circle cx="100" cy="100" r="46" fill="#e0a35a" />
      <circle cx="100" cy="100" r="34" fill="#e8b46c" />
      <path d="M84 84c10-6 26-6 34 4 6 8 2 20-6 26" stroke="#8a4a14" strokeWidth="7" fill="none" strokeLinecap="round" opacity=".75" />
      <rect x="90" y="88" width="20" height="16" rx="3" fill="#fbe7a1" transform="rotate(-12 100 96)" />
      {[
        [70, 70],
        [132, 80],
        [126, 132],
        [74, 128],
        [140, 104],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="#3a4a8a" />
      ))}
      <circle cx="128" cy="62" r="7" fill="#c83a3a" />
    </>
  ),
  soup: (
    <>
      <circle cx="100" cy="100" r="74" fill="#f8faf5" />
      <circle cx="100" cy="100" r="62" fill="#e3e6df" />
      <circle cx="100" cy="100" r="56" fill="#d65a2e" />
      <circle cx="100" cy="100" r="44" fill="#e2703c" />
      <path d="M78 96c8-12 26-14 34-4s-2 22-14 20-14-12-4-16" stroke="#fff6ec" strokeWidth="6" fill="none" strokeLinecap="round" />
      {[
        [124, 84],
        [118, 124],
        [80, 124],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}c5-7 12-7 14 0-5 5-9 5-14 0Z`} fill="#3f7a3a" />
      ))}
      {[
        [132, 108],
        [70, 92],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#2a1a10" />
      ))}
    </>
  ),
  salad: (
    <>
      <circle cx="100" cy="100" r="74" fill="#33533b" />
      <circle cx="100" cy="100" r="66" fill="#4a7a55" />
      {[
        [80, 80, 0],
        [120, 84, 60],
        [124, 120, 140],
        [84, 122, 220],
        [100, 100, 300],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="22" ry="13" fill={i % 2 ? '#8fc46a' : '#b6dc84'} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {[
        [96, 76],
        [130, 102],
        [78, 104],
        [108, 128],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="#e9f5e0" />
          <circle cx={x} cy={y} r="6" fill="#bfe0a2" />
        </g>
      ))}
      {[
        [114, 92],
        [88, 94],
        [96, 116],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill="#e2543a" />
      ))}
    </>
  ),
};

const SIDES: Record<DishKind, ReactNode> = {
  guac: (
    <g>
      <path d="M160 22a26 26 0 0 1 26 26h-26Z" fill="#7fa544" />
      <path d="M163 28a20 20 0 0 1 17 17h-17Z" fill="#d5e8a4" />
    </g>
  ),
  pancakes: <circle cx="176" cy="30" r="14" fill="#f3c969" opacity=".9" />,
  soup: (
    <g fill="#c9823c">
      <rect x="150" y="160" width="40" height="18" rx="9" />
      <rect x="10" y="20" width="34" height="14" rx="7" transform="rotate(-20 27 27)" />
    </g>
  ),
  salad: <circle cx="24" cy="174" r="12" fill="#e2543a" />,
};

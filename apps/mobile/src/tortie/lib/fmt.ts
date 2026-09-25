import { tint } from '@/tortie/color';

/** Ported 1:1 from the prototype helpers. */

export const AISLES = [
  'Produce',
  'Fish & meat',
  'Dairy & eggs',
  'Dry goods',
  'Bakery',
  'Other',
] as const;
export const AHUE = [140, 28, 88, 62, 50, 250] as const;
export const SHELVES = [
  'Fridge',
  'Veg basket',
  'Cupboard',
  'Oils & spices',
  'Freezer',
] as const;
export const SHUE = [230, 140, 62, 40, 250] as const;
export const DAYNAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export const DAYLETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const MON = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Minutes → "40 min" / "3 h 30" / "3 days"; "—" when unknown (0). */
export const fmtT = (t: number) =>
  t <= 0
    ? '—'
    : t < 60
      ? `${t} min`
      : t < 1440
        ? `${Math.floor(t / 60)} h${t % 60 ? ' ' + (t % 60) : ''}`
        : `${Math.round(t / 1440)} days`;

/** Scaled quantity with kitchen fractions. */
export function fmtQ(q: number): string {
  if (q >= 100) return String(Math.round(q / 5) * 5);
  if (q >= 10) return String(Math.round(q));
  const w = Math.floor(q);
  const f = q - w;
  const fr: [number, string][] = [
    [0, ''],
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.67, '⅔'],
    [0.75, '¾'],
    [1, ''],
  ];
  let b = fr[0]!;
  let bd = 9;
  for (const x of fr) {
    const d = Math.abs(f - x[0]);
    if (d < bd) {
      bd = d;
      b = x;
    }
  }
  const W = w + (b[0] === 1 ? 1 : 0);
  return (W || '') + b[1] || '¼';
}

/** Seconds → "5:12" / "1:05:12". */
export const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return (
    (h ? h + ':' + String(m).padStart(2, '0') : m) +
    ':' +
    String(x).padStart(2, '0')
  );
};

const FRC: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};
const UNITS =
  'kg|g|mg|ml|l|tsp|tbsp|cups?|heads?|cloves?|bunch(?:es)?|sprigs?|slices?|sticks?|pinch(?:es)?|handfuls?|cans?|tins?|jars?';

/** "2 tbsp olive oil" → { q: 2, u: 'tbsp', n: 'olive oil' }. */
export function parseIng(txt: string): { q: number; u: string; n: string } {
  const t = String(txt).trim();
  const m = t.match(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s*/);
  if (!m) return { q: 0, u: '', n: t };
  const qs = m[1]!.replace(/\s/g, '');
  let q: number;
  if (qs.includes('/')) {
    const [a, b] = qs.split('/');
    q = +a! / (+b! || 1);
  } else {
    const f = qs.slice(-1);
    q = FRC[f]
      ? (parseFloat(qs) || 0) + FRC[f]!
      : parseFloat(qs.replace(',', '.'));
  }
  let rest = t.slice(m[0].length);
  let u = '';
  const um = rest.match(
    new RegExp('^(' + UNITS + ')\\.?(?=\\s|$)\\s*(?:of\\s+)?', 'i'),
  );
  if (um) {
    u = um[1]!.toLowerCase();
    rest = rest.slice(um[0].length);
  }
  return { q, u, n: rest };
}

export function qTxt(q: number): string {
  if (!q) return '';
  const w = Math.floor(q);
  const f = +(q - w).toFixed(2);
  const F: Record<string, string> = {
    '0.5': '½',
    '0.25': '¼',
    '0.75': '¾',
    '0.33': '⅓',
    '0.67': '⅔',
  };
  if (!f) return String(w);
  return F[String(f)] ? (w || '') + F[String(f)]! : String(+q.toFixed(2));
}

/** First duration mentioned in text, in minutes. */
export function detectMin(t: string): number | null {
  const m = String(t).match(
    /(\d+)(½)?(?:\s*(?:–|-|to)\s*(\d+))?\s*(minutes?|mins?|hours?|hrs?)\b/i,
  );
  if (!m) return null;
  let v = m[3] ? +m[3] : +m[1]! + (m[2] ? 0.5 : 0);
  if (/^h/i.test(m[4]!)) v *= 60;
  return v;
}

const STOPW = [
  'extra',
  'virgin',
  'fresh',
  'large',
  'small',
  'finely',
  'grated',
  'peeled',
  'bone',
  'baby',
  'mixed',
  'wild',
  'warm',
  'active',
  'plain',
  'medium',
  'unsalted',
  'whole',
  'dried',
  'diced',
  'sliced',
  'chopped',
  'halved',
  'smashed',
];

export const ingKeys = (n: string) =>
  String(n)
    .split(',')[0]!
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPW.includes(w))
    .map((w) => w.replace(/oes$/, 'o').replace(/s$/, ''))
    .filter((w) => w.length > 2);

export const hasKey = (tx: string, k: string) =>
  new RegExp(
    '\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(e?s)?\\b',
  ).test(tx);

/** [pattern, emoji, aisle index, shelf index] */
export const LEX: [RegExp, string, number, number][] = [
  [/black pepper|peppercorn/, '🫙', 3, 3],
  [/tomato/, '🍅', 0, 1],
  [/garlic/, '🧄', 0, 1],
  [/onion|shallot|leek/, '🧅', 0, 1],
  [/potato/, '🥔', 0, 1],
  [/carrot/, '🥕', 0, 0],
  [/lemon|lime/, '🍋', 0, 1],
  [/banana/, '🍌', 0, 1],
  [/apple/, '🍎', 0, 1],
  [/avocado/, '🥑', 0, 1],
  [/cucumber|courgette|zucchini/, '🥒', 0, 0],
  [/chil+i|jalape/, '🌶️', 0, 3],
  [/pepper/, '🫑', 0, 0],
  [/broccoli/, '🥦', 0, 0],
  [/lettuce|salad|spinach|kale|cabbage/, '🥬', 0, 0],
  [/mushroom/, '🍄', 0, 0],
  [
    /basil|parsley|herb|sage|thyme|rosemary|mint|coriander|cilantro|dill/,
    '🌿',
    0,
    0,
  ],
  [/sweetcorn|corn/, '🌽', 0, 4],
  [/strawberr|raspberr|berr/, '🍓', 0, 0],
  [/grape/, '🍇', 0, 0],
  [/orange|clementine/, '🍊', 0, 1],
  [/peach|nectarine/, '🍑', 0, 1],
  [/pear/, '🍐', 0, 1],
  [/squash|pumpkin/, '🎃', 0, 1],
  [/pea/, '🫛', 0, 4],
  [/chicken|turkey/, '🍗', 1, 0],
  [/bacon|pork|ham|sausage/, '🥓', 1, 0],
  [/beef|steak|mince|rib|lamb/, '🥩', 1, 0],
  [/prawn|shrimp/, '🦐', 1, 4],
  [/fish|salmon|cod|branzino|tuna|bass/, '🐟', 1, 0],
  [/milk/, '🥛', 2, 0],
  [/cheese|parm|feta|mozz|cheddar|ricotta/, '🧀', 2, 0],
  [/butter/, '🧈', 2, 0],
  [/egg/, '🥚', 2, 0],
  [/yog/, '🥣', 2, 0],
  [/croissant/, '🥐', 4, 2],
  [/bagel/, '🥯', 4, 2],
  [/baguette/, '🥖', 4, 2],
  [/bread|sourdough|loaf|toast/, '🍞', 4, 2],
  [/pasta|spaghetti|tagliatelle|penne|pappardelle|noodle/, '🍝', 3, 2],
  [/rice|arborio/, '🍚', 3, 2],
  [/flour|farro|oat|grain/, '🌾', 3, 2],
  [/bean|chickpea|lentil|tin|can/, '🥫', 3, 2],
  [/honey|jam/, '🍯', 3, 2],
  [/coffee/, '☕', 3, 2],
  [/tea/, '🍵', 3, 2],
  [/chocolate|cocoa/, '🍫', 3, 2],
  [/wine/, '🍷', 3, 2],
  [/beer/, '🍺', 5, 0],
  [/oil|olive|caper/, '🫒', 3, 3],
  [/salt/, '🧂', 3, 3],
  [/sugar|spice|cumin|paprika|cinnamon|vinegar/, '🫙', 3, 3],
  [/ice cream/, '🍨', 5, 4],
  [/water|juice/, '🧃', 5, 2],
  [/paper|soap|towel|foil/, '🧻', 5, 2],
];

export function lexOf(name: string) {
  const lo = String(name).toLowerCase();
  return LEX.find((l) => l[0].test(lo));
}

/** Ingredient emoji + aisle tint. */
export function emoOf(name: string): {
  emo: string;
  tint: string;
  aisle: number;
} {
  const L = lexOf(name);
  const aisle = L ? L[2] : 5;
  return { emo: L ? L[1] : '🍽️', tint: tint(AHUE[aisle]!), aisle };
}

/** Local fallback classifier for smart-add ("2 lemons" → name, qty, emoji, aisle, shelf). */
export function parseLocal(raw: string) {
  let t = raw.trim();
  let q = '';
  const U =
    '(?:kg|g|ml|l|x|tins?|cans?|bunch(?:es)?|packs?|bottles?|jars?|heads?|cloves?|slices?)';
  const m = t.match(
    new RegExp('^(\\d+(?:[.,]\\d+)?\\s*' + U + '?)\\s+(?:of\\s+)?(.+)$', 'i'),
  );
  if (m) {
    q = m[1]!.replace(/\s*x$/i, '');
    t = m[2]!;
  } else {
    const m2 = t.match(/^(.+?)\s+[x×]?(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)?)$/i);
    if (m2) {
      t = m2[1]!;
      q = m2[2]!;
    }
  }
  t = t.replace(/^(some|a|an)\s+/i, '');
  const hit = lexOf(t);
  return {
    n: t.charAt(0).toUpperCase() + t.slice(1),
    q,
    e: hit ? hit[1] : '🛒',
    a: hit ? hit[2] : 5,
    sh: hit ? hit[3] : 2,
  };
}

export const plz = (n: number, w: string) => n + ' ' + w + (n === 1 ? '' : 's');

/** Leading emoji of a string, if any ("⚡ Weeknight wins" → ["⚡", "Weeknight wins"]). */
export function splitEmoji(name: string): [string, string] {
  const m = name.match(
    /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u,
  );
  return m ? [m[1]!, m[2]!] : ['', name];
}

/** "Good morning/afternoon/evening". */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "WEDNESDAY · SEPT 23" source text (render uppercase). */
export function todayLine(now = new Date()): string {
  const di = (now.getDay() + 6) % 7;
  return `${DAYNAMES[di]} · ${MON[now.getMonth()]} ${now.getDate()}`;
}

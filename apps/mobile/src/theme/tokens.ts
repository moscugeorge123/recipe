export const colors = {
  paprika: '#ff385c',
  paprika400: '#ff385c',
  paprikaPressed: '#e00b41',
  paprikaSoft: '#ffd1da',
  basil: '#222222',
  basilSoft: '#f7f7f7',
  basil700: '#222222',
  basil600: '#222222',
  honey: '#222222',
  honey50: '#f7f7f7',
  honey200: '#dddddd',
  berry: '#ff385c',
  cream: '#ffffff',
  peach: '#f7f7f7',
  butter: '#ffffff',
  linen: '#f2f2f2',
  crust: '#dddddd',
  espresso: '#222222',
  steamedMilk: '#ffffff',
  cocoa: '#3f3f3f',
  olive: '#6a6a6a',
  sage: '#929292',
  steam: '#ebebeb',
  chili: '#c13515',
  chili50: '#ffd1da',
  sky: '#428bff',
  onPrimary: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.5)',
  paprikaShadow: 'rgba(0, 0, 0, 0.1)',
} as const;

export const sourceColors: Record<string, string> = {
  Instagram: '#D62976',
  TikTok: '#010101',
  YouTube: '#FF0000',
  Website: '#222222',
  Facebook: '#1877F2',
  Photo: '#222222',
  Note: '#6a6a6a',
  Text: '#6a6a6a',
  'Voice note': '#6a6a6a',
  'Share sheet': '#ff385c',
};

export const placeholderPairs: [string, string][] = [
  ['#f7f7f7', '#f2f2f2'],
  ['#ebebeb', '#dddddd'],
  ['#f2f2f2', '#c1c1c1'],
  ['#ffffff', '#f7f7f7'],
  ['#dddddd', '#c1c1c1'],
  ['#f7f7f7', '#ebebeb'],
];

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radii = {
  card: 14,
  cta: 8,
  icon: 16,
  sheet: 14,
  pill: 9999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
} as const;

/** Single documented elevation tier. */
export const shadows = {
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

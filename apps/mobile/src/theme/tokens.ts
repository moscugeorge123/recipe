import { Platform, type TextStyle } from 'react-native';

const useSystem = Platform.OS === 'ios';

const inter = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const weightNum = {
  light: '300',
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Garden Plate token names are kept so NativeWind classes (`bg-peach`,
 * `text-espresso`, `bg-primary`) restyle without a second accent. Hexes are
 * Apple marketing: Action Blue, parchment/white, near-black cook tiles.
 */
export const colors = {
  paprika: '#0066cc',
  paprika400: '#0066cc',
  paprikaPressed: '#0066cc',
  paprikaSoft: '#fafafc',
  basil: '#0066cc',
  basilSoft: '#f5f5f7',
  basil700: '#1d1d1f',
  basil600: '#0066cc',
  honey: '#0066cc',
  honey50: '#f5f5f7',
  honey200: '#cccccc',
  berry: '#0066cc',
  cream: '#ffffff',
  peach: '#fafafc',
  butter: '#ffffff',
  linen: '#f5f5f7',
  crust: '#e0e0e0',
  espresso: '#1d1d1f',
  steamedMilk: '#ffffff',
  cocoa: '#333333',
  olive: '#7a7a7a',
  sage: '#7a7a7a',
  steam: '#d2d2d7',
  chili: '#1d1d1f',
  chili50: '#f5f5f7',
  sky: '#0066cc',
  onPrimary: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.42)',
  paprikaShadow: 'transparent',
  primary: '#0066cc',
  primaryFocus: '#0071e3',
  primaryOnDark: '#2997ff',
  ink: '#1d1d1f',
  canvas: '#ffffff',
  parchment: '#f5f5f7',
  pearl: '#fafafc',
  hairline: '#e0e0e0',
  dividerSoft: '#f0f0f0',
  tile1: '#272729',
  tile2: '#2a2a2c',
  tile3: '#252527',
  surfaceBlack: '#000000',
  chipTranslucent: 'rgba(210, 210, 215, 0.64)',
  onDark: '#ffffff',
  bodyMuted: '#cccccc',
  inkMuted80: '#333333',
  inkMuted48: '#7a7a7a',
  searchBorder: 'rgba(0, 0, 0, 0.08)',
} as const;

export const sourceColors: Record<string, string> = {
  Instagram: '#D62976',
  TikTok: '#010101',
  YouTube: '#FF0000',
  Website: '#0066cc',
  Facebook: '#1877F2',
  Photo: '#1d1d1f',
  Note: '#7a7a7a',
  Text: '#7a7a7a',
  'Voice note': '#7a7a7a',
  'Share sheet': '#0066cc',
};

export const placeholderPairs: [string, string][] = [
  ['#f5f5f7', '#e0e0e0'],
  ['#fafafc', '#f0f0f0'],
  ['#ffffff', '#d2d2d7'],
  ['#f5f5f7', '#d2d2d7'],
  ['#fafafc', '#e0e0e0'],
  ['#f0f0f0', '#d2d2d7'],
];

export const fonts = {
  light: useSystem ? 'System' : inter.light,
  regular: useSystem ? 'System' : inter.regular,
  semibold: useSystem ? 'System' : inter.semibold,
  bold: useSystem ? 'System' : inter.bold,
} as const;

export function typeface(
  weight: keyof typeof fonts,
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  if (useSystem) {
    return { fontFamily: 'System', fontWeight: weightNum[weight] };
  }
  return { fontFamily: inter[weight] };
}

export const substitutingInter = !useSystem;

export const radii = {
  none: 0,
  xs: 5,
  sm: 8,
  md: 11,
  lg: 18,
  card: 18,
  cta: 9999,
  icon: 22,
  sheet: 18,
  pill: 9999,
} as const;

/** The only drop-shadow in the system — product/recipe photography on a surface. */
export const productImageShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 3, height: 5 },
  shadowOpacity: 0.22,
  shadowRadius: 30,
  elevation: 8,
} as const;

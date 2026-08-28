export const colors = {
  paprika: '#E25A3C',
  paprika400: '#EF6D52',
  paprikaPressed: '#C4472C',
  paprikaSoft: '#FFF1ED',
  basil: '#2F8F5B',
  basilSoft: '#EAF7F0',
  basil700: '#1C5C3A',
  basil600: '#24754A',
  honey: '#E8B923',
  honey50: '#FFF8E1',
  honey200: '#F6D56A',
  berry: '#D94F70',
  cream: '#FFF8F2',
  peach: '#FFE8D6',
  butter: '#FFFDF9',
  linen: '#F3E6D8',
  crust: '#E6D3C2',
  espresso: '#2A2118',
  steamedMilk: '#F5EDE4',
  cocoa: '#4A3D32',
  olive: '#6B7A62',
  sage: '#8A9580',
  steam: '#C4B8AA',
  chili: '#C43C2C',
  chili50: '#FDECEA',
  sky: '#3A8FBF',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(26, 22, 18, 0.42)',
  paprikaShadow: 'rgba(226, 90, 60, 0.28)',
} as const;

export const sourceColors: Record<string, string> = {
  Instagram: '#D62976',
  TikTok: '#010101',
  YouTube: '#FF0000',
  Website: '#2F8F5B',
  Facebook: '#1877F2',
  Photo: '#E8B923',
  Note: '#6B7A62',
  Text: '#6B7A62',
  'Voice note': '#6B7A62',
  'Share sheet': '#E25A3C',
};

export const placeholderPairs: [string, string][] = [
  ['#E6D9C4', '#DCCBB0'],
  ['#E8D3BE', '#DFC3A6'],
  ['#E4DBC6', '#D8CDB2'],
  ['#E9DCC0', '#DECFAE'],
  ['#E7D5BA', '#DCC7A6'],
  ['#E6DFCB', '#DAD2BA'],
];

export const fonts = {
  manrope500: 'Manrope_500Medium',
  manrope600: 'Manrope_600SemiBold',
  manrope700: 'Manrope_700Bold',
  manrope800: 'Manrope_800ExtraBold',
  mono500: 'IBMPlexMono_500Medium',
  mono600: 'IBMPlexMono_600SemiBold',
  mono700: 'IBMPlexMono_700Bold',
} as const;

export const radii = {
  card: 16,
  cta: 18,
  icon: 14,
  sheet: 28,
} as const;

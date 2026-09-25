import { Easing } from 'react-native-reanimated';

export const C = {
  bg: '#f8faf5',
  surface: '#ffffff',
  surface2: '#f3f4ef',
  surface3: '#edeee9',
  surfacePress: '#e7e9e4',
  line: '#e1e3de',
  lineStrong: '#c2c8c0',
  ink: '#191c19',
  ink2: '#424842',
  ink3: '#727972',
  green: '#32533c',
  greenDeep: '#33533b',
  greenMid: '#4a7a55',
  greenSoft: '#c7ecce',
  greenSoft2: '#accfb1',
  greenWash: '#eef6ec',
  greenWash2: '#f2f8f0',
  greenWash3: '#eef3ea',
  onGreenInk: '#02210e',
  terra: '#a23e18',
  terraBright: '#fe8357',
  terraSoft: '#ffdbcf',
  terraWash: '#fff6f2',
  terraWash2: '#fff1eb',
  terraInk: '#822801',
  terraInk2: '#6f2000',
  terraInk3: '#3a1000',
  camera: '#0b0c0b',
  flashOn: '#f3c969',
  white: '#ffffff',
  scrim: 'rgba(28,30,28,.4)',
} as const;

export const F = {
  serif400: 'Newsreader_400Regular',
  serif500: 'Newsreader_500Medium',
  serif600: 'Newsreader_600SemiBold',
  serif400i: 'Newsreader_400Regular_Italic',
  serif500i: 'Newsreader_500Medium_Italic',
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  mono500: 'JetBrainsMono_500Medium',
  icon: 'MaterialSymbolsOutlined',
  iconFill: 'MaterialSymbolsOutlinedFill',
} as const;

export const SH = {
  card: '0 12px 32px -6px rgba(74,107,83,.14)',
  cardSubtle: '0 8px 24px -12px rgba(74,107,83,.18)',
  hairline: '0 1px 2px rgba(25,28,25,.05)',
  terraCta: '0 8px 18px -2px rgba(162,62,24,.35)',
  greenCta: '0 8px 18px -8px rgba(50,83,60,.6)',
  floating: '0 2px 8px rgba(36,39,36,.08)',
  knob: '0 1px 3px rgba(36,39,36,.2)',
  focus: '0 0 0 4px rgba(50,83,60,.12)',
  avatarRing: '0 0 0 2px #f8faf5, 0 0 0 3.5px #e1e3de',
  sheet: '0 -16px 36px -6px rgba(44,52,45,.18)',
  header: '0 10px 18px -12px rgba(46,49,46,.22)',
  dragged: '0 18px 34px -12px rgba(46,49,46,.4)',
  pushed: '-20px 0 40px -20px rgba(36,39,36,.3)',
  modalTop: '0 -20px 40px -20px rgba(36,39,36,.3)',
  toast: '0 12px 30px -10px rgba(0,0,0,.4)',
  plus: '0 10px 22px -8px rgba(162,62,24,.65)',
} as const;

/** Fast start, long soft landing. */
export const EASE = Easing.bezierFn(0.32, 0.72, 0, 1);
/** Overshoot for small confirmations. */
export const SPRING = Easing.bezierFn(0.34, 1.56, 0.64, 1);
/** CSS `ease`. */
export const CSS_EASE = Easing.bezierFn(0.25, 0.1, 0.25, 1);
export const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1);
export const EASE_IN_OUT = Easing.bezierFn(0.42, 0, 0.58, 1);

/** Base duration before the motion multiplier. */
export const BASE_D = 480;

export const GUTTER = 20;

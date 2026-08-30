import 'react-native-gesture-handler/jestSetup';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api/v1';

jest.mock('react-native-worklets', () => ({}));

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native') as typeof import('react-native');

  const Animated = {
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    createAnimatedComponent: (Component: unknown) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: <T>(init: T) => ({ value: init }),
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useAnimatedProps: (updater: () => unknown) => updater(),
    withTiming: <T>(toValue: T) => toValue,
    withSpring: <T>(toValue: T) => toValue,
    withSequence: <T>(...values: T[]) => values[values.length - 1],
    withDelay: <T>(_delay: number, value: T) => value,
    withRepeat: <T>(value: T) => value,
    cancelAnimation: jest.fn(),
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[0] ?? 0,
    Extrapolation: {
      CLAMP: 'clamp',
      EXTEND: 'extend',
      IDENTITY: 'identity',
    },
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      quad: (t: number) => t,
      sin: (t: number) => t,
      out: (fn: (t: number) => number) => fn,
      inOut: (fn: (t: number) => number) => fn,
      bezier: () => (t: number) => t,
    },
    FadeIn: {
      duration: () => ({ springify: () => ({ damping: () => ({}) }) }),
    },
    FadeOut: { duration: () => ({}) },
    SlideInDown: {
      duration: () => ({ springify: () => ({ damping: () => ({}) }) }),
    },
    FadeInDown: { duration: () => ({ springify: () => ({}) }) },
    runOnJS: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    runOnUI: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-image', () => {
  const { Image } = require('react-native') as typeof import('react-native');
  return { Image };
});

jest.mock('expo-font', () => ({
  useFonts: () => [true],
  isLoaded: () => true,
  loadAsync: jest.fn(),
}));

jest.mock('@expo-google-fonts/manrope', () => ({
  Manrope_500Medium: 1,
  Manrope_600SemiBold: 1,
  Manrope_700Bold: 1,
  Manrope_800ExtraBold: 1,
}));

jest.mock('@expo-google-fonts/ibm-plex-mono', () => ({
  IBMPlexMono_500Medium: 1,
  IBMPlexMono_600SemiBold: 1,
  IBMPlexMono_700Bold: 1,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-svg', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');

  const create = (name: string) => {
    function Comp(props: Record<string, unknown>) {
      return React.createElement(View, props as never);
    }
    Comp.displayName = name;
    return Comp;
  };

  const Svg = create('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path: create('Path'),
    Rect: create('Rect'),
    Circle: create('Circle'),
    Ellipse: create('Ellipse'),
    Line: create('Line'),
    G: create('G'),
    Polygon: create('Polygon'),
    Text: create('Text'),
  };
});

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  hasStringAsync: jest.fn(async () => true),
  setStringAsync: jest.fn(),
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native') as typeof import('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const { AccessibilityInfo } =
  require('react-native') as typeof import('react-native');
AccessibilityInfo.isReduceMotionEnabled = jest.fn(async () => false);
AccessibilityInfo.addEventListener = jest.fn(
  () =>
    ({ remove: jest.fn() }) as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >,
);
AccessibilityInfo.announceForAccessibility = jest.fn();

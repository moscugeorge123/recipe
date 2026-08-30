import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { colors, sourceColors } from '@/theme/tokens';

export const SOURCE_ICON_KEYS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'Website',
  'Photo',
  'Text',
  'Note',
  'Voice note',
  'Share sheet',
  'All',
] as const;

export type SourceIconKey = (typeof SOURCE_ICON_KEYS)[number];

type SourceIconProps = {
  source: string;
  size?: number;
};

export function normalizeSource(source: string): SourceIconKey | string {
  const value = source.trim().toLowerCase();
  if (
    value.includes('instagram') ||
    value === 'reels' ||
    value === 'reel' ||
    value === 'ig'
  ) {
    return 'Instagram';
  }
  if (value.includes('tiktok')) {
    return 'TikTok';
  }
  if (value.includes('youtu')) {
    return 'YouTube';
  }
  if (value.includes('facebook') || value === 'fb') {
    return 'Facebook';
  }
  if (
    value.includes('photo') ||
    value.includes('image') ||
    value.includes('screenshot')
  ) {
    return 'Photo';
  }
  if (value.includes('voice')) {
    return 'Voice note';
  }
  if (value.includes('share')) {
    return 'Share sheet';
  }
  if (value === 'all') {
    return 'All';
  }
  if (value === 'note') {
    return 'Note';
  }
  if (value.includes('text') || value.includes('paste')) {
    return 'Text';
  }
  if (
    value.includes('web') ||
    value.includes('site') ||
    value === 'generic_web'
  ) {
    return 'Website';
  }
  return source;
}

function iconRadius(size: number) {
  return size * 0.223;
}

function AppIconFrame({
  size,
  backgroundColor,
  bordered = true,
  children,
}: {
  size: number;
  backgroundColor?: string;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: iconRadius(size),
        borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
        borderColor: bordered ? 'rgba(42, 33, 24, 0.12)' : 'transparent',
        backgroundColor,
      }}
    >
      {children}
    </View>
  );
}

function Tile({
  size,
  backgroundColor,
  children,
}: {
  size: number;
  backgroundColor?: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: iconRadius(size),
        backgroundColor,
      }}
    >
      {children}
    </View>
  );
}

const INSTAGRAM_CAMERA =
  'M132.3452 33.973c-26.7167 0-30.0696.1167-40.5629.5939-10.4727.4792-17.6212 2.136-23.8762 4.567-6.4701 2.5107-11.9586 5.8693-17.4265 11.3352-5.472 5.464-8.8332 10.9483-11.354 17.4116-2.4389 6.2524-4.099 13.3976-4.5703 23.8585-.4693 10.4854-.5923 13.8379-.5923 40.5348 0 26.697.1189 30.0371.5943 40.5225.4817 10.465 2.1397 17.6082 4.5703 23.8585 2.5147 6.4654 5.8758 11.9497 11.3458 17.4136 5.466 5.468 10.9544 8.8349 17.4204 11.3456 6.259 2.4309 13.4097 4.0877 23.8803 4.567 10.4933.477 13.8441.5938 40.5588.5938 26.7188 0 30.0615-.1167 40.5547-.5939 10.4728-.4792 17.6295-2.136 23.8885-4.567 6.4681-2.5106 11.9484-5.8775 17.4143-11.3455 5.472-5.4639 8.8332-10.9482 11.354-17.4115 2.4183-6.2524 4.0784-13.3976 4.5703-23.8585.4713-10.4854.5943-13.8277.5943-40.5246 0-26.697-.123-30.0473-.5943-40.5328-.4919-10.465-2.152-17.6081-4.5703-23.8584-2.5208-6.4654-5.882-11.9498-11.354-17.4137-5.4721-5.468-10.9442-8.8266-17.4204-11.3353-6.2714-2.4309-13.424-4.0877-23.8967-4.5669-10.4933-.4772-13.8339-.5939-40.5588-.5939zm-8.825 17.7147c2.6193-.0041 5.5418 0 8.825 0 26.2659 0 29.379.0942 39.7513.5652 9.5915.4383 14.7971 2.0397 18.2648 3.3852 4.5908 1.7817 7.8638 3.9116 11.3048 7.3521 3.4431 3.4406 5.5745 6.7173 7.3617 11.3046 1.3465 3.461 2.9512 8.6628 3.3877 18.2472.4714 10.3625.5739 13.4754.5739 39.7095 0 26.234-.1025 29.347-.5739 39.7095-.4386 9.5843-2.0412 14.7861-3.3877 18.2471-1.783 4.5874-3.9186 7.8539-7.3617 11.2923-3.443 3.4406-6.712 5.5704-11.3048 7.3521-3.4636 1.3517-8.6733 2.949-18.2648 3.3873-10.3702.471-13.4854.5734-39.7513.5734-26.2679 0-29.381-.1024-39.7513-.5734-9.5914-.4423-14.797-2.0438-18.2668-3.3893-4.5908-1.7817-7.87-3.9116-11.313-7.3521-3.4431-3.4405-5.5745-6.709-7.3617-11.2985-1.3465-3.461-2.9512-8.6628-3.3877-18.2471-.4714-10.3626-.5657-13.4754-.5657-39.7259 0-26.2504.0943-29.347.5657-39.7095.4386-9.5844 2.0412-14.7861 3.3877-18.2512 1.783-4.5874 3.9186-7.8641 7.3617-11.3046 3.443-3.4406 6.7222-5.5704 11.313-7.3562 3.4677-1.3517 8.6754-2.949 18.2668-3.3894 9.075-.4096 12.5919-.5324 30.9264-.553zm61.3363 16.322c-6.5173 0-11.805 5.2776-11.805 11.792 0 6.5125 5.2877 11.7962 11.805 11.7962 6.5172 0 11.8049-5.2837 11.8049-11.7962 0-6.5124-5.2877-11.796-11.805-11.796zm-52.5113 13.7826c-27.8993 0-50.5191 22.6031-50.5191 50.4817 0 27.8786 22.6198 50.4714 50.5191 50.4714s50.511-22.5928 50.511-50.4714c0-27.8786-22.6137-50.4817-50.513-50.4817zm0 17.7147c18.109 0 32.7914 14.6694 32.7914 32.767 0 18.0956-14.6824 32.767-32.7914 32.767-18.111 0-32.7913-14.6714-32.7913-32.767 0-18.0976 14.6803-32.767 32.7913-32.767z';

const YOUTUBE_PLAY =
  'M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z';

const YOUTUBE_TRIANGLE =
  'M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z';

const TIKTOK_NOTE =
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';

const FACEBOOK_F =
  'M9.05 24V12.2H6.32V9.02H9.05V6.48c0-3.22 1.78-5.06 5.12-5.06 1.28 0 2.58.14 3.38.34v3.18h-1.9c-1.78 0-2.12.84-2.12 2.08v2h3.42l-.52 3.18h-2.9V24z';

function InstagramMark({ size }: { size: number }) {
  return (
    <AppIconFrame size={size} bordered={false}>
      <LinearGradient
        colors={['#FF0069', '#D300C5', '#7638FA']}
        start={{ x: 0.22, y: 0.78 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['#FFD600', '#FF8A00', 'rgba(255, 0, 105, 0)']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.78, y: 0.18 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={size} height={size} viewBox="0 0 264.5833 264.5833">
        <Path d={INSTAGRAM_CAMERA} fill="#FFFFFF" fillRule="evenodd" />
      </Svg>
    </AppIconFrame>
  );
}

function TikTokMark({ size }: { size: number }) {
  return (
    <AppIconFrame size={size} backgroundColor={sourceColors.TikTok}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G transform="translate(2.05 1.85) scale(0.84)">
          <G transform="translate(1.2 0.85)">
            <Path d={TIKTOK_NOTE} fill="#25F4EE" />
          </G>
          <G transform="translate(-1.2 -0.85)">
            <Path d={TIKTOK_NOTE} fill="#FE2C55" />
          </G>
          <Path d={TIKTOK_NOTE} fill="#FFFFFF" />
        </G>
      </Svg>
    </AppIconFrame>
  );
}

function YouTubeMark({ size }: { size: number }) {
  const playWidth = size;
  const playHeight = playWidth * (20 / 28.57);

  return (
    <AppIconFrame size={size} backgroundColor="#FFFFFF" bordered={false}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Svg width={playWidth} height={playHeight} viewBox="0 0 28.57 20">
          <Path d={YOUTUBE_PLAY} fill={sourceColors.YouTube} />
          <Path d={YOUTUBE_TRIANGLE} fill="#FFFFFF" />
        </Svg>
      </View>
    </AppIconFrame>
  );
}

function FacebookMark({ size }: { size: number }) {
  return (
    <AppIconFrame size={size} backgroundColor={sourceColors.Facebook}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={FACEBOOK_F} fill="#FFFFFF" />
      </Svg>
    </AppIconFrame>
  );
}

function WebsiteMark({ size }: { size: number }) {
  const globe = size * 0.58;
  return (
    <Tile size={size} backgroundColor={colors.basilSoft}>
      <View
        style={{
          width: globe,
          height: globe,
          overflow: 'hidden',
          borderRadius: globe / 2,
          borderColor: colors.basil,
          borderWidth: Math.max(1.5, size * 0.055),
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: '44%',
            right: 0,
            left: 0,
            height: Math.max(1.5, size * 0.05),
            backgroundColor: colors.basil,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '46%',
            width: Math.max(1.5, size * 0.05),
            backgroundColor: colors.basil,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          top: size * 0.1,
          right: size * 0.12,
          height: size * 0.16,
          width: size * 0.24,
          transform: [{ rotate: '32deg' }],
          borderRadius: size * 0.12,
          backgroundColor: colors.basil,
        }}
      />
    </Tile>
  );
}

function PhotoMark({ size }: { size: number }) {
  return (
    <Tile size={size} backgroundColor={colors.honey50}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.18,
          height: size * 0.12,
          width: size * 0.22,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: colors.cocoa,
        }}
      />
      <View
        style={{
          width: size * 0.72,
          height: size * 0.48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.1,
          backgroundColor: colors.cocoa,
        }}
      >
        <View
          style={{
            width: size * 0.26,
            height: size * 0.26,
            borderRadius: size * 0.13,
            borderColor: colors.honey50,
            borderWidth: Math.max(1.4, size * 0.04),
            backgroundColor: colors.paprika,
          }}
        />
      </View>
    </Tile>
  );
}

function TextMark({ size }: { size: number }) {
  return (
    <Tile size={size} backgroundColor={colors.linen}>
      <View
        style={{
          width: size * 0.56,
          height: size * 0.68,
          justifyContent: 'center',
          gap: size * 0.07,
          paddingHorizontal: size * 0.08,
          borderRadius: size * 0.08,
          borderWidth: 1,
          borderColor: colors.crust,
          backgroundColor: colors.butter,
        }}
      >
        <View
          style={{
            height: size * 0.07,
            width: '100%',
            borderRadius: 1,
            backgroundColor: colors.espresso,
          }}
        />
        <View
          style={{
            height: size * 0.055,
            width: '78%',
            borderRadius: 1,
            backgroundColor: colors.steam,
          }}
        />
        <View
          style={{
            height: size * 0.055,
            width: '90%',
            borderRadius: 1,
            backgroundColor: colors.steam,
          }}
        />
      </View>
    </Tile>
  );
}

function VoiceMark({ size }: { size: number }) {
  return (
    <Tile size={size} backgroundColor={colors.peach}>
      <View
        style={{
          width: size * 0.28,
          height: size * 0.4,
          borderRadius: size * 0.14,
          backgroundColor: colors.cocoa,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.16,
          height: size * 0.14,
          width: size * 0.08,
          borderRadius: 1,
          backgroundColor: colors.cocoa,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.14,
          height: size * 0.06,
          width: size * 0.28,
          borderRadius: 2,
          backgroundColor: colors.cocoa,
        }}
      />
    </Tile>
  );
}

function ShareMark({ size }: { size: number }) {
  const dot = size * 0.18;
  return (
    <Tile size={size} backgroundColor={colors.paprikaSoft}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.18,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.paprika,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.2,
          left: size * 0.18,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.paprika,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.18,
          bottom: size * 0.2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.paprika,
        }}
      />
    </Tile>
  );
}

function AllMark({ size }: { size: number }) {
  const dot = size * 0.16;
  return (
    <Tile size={size} backgroundColor={colors.peach}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.62,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.31,
          borderColor: colors.crust,
          borderWidth: Math.max(1.4, size * 0.045),
          backgroundColor: colors.butter,
        }}
      >
        <View style={{ flexDirection: 'row', gap: size * 0.05 }}>
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.paprika,
            }}
          />
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.basil,
            }}
          />
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.honey,
            }}
          />
        </View>
      </View>
    </Tile>
  );
}

function markFor(source: SourceIconKey | string, size: number) {
  switch (source) {
    case 'Instagram':
      return <InstagramMark size={size} />;
    case 'TikTok':
      return <TikTokMark size={size} />;
    case 'YouTube':
      return <YouTubeMark size={size} />;
    case 'Facebook':
      return <FacebookMark size={size} />;
    case 'Website':
      return <WebsiteMark size={size} />;
    case 'Photo':
      return <PhotoMark size={size} />;
    case 'Text':
    case 'Note':
      return <TextMark size={size} />;
    case 'Voice note':
      return <VoiceMark size={size} />;
    case 'Share sheet':
      return <ShareMark size={size} />;
    case 'All':
      return <AllMark size={size} />;
    default:
      return <WebsiteMark size={size} />;
  }
}

export function SourceIcon({ source, size = 32 }: SourceIconProps) {
  const key = normalizeSource(source);
  return (
    <View
      testID={`source-icon-${key}`}
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{ flexShrink: 0 }}
    >
      {markFor(key, size)}
    </View>
  );
}

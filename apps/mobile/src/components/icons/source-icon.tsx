import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

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
        overflow: 'hidden',
        borderRadius: iconRadius(size),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(42, 33, 24, 0.12)',
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

const TIKTOK_NOTE =
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';

const FACEBOOK_F =
  'M9.05 24V12.2H6.32V9.02H9.05V6.48c0-3.22 1.78-5.06 5.12-5.06 1.28 0 2.58.14 3.38.34v3.18h-1.9c-1.78 0-2.12.84-2.12 2.08v2h3.42l-.52 3.18h-2.9V24z';

function InstagramMark({ size }: { size: number }) {
  return (
    <AppIconFrame size={size}>
      <LinearGradient
        colors={['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5']}
        locations={[0, 0.28, 0.52, 0.74, 1]}
        start={{ x: 0.92, y: 0.08 }}
        end={{ x: 0.12, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect
          x="6.05"
          y="6.05"
          width="11.9"
          height="11.9"
          rx="3.55"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <Circle
          cx="12"
          cy="12.2"
          r="3.15"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.7"
        />
        <Circle cx="16.55" cy="8.15" r="0.95" fill="#FFFFFF" />
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
  return (
    <AppIconFrame size={size} backgroundColor="#FFFFFF">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect
          x="2.7"
          y="6.35"
          width="18.6"
          height="11.3"
          rx="3.9"
          fill={sourceColors.YouTube}
        />
        <Polygon points="10.05,9.15 10.05,14.85 15.55,12" fill="#FFFFFF" />
      </Svg>
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

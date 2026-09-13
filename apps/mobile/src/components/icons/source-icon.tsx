import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  Aperture,
  Camera,
  FileText,
  Globe,
  Image,
  LayoutGrid,
  Mic,
  Music2,
  Play,
  Share2,
  StickyNote,
} from 'lucide-react-native';

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

function Tile({
  size,
  backgroundColor,
  children,
}: {
  size: number;
  backgroundColor: string;
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

function markFor(source: SourceIconKey | string, size: number) {
  const glyph = Math.max(14, Math.round(size * 0.55));
  switch (source) {
    case 'Instagram':
      return (
        <Tile size={size} backgroundColor={sourceColors.Instagram ?? '#D62976'}>
          <Aperture size={glyph} color="#FFFFFF" strokeWidth={1.75} />
        </Tile>
      );
    case 'TikTok':
      return (
        <Tile size={size} backgroundColor={sourceColors.TikTok ?? '#010101'}>
          <Music2 size={glyph} color="#FFFFFF" strokeWidth={1.75} />
        </Tile>
      );
    case 'YouTube':
      return (
        <Tile size={size} backgroundColor={sourceColors.YouTube ?? '#FF0000'}>
          <Play size={glyph} color="#FFFFFF" strokeWidth={1.75} fill="#FFFFFF" />
        </Tile>
      );
    case 'Facebook':
      return (
        <Tile size={size} backgroundColor={sourceColors.Facebook ?? '#1877F2'}>
          <Share2 size={glyph} color="#FFFFFF" strokeWidth={1.75} />
        </Tile>
      );
    case 'Website':
      return (
        <Tile size={size} backgroundColor={colors.basilSoft}>
          <Globe size={glyph} color={colors.basil} strokeWidth={1.75} />
        </Tile>
      );
    case 'Photo':
      return (
        <Tile size={size} backgroundColor={colors.honey50}>
          <Camera size={glyph} color={colors.cocoa} strokeWidth={1.75} />
        </Tile>
      );
    case 'Text':
      return (
        <Tile size={size} backgroundColor={colors.linen}>
          <FileText size={glyph} color={colors.espresso} strokeWidth={1.75} />
        </Tile>
      );
    case 'Note':
      return (
        <Tile size={size} backgroundColor={colors.linen}>
          <StickyNote size={glyph} color={colors.espresso} strokeWidth={1.75} />
        </Tile>
      );
    case 'Voice note':
      return (
        <Tile size={size} backgroundColor={colors.peach}>
          <Mic size={glyph} color={colors.cocoa} strokeWidth={1.75} />
        </Tile>
      );
    case 'Share sheet':
      return (
        <Tile size={size} backgroundColor={colors.paprikaSoft}>
          <Share2 size={glyph} color={colors.paprika} strokeWidth={1.75} />
        </Tile>
      );
    case 'All':
      return (
        <Tile size={size} backgroundColor={colors.peach}>
          <LayoutGrid size={glyph} color={colors.espresso} strokeWidth={1.75} />
        </Tile>
      );
    default:
      return (
        <Tile size={size} backgroundColor={colors.basilSoft}>
          <Image size={glyph} color={colors.basil} strokeWidth={1.75} />
        </Tile>
      );
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

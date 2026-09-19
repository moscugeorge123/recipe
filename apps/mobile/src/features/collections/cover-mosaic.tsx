import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { MotionItem } from '@/components/ui/motion-item';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { placeholderPairs } from '@/theme/tokens';

export type CoverTile = {
  recipeId: string;
  thumbnailUrl: string | null;
  placeholder?: [string, string];
};

const GAP = 4;
const RADIUS = 9;
/** Cover height relative to width — shared by single and mosaic layouts. */
const SINGLE_HEIGHT_RATIO = 0.86;
const EMPTY_COLORS: [string, string] = ['#E6D9C4', '#DCCBB0'];

function placeholderFor(id: string): [string, string] {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    placeholderPairs[hash % placeholderPairs.length] ?? EMPTY_COLORS
  );
}

function Tile({
  cover,
  width,
  height,
  index,
}: {
  cover: CoverTile;
  width: number;
  height: number;
  index: number;
}) {
  return (
    <MotionItem preset="mosaic" index={index} style={{ width, height }}>
      <PhotoStandIn
        colors={cover.placeholder ?? placeholderFor(cover.recipeId)}
        height={height}
        radius={RADIUS}
        uri={cover.thumbnailUrl}
        className="w-full"
      />
    </MotionItem>
  );
}

function MosaicBody({
  tiles,
  size,
}: {
  tiles: CoverTile[];
  size: number;
}) {
  const height = Math.round(size * SINGLE_HEIGHT_RATIO);
  const half = (height - GAP) / 2;
  const halfWidth = (size - GAP) / 2;
  const count = tiles.length;

  if (count === 0) {
    return (
      <PhotoStandIn
        colors={EMPTY_COLORS}
        height={height}
        radius={RADIUS}
        className="w-full"
      />
    );
  }

  if (count === 1) {
    return (
      <Tile
        cover={tiles[0]!}
        width={size}
        height={height}
        index={0}
      />
    );
  }

  if (count === 2) {
    return (
      <View style={{ width: size, height, gap: GAP }}>
        <Tile cover={tiles[0]!} width={size} height={half} index={0} />
        <Tile cover={tiles[1]!} width={size} height={half} index={1} />
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={{ width: size, height, gap: GAP }}>
        <View style={{ flexDirection: 'row', gap: GAP, height: half }}>
          <Tile cover={tiles[0]!} width={halfWidth} height={half} index={0} />
          <Tile cover={tiles[1]!} width={halfWidth} height={half} index={1} />
        </View>
        <Tile cover={tiles[2]!} width={size} height={half} index={2} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height, gap: GAP }}>
      <View style={{ flexDirection: 'row', gap: GAP, height: half }}>
        <Tile cover={tiles[0]!} width={halfWidth} height={half} index={0} />
        <Tile cover={tiles[1]!} width={halfWidth} height={half} index={1} />
      </View>
      <View style={{ flexDirection: 'row', gap: GAP, height: half }}>
        <Tile cover={tiles[2]!} width={halfWidth} height={half} index={2} />
        <Tile cover={tiles[3]!} width={halfWidth} height={half} index={3} />
      </View>
    </View>
  );
}

export function CoverMosaic({ covers }: { covers: CoverTile[] }) {
  const [size, setSize] = useState(0);
  const tiles = covers.slice(0, 4);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== size) {
      setSize(next);
    }
  };

  return (
    <View className="w-full pb-3">
      <View
        testID="cover-mosaic"
        accessibilityLabel={
          tiles.length === 0
            ? 'Cookbook cover'
            : `Cookbook cover with ${tiles.length} ${
                tiles.length === 1 ? 'recipe' : 'recipes'
              }`
        }
        onLayout={onLayout}
        style={{ aspectRatio: 1 / SINGLE_HEIGHT_RATIO }}
      >
        {size > 0 ? <MosaicBody tiles={tiles} size={size} /> : null}
      </View>
    </View>
  );
}

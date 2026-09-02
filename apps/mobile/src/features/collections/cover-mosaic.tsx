import { View } from 'react-native';

import { MotionItem } from '@/components/ui/motion-item';
import { PhotoStandIn } from '@/components/ui/photo-stand-in';
import { placeholderPairs } from '@/theme/tokens';

export type CoverTile = {
  recipeId: string;
  thumbnailUrl: string | null;
  placeholder?: [string, string];
};

function placeholderFor(id: string): [string, string] {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    placeholderPairs[hash % placeholderPairs.length] ?? ['#E6D9C4', '#DCCBB0']
  );
}

export function CoverMosaic({
  covers,
  height = 44,
}: {
  covers: CoverTile[];
  height?: number;
}) {
  const tiles = covers.slice(0, 3);
  if (!tiles.length) {
    return (
      <View testID="cover-mosaic" className="flex-row gap-1 pb-3">
        <View className="flex-1">
          <PhotoStandIn
            colors={['#E6D9C4', '#DCCBB0']}
            height={height}
            radius={9}
          />
        </View>
      </View>
    );
  }

  return (
    <View testID="cover-mosaic" className="flex-row gap-1 pb-3">
      {tiles.map((cover, index) => (
        <MotionItem
          key={cover.recipeId}
          preset="mosaic"
          index={index}
          className="flex-1"
        >
          <PhotoStandIn
            colors={cover.placeholder ?? placeholderFor(cover.recipeId)}
            height={height}
            radius={9}
            uri={cover.thumbnailUrl}
          />
        </MotionItem>
      ))}
    </View>
  );
}

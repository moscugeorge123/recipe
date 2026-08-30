import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { SourceIcon } from '@/components/icons/source-icon';
import { Text } from '@/components/ui/text';
import {
  captureGridMetrics,
  chunkIntoRows,
  type CaptureSource,
} from '@/features/capture/sources';

const TILE_GAP = 10;
const TILE_HEIGHT = 92;

type SourceGridProps = {
  sources: readonly CaptureSource[];
  onSelect: (source: CaptureSource) => void;
};

export function SourceGrid({ sources, onSelect }: SourceGridProps) {
  const [width, setWidth] = useState(0);
  const { columns, tileColumns } = captureGridMetrics(sources.length);
  const rows = chunkIntoRows(sources, columns);
  const tileWidth =
    width > 0
      ? (width - TILE_GAP * (tileColumns - 1)) / tileColumns
      : undefined;

  return (
    <View
      className="gap-2.5"
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && next !== width) {
          setWidth(next);
        }
      }}
    >
      {rows.map((row) => (
        <View
          key={row.join('-')}
          className="flex-row justify-center"
          style={{ gap: TILE_GAP }}
        >
          {row.map((source) => (
            <Pressable
              key={source}
              accessibilityRole="button"
              accessibilityLabel={source}
              onPress={() => onSelect(source)}
              className="items-center justify-center gap-2 rounded-[18px] border border-crust bg-bg-elevated"
              style={{
                width: tileWidth,
                height: TILE_HEIGHT,
                flexGrow: tileWidth ? 0 : 1,
              }}
            >
              <SourceIcon
                source={source}
                size={source === 'YouTube' ? 40 : 32}
              />
              <Text
                className="px-1 text-center text-[12px]"
                tone="icon"
                numberOfLines={2}
              >
                {source}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

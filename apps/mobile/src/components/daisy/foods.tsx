import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { DaisyFoodId } from '@/components/daisy/phase';

type DaisyFoodGlyphProps = {
  id: DaisyFoodId;
  size?: number;
};

export function DaisyFoodGlyph({ id, size = 20 }: DaisyFoodGlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {glyph(id)}
    </Svg>
  );
}

function glyph(id: DaisyFoodId) {
  switch (id) {
    case 'beef':
      return (
        <>
          <Rect x={4} y={7} width={16} height={11} rx={5.5} fill="#C96F6F" />
          <Path
            d="M8 12 Q12 9 16 13"
            stroke="#F3D3C8"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case 'onion':
      return (
        <>
          <Circle cx={12} cy={14} r={7.5} fill="#D9A868" />
          <Path
            d="M12 6.5 L12 2.5"
            stroke="#8CA36B"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="M8.5 14 Q12 9 15.5 14"
            stroke="#B8853F"
            strokeWidth={1.6}
            fill="none"
          />
        </>
      );
    case 'carrot':
      return (
        <>
          <Path d="M12 22 L7.5 9 Q12 4.5 16.5 9 Z" fill="#E08A3C" />
          <Ellipse
            cx={9.5}
            cy={5}
            rx={3}
            ry={1.8}
            fill="#8CA36B"
            transform="rotate(-25 9.5 5)"
          />
          <Ellipse
            cx={14.5}
            cy={5}
            rx={3}
            ry={1.8}
            fill="#8CA36B"
            transform="rotate(25 14.5 5)"
          />
        </>
      );
    case 'chicken':
      return (
        <>
          <Path
            d="M6 13c0-3.4 2.4-7 6-7 2.2 0 3.4 1.5 4.3 1.5 1.3 0 2.3 1.7 1.4 3.3-.6 1.2-1.2 1.4-1.2 2.6 0 2.6-2.6 4.6-5.7 4.6C8 18 6 16 6 13z"
            fill="#E8B48A"
          />
          <Path
            d="M9 10.2c1.5-1 3.6-1.2 4.8.3"
            stroke="#C96F6F"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={16.4} cy={8.6} r={1.3} fill="#C96F6F" />
        </>
      );
    case 'garlic':
      return (
        <>
          <Path
            d="M12 5.2c3 0 6 3.6 6 6.8 0 2.6-2.4 4.6-6 4.6s-6-2-6-4.6c0-3.2 3-6.8 6-6.8z"
            fill="#F3E4CF"
          />
          <Path
            d="M12 6.2c.7 2.4.7 5.4 0 8.8"
            stroke="#D8CCBA"
            strokeWidth={1.2}
            fill="none"
          />
          <Path
            d="M12 3.6c.2 1.1.9 1.5 1.8 1.6"
            stroke="#8CA36B"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'tomato':
      return (
        <>
          <Circle cx={12} cy={13.2} r={6.4} fill="#C96F6F" />
          <Circle cx={10.2} cy={11.4} r={1.5} fill="#E08A3C" />
          <Path
            d="M12 7.4C10.8 5.4 9 5 8.2 5.6 9.8 6.8 10.5 8.4 10.8 9.6"
            stroke="#8CA36B"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M12.2 7.2c.9-1.8 2.6-2.2 3.7-1.5-1.3 1.1-1.7 2.6-1.7 3.9"
            stroke="#8CA36B"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'salt':
      return (
        <>
          <Path
            d="M8 9h8l1.6 10.4H6.4L8 9z"
            fill="#F3E4CF"
            stroke="#D8CCBA"
            strokeWidth={1.1}
          />
          <Path d="M8.4 5.4h7.2L16.6 9H7.4l1-3.6z" fill="#FFEFDC" />
          <Circle cx={10.4} cy={13.2} r={0.7} fill="#3B2A20" />
          <Circle cx={13.2} cy={14.6} r={0.7} fill="#3B2A20" />
          <Circle cx={11.4} cy={16.4} r={0.7} fill="#3B2A20" />
        </>
      );
    case 'chili':
      return (
        <>
          <Path
            d="M8.2 20c-2.2-3.2-2-8.2 1.2-11.2 2.4-2.2 5.8-1.4 6.6.8.6 1.8-.2 3.2-1.2 4.6-1.4 2-2 4.2-1.4 6.4"
            fill="#C25E4C"
          />
          <Path
            d="M10.6 7.2C9.4 4.8 8 4.2 6.8 4.8c1.4 1.2 1.6 3 .8 4.2"
            stroke="#8CA36B"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
  }
}

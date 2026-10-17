import Svg, { Path } from 'react-native-svg';

/**
 * Material glyphs the app's icon font subset doesn't include, drawn as SVG instead.
 * (24×24 viewBox, same shapes as Material Symbols.)
 */
type SvgIconProps = { size: number; color: string };

function Glyph24({
  size,
  color,
  d,
}: SvgIconProps & {
  d: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={d} />
    </Svg>
  );
}

export function OpenInNewIcon(props: SvgIconProps) {
  return (
    <Glyph24
      {...props}
      d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"
    />
  );
}

export function SkipPreviousIcon(props: SvgIconProps) {
  return <Glyph24 {...props} d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />;
}

export function SkipNextIcon(props: SvgIconProps) {
  return <Glyph24 {...props} d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />;
}

import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { C } from '@/tortie/theme';
import { BrandLogo, type Brand } from '@/tortie/ui/brand';
import { Glyph } from '@/tortie/ui/icon';
import {
  Conic,
  DotRow,
  Float,
  Pop,
  PulseHalo,
  Spin,
  Twinkle,
} from '@/tortie/ui/keyframes';
import { T } from '@/tortie/ui/text';

const LOGO = require('../../../assets/tortie/tortie-logo.png');
const TILE_SH = '0 10px 20px -10px rgba(46,49,46,.35), 0 0 0 1px #edeee9';

type Pos = Pick<ViewStyle, 'left' | 'right' | 'top' | 'bottom'> & {
  r?: number;
};

/** Floating emoji tile (prototype `floatT`). */
function FloatTile({ e, st, d }: { e: string; st: Pos; d: number }) {
  const { r = 0, ...pos } = st;
  return (
    <Float ms={3800} delay={d * 1000} style={{ position: 'absolute', ...pos }}>
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: C.white,
          boxShadow: TILE_SH,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T
          style={{
            fontSize: 24,
            lineHeight: 30,
            transform: [{ rotate: `${r}deg` }],
          }}
        >
          {e}
        </T>
      </View>
    </Float>
  );
}

/** Twinkling sparkle (prototype `spark`). */
function Spark({ st, d, sz }: { st: Pos; d: number; sz: number }) {
  return (
    <Twinkle ms={1800} delay={d * 1000} style={{ position: 'absolute', ...st }}>
      <Glyph name="auto_awesome" size={sz} color={C.terraBright} fill />
    </Twinkle>
  );
}

function CircleArt({
  icon,
  iconSize,
  floats,
  sparks,
}: {
  icon: string;
  iconSize: number;
  floats: [string, Pos, number][];
  sparks: [Pos, number, number][];
}) {
  return (
    <View style={{ width: 230, height: 150 }}>
      <View
        style={{
          position: 'absolute',
          left: 55,
          top: 15,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: C.greenWash3,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 55,
          top: 15,
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name={icon} size={iconSize} color={C.green} fill />
      </View>
      {floats.map(([e, st, d]) => (
        <FloatTile key={e + d} e={e} st={st} d={d} />
      ))}
      {sparks.map(([st, d, sz]) => (
        <Spark key={'s' + d} st={st} d={d} sz={sz} />
      ))}
    </View>
  );
}

export function GuestArt() {
  return (
    <CircleArt
      icon="account_circle"
      iconSize={58}
      floats={[
        ['🍝', { left: 10, top: 10, r: -10 }, 0],
        ['🥕', { right: 8, top: 22, r: 9 }, 0.9],
        ['🧄', { left: 22, bottom: 0, r: 7 }, 1.7],
        ['🍋', { right: 26, bottom: -4, r: -6 }, 2.4],
      ]}
      sparks={[
        [{ left: 152, top: 0 }, 0.3, 16],
        [{ left: 4, top: 76 }, 1.2, 12],
      ]}
    />
  );
}

export function GroceryArt() {
  return (
    <CircleArt
      icon="shopping_basket"
      iconSize={54}
      floats={[
        ['🥕', { left: 14, top: 8, r: -10 }, 0],
        ['🍋', { right: 10, top: 26, r: 9 }, 0.9],
        ['🥖', { left: 26, bottom: 0, r: 7 }, 1.7],
        ['🧀', { right: 28, bottom: -4, r: -6 }, 2.4],
      ]}
      sparks={[
        [{ left: 150, top: 0 }, 0.3, 16],
        [{ left: 8, top: 78 }, 1.2, 12],
      ]}
    />
  );
}

function Jar({
  e,
  l,
  t,
  solid,
  d = 0,
}: {
  e: string;
  l: number;
  t: number;
  solid: boolean;
  d?: number;
}) {
  const box: ViewStyle = {
    width: 44,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const glyph = (
    <T
      style={{
        fontSize: 24,
        lineHeight: 30,
        opacity: solid ? 1 : 0.3,
        filter: solid ? undefined : 'grayscale(1)',
      }}
    >
      {e}
    </T>
  );
  if (solid) {
    return (
      <Float
        ms={3600}
        delay={d * 1000}
        style={{ position: 'absolute', left: l, top: t }}
      >
        <View style={[box, { backgroundColor: C.white, boxShadow: TILE_SH }]}>
          {glyph}
        </View>
      </Float>
    );
  }
  return (
    <View
      style={[
        box,
        {
          position: 'absolute',
          left: l,
          top: t,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: C.lineStrong,
        },
      ]}
    >
      {glyph}
    </View>
  );
}

export function PantryArt() {
  return (
    <View style={{ width: 230, height: 150 }}>
      <View
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          top: 68,
          height: 6,
          borderRadius: 3,
          backgroundColor: C.line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          top: 144,
          height: 6,
          borderRadius: 3,
          backgroundColor: C.line,
        }}
      />
      <Jar e="🫙" l={30} t={14} solid={false} />
      <Jar e="🫒" l={93} t={12} solid d={0} />
      <Jar e="🧂" l={156} t={14} solid={false} />
      <Jar e="🍝" l={30} t={90} solid={false} />
      <Jar e="🥫" l={93} t={90} solid={false} />
      <Jar e="🍯" l={156} t={88} solid d={1.4} />
      <Spark st={{ left: 136, top: 4 }} d={0.5} sz={14} />
      <Spark st={{ left: 12, top: 92 }} d={1.4} sz={11} />
    </View>
  );
}

const ART_SH = '0 12px 26px -12px rgba(46,49,46,.4)';

/** Provider tile with a spinning conic ring · dots · floating Tortie logo. */
export function OAuthArt({ brand }: { brand: Brand }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: ART_SH,
        }}
      >
        <Spin
          ms={1400}
          style={{
            position: 'absolute',
            left: -30.4,
            top: -30.4,
            width: 136.8,
            height: 136.8,
          }}
        >
          <Conic size={136.8} />
        </Spin>
        <View
          style={{
            position: 'absolute',
            left: 3,
            top: 3,
            right: 3,
            bottom: 3,
            borderRadius: 21,
            backgroundColor: C.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BrandLogo brand={brand} size={34} />
        </View>
      </View>
      <DotRow size={7} color={C.green} gap={6} />
      <Float
        ms={3200}
        style={{ width: 76, height: 76, borderRadius: 24, boxShadow: ART_SH }}
      >
        <Image
          source={LOGO}
          style={{ width: 76, height: 76, borderRadius: 24 }}
          contentFit="cover"
        />
      </Float>
    </View>
  );
}

export function DoneArt() {
  return (
    <View
      style={{
        width: 200,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PulseHalo
        size={104}
        color={C.greenSoft}
        ms={2000}
        delay={450}
        style={{ position: 'absolute', left: 48, top: 18 }}
      />
      <Pop ms={640}>
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: C.green,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 16px 30px -12px rgba(50,83,60,.55)',
          }}
        >
          <Glyph name="check" size={56} color={C.bg} />
        </View>
      </Pop>
      <Spark st={{ left: 16, top: 8 }} d={0.2} sz={18} />
      <Spark st={{ right: 14, top: 30 }} d={0.8} sz={14} />
      <Spark st={{ left: 34, bottom: 6 }} d={1.3} sz={12} />
      <Spark st={{ right: 36, bottom: 0 }} d={0.5} sz={11} />
    </View>
  );
}

export const TORTIE_LOGO = LOGO;

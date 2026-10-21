import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { startPhotoImport } from '@/tortie/data/import-engine';
import { useFrame } from '@/tortie/frame';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { mono, sans, T } from '@/tortie/ui/text';
import { useT } from '@/i18n';

const FROST = 'rgba(40,44,40,.55)';
const CORNER = 34;
/** Text stays legible at this quality and a page photo stays well under the API's 10 MB cap. */
const PHOTO_QUALITY = 0.6;

/** Full-bleed page scanner: opacity 0→1 (280ms) + scale 1.04→1 (520ms × m, EASE). */
export function ScanCamera() {
  const tr = useT();
  const f = useFrame();
  const { m } = useMotion();
  const open = useNav((s) => s.cam);
  const [perm, requestPerm] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [torch, setTorch] = useState(false);
  const [face, setFace] = useState<'back' | 'front'>('back');
  const nonce = useRef(0);
  const granted0 = useRef(false);
  useEffect(() => {
    granted0.current = !!perm?.granted;
  }, [perm]);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setShot(null);
      setErr(false);
      setTorch(false);
    } else setLive(false);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      let granted = granted0.current;
      if (!granted) {
        try {
          granted = (await requestPerm()).granted;
        } catch {
          granted = false;
        }
      }
      if (!alive) return;
      if (granted) setLive(true);
      else setErr(true);
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, requestPerm]);

  const capture = async () => {
    const n = ++nonce.current;
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 90);
    setShot('none');
    try {
      const pic = await ref.current?.takePictureAsync({
        quality: PHOTO_QUALITY,
      });
      if (pic?.uri && nonce.current === n) setShot(pic.uri);
    } catch {
      /* keeps the live feed behind "Looks good?", like the prototype's failed capture */
    }
  };

  const library = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: PHOTO_QUALITY,
      });
      const uri = res.canceled ? null : res.assets[0]?.uri;
      if (uri) {
        nonce.current++;
        setShot(uri);
      }
    } catch {
      toast(tr('scan.couldntOpenYourPhoto'));
    }
  };

  const close = () => useNav.getState().closeCam(true);
  const hasShot = !!shot;
  const imgOn = !!shot && shot !== 'none';
  const use = () => {
    if (!imgOn) return;
    // The sheet reopens on the running import, so its progress is the first thing seen.
    useNav.setState({ addJobId: startPhotoImport([shot]) });
    useNav.getState().closeCam(true);
  };
  const showErr = err && !imgOn;

  const root = useAnimatedStyle(() => ({
    opacity: tw(open ? 1 : 0, 280, CSS_EASE),
    transform: [{ scale: tw(open ? 1 : 1.04, Math.round(520 * m), EASE) }],
  }));
  const frame = useAnimatedStyle(() => ({
    opacity: tw(hasShot ? 0 : 1, 240, CSS_EASE),
  }));
  const flash = useAnimatedStyle(() => ({
    opacity: tw(flashOn ? 0.9 : 0, 260, CSS_EASE),
  }));

  const top = f.top;
  const base = Math.max(34, f.bottom) - 34;

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 60, backgroundColor: C.camera, overflow: 'hidden' },
        root,
      ]}
    >
      {live ? (
        <CameraView
          ref={ref}
          style={StyleSheet.absoluteFill}
          facing={face}
          enableTorch={torch}
          animateShutter={false}
          onMountError={() => setErr(true)}
        />
      ) : null}
      {showErr ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <DarkStripes />
          <T
            style={[
              mono(11, '#8a918a'),
              { textAlign: 'center', lineHeight: 17.6 },
            ]}
          >
            {tr('scan.cameraPreviewAllowCamera')}
          </T>
        </View>
      ) : null}
      {imgOn ? (
        <Image
          source={{ uri: shot }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 28,
            right: 28,
            top: top + 72,
            bottom: 250 + base,
          },
          frame,
        ]}
      >
        <Corner
          pos={{
            left: 0,
            top: 0,
            borderLeftWidth: 3,
            borderTopWidth: 3,
            borderTopLeftRadius: 18,
          }}
        />
        <Corner
          pos={{
            right: 0,
            top: 0,
            borderRightWidth: 3,
            borderTopWidth: 3,
            borderTopRightRadius: 18,
          }}
        />
        <Corner
          pos={{
            left: 0,
            bottom: 0,
            borderLeftWidth: 3,
            borderBottomWidth: 3,
            borderBottomLeftRadius: 18,
          }}
        />
        <Corner
          pos={{
            right: 0,
            bottom: 0,
            borderRightWidth: 3,
            borderBottomWidth: 3,
            borderBottomRightRadius: 18,
          }}
        />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,.5)', 'rgba(0,0,0,0)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: top + 92,
        }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.65)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 260 + base,
        }}
      />

      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Frost
          onPress={close}
          label={tr('scan.closeCamera')}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        >
          <Glyph name="close" size={24} color={C.bg} />
        </Frost>
        <View
          style={{
            height: 34,
            paddingHorizontal: 14,
            borderRadius: 99,
            overflow: 'hidden',
            justifyContent: 'center',
          }}
        >
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: FROST }]} />
          <T style={sans(13, 600, C.bg)}>
            {hasShot ? tr('scan.looksGood') : tr('common.scanAPage')}
          </T>
        </View>
        <Frost
          onPress={() => setTorch((v) => !v)}
          label={tr('scan.flash')}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        >
          <Glyph
            name={torch ? 'flash_on' : 'flash_off'}
            size={22}
            color={torch ? C.flashOn : C.bg}
          />
        </Frost>
      </View>

      {!hasShot ? (
        <>
          <T
            pointerEvents="none"
            style={[
              sans(14, 600, C.bg),
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 204 + base,
                textAlign: 'center',
                textShadowColor: 'rgba(0,0,0,.5)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 8,
              },
            ]}
          >
            {tr('scan.fitTheRecipePage')}
          </T>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 64 + base,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 36,
            }}
          >
            <Frost
              onPress={() => void library()}
              label={tr('scan.chooseFromLibrary')}
              style={{ width: 48, height: 48, borderRadius: 14 }}
            >
              <Glyph name="photo_library" size={24} color={C.bg} />
            </Frost>
            <Press
              onPress={() => void capture()}
              scale={0.9}
              ms={160}
              easing={CSS_EASE}
              accessibilityLabel={tr('scan.takePhoto')}
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                borderWidth: 4,
                borderColor: C.bg,
                padding: 4,
              }}
            >
              <View
                style={{ flex: 1, borderRadius: 99, backgroundColor: C.bg }}
              />
            </Press>
            <Frost
              onPress={() => setFace((v) => (v === 'back' ? 'front' : 'back'))}
              label={tr('scan.switchCamera')}
              style={{ width: 48, height: 48, borderRadius: 24 }}
            >
              <Glyph name="flip_camera_ios" size={24} color={C.bg} />
            </Frost>
          </View>
        </>
      ) : (
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 48 + base,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <Frost
            onPress={() => {
              nonce.current++;
              setShot(null);
            }}
            bg="rgba(40,44,40,.6)"
            style={{
              flex: 1,
              height: 54,
              borderRadius: 99,
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Glyph name="refresh" size={20} color={C.bg} />
            <T style={sans(15, 700, C.bg)}>{tr('scan.retake')}</T>
          </Frost>
          <Press
            onPress={use}
            disabled={!imgOn}
            accessibilityLabel="Read recipe"
            scale={0.97}
            easing={CSS_EASE}
            style={{
              flex: 1.4,
              height: 54,
              borderRadius: 99,
              backgroundColor: C.bg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Glyph name="auto_awesome" size={20} color={C.ink} />
            <T style={sans(15, 700)}>{tr('scan.readRecipe')}</T>
          </Press>
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, flash]}
      />
    </Animated.View>
  );
}

/** Round/rounded button on `rgba(40,44,40,.55)` + blur(12). No press state in the prototype. */
function Frost({
  onPress,
  label,
  style,
  bg = FROST,
  children,
}: {
  onPress: () => void;
  label?: string;
  style: ViewStyle;
  bg?: string;
  children: ReactNode;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      {children}
    </Press>
  );
}

function Corner({ pos }: { pos: ViewStyle }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          width: CORNER,
          height: CORNER,
          borderColor: C.bg,
        },
        pos,
      ]}
    />
  );
}

/** `repeating-linear-gradient(135deg, #1c1f1c 0 14px, #232723 14px 28px)`. */
function DarkStripes() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern
          id="camStripes"
          patternUnits="userSpaceOnUse"
          width={28}
          height={28}
          patternTransform="rotate(45)"
        >
          <Rect x={0} y={0} width={14} height={28} fill="#1c1f1c" />
          <Rect x={14} y={0} width={14} height={28} fill="#232723" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#camStripes)" />
    </Svg>
  );
}

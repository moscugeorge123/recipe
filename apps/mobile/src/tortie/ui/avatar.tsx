import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTortieAuth } from '@/tortie/auth-store';
import { avatarSource, type AvatarSource } from '@/tortie/lib/user-display';
import { C } from '@/tortie/theme';
import { sans, serif, T } from '@/tortie/ui/text';

/** The signed-in user's avatar source (picture or initials). Reuse it for any custom avatar UI. */
export function useAvatarSource(): AvatarSource {
  const user = useTortieAuth((s) => s.user);
  return avatarSource(user);
}

/**
 * Round avatar for the signed-in user: their picture, or initials on the
 * brand circle while it loads, fails to load, or when none is set. Sized by
 * `size`; pass `style` for rings and shadows. Used by Profile and meant for the
 * profile button on every tab.
 */
export function Avatar({
  size,
  serifInitials = false,
  style,
  source,
}: {
  size: number;
  /** Large profile header uses the serif face for initials. */
  serifInitials?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Override when the caller already has the source. */
  source?: AvatarSource;
}) {
  const own = useAvatarSource();
  const src = source ?? own;
  const uri = src.kind === 'photo' ? src.uri : null;
  // Remember which uri failed, so a new picture gets a fresh attempt.
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = uri !== null && failed !== uri;
  const fontSize = Math.round(size * (serifInitials ? 0.4 : 0.37));
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: C.green,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <T
        style={
          serifInitials ? serif(fontSize, 500, C.bg) : sans(fontSize, 700, C.bg)
        }
      >
        {src.initials}
      </T>
      {showPhoto ? (
        <Image
          source={{ uri }}
          cachePolicy="disk"
          transition={150}
          onError={() => setFailed(uri)}
          style={{ position: 'absolute', width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTortieAuth } from '@/tortie/auth-store';
import { useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';

/** Up to two initials for the avatar, "?" when there is no name. */
export function profileInitials(name: string | null | undefined): string {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Round avatar that opens Profile. The same button sits at the right end of
 * every tab header and shrinks with it (40 -> 30 px) when the header goes
 * compact.
 */
export function ProfileButton({ compact }: { compact: boolean }) {
  const authed = useTortieAuth((s) => s.authed);
  const user = useTortieAuth((s) => s.user);
  const openProfile = useNav((s) => s.openProfile);
  const initials = profileInitials(user?.name);
  const size = useAnimatedStyle(() => ({
    width: tw(compact ? 30 : 40, 220, CSS_EASE),
    height: tw(compact ? 30 : 40, 220, CSS_EASE),
  }));

  return (
    <Press
      onPress={openProfile}
      scale={0.88}
      ms={220}
      easing={SPRING}
      accessibilityLabel="Profile"
      style={{ borderRadius: 99 }}
    >
      {authed ? (
        <Animated.View
          style={[
            {
              borderRadius: 99,
              backgroundColor: C.green,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: SH.avatarRing,
            },
            size,
          ]}
        >
          <T
            style={[
              sans(initials.length > 1 ? 13 : 16, 700, C.bg),
              { textAlign: 'center', width: '100%' },
            ]}
          >
            {initials}
          </T>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            {
              borderRadius: 99,
              backgroundColor: C.surface3,
              alignItems: 'center',
              justifyContent: 'center',
            },
            size,
          ]}
        >
          <Glyph name="person" size={22} color={C.green} fill />
        </Animated.View>
      )}
    </Press>
  );
}

import '../global.css';

import {
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CaptureSheet } from '@/components/capture/capture-sheet';
import { KeyboardDock } from '@/components/ui/keyboard-dock';
import { Toast } from '@/components/ui/toast';
import { prefetchHomeQueries } from '@/features/home/prefetch';
import { useKitchenMigration } from '@/features/kitchen/use-kitchen-migration';
import { usePendingSyncFlush } from '@/features/kitchen/use-pending-sync';
import { useLockWebDocumentScroll } from '@/lib/keyboard';
import { stackPushAnimation, useReducedMotion } from '@/lib/motion';
import { QueryProvider } from '@/lib/query-provider';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
void prefetchHomeQueries();

const FONT_LOAD_TIMEOUT_MS = 2_000;

function usePreferencesHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    usePreferencesStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsub = usePreferencesStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (usePreferencesStore.persist.hasHydrated()) {
      queueMicrotask(() => setHydrated(true));
    }
    return unsub;
  }, []);

  return hydrated;
}

function KitchenDataHost() {
  useKitchenMigration();
  usePendingSyncFlush();
  return null;
}

function OnboardingGate() {
  const hasOnboarded = usePreferencesStore((state) => state.hasOnboarded);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inOnboarding = segments[0] === 'onboarding';
    if (!hasOnboarded && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [hasOnboarded, segments, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [fontsGaveUp, setFontsGaveUp] = useState(false);
  const prefsHydrated = usePreferencesHydrated();
  const ready = (fontsLoaded || fontsGaveUp) && prefsHydrated;
  const toast = useUiStore((state) => state.toast);
  const hideToast = useUiStore((state) => state.hideToast);
  const reducedMotion = useReducedMotion();
  const pushAnimation = stackPushAnimation(reducedMotion);
  useLockWebDocumentScroll();

  useEffect(() => {
    if (fontsLoaded) {
      return;
    }
    const id = setTimeout(() => setFontsGaveUp(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [fontsLoaded]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const id = setTimeout(() => hideToast(), toast.action ? 7000 : 2600);
    return () => clearTimeout(id);
  }, [toast, hideToast]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryProvider>
        <KitchenDataHost />
        {ready ? (
          <KeyboardDock>
            <OnboardingGate />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: pushAnimation,
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="search" />
              <Stack.Screen name="shop" />
              <Stack.Screen name="pantry" />
              <Stack.Screen name="groceries/add" />
              <Stack.Screen name="plan/add" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="collection/[id]" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen name="recipe/[id]/edit" />
              <Stack.Screen name="recipe/[id]/history" />
              <Stack.Screen name="recipe/[id]/revision/[revisionId]" />
              <Stack.Screen name="import/preview" />
              <Stack.Screen name="import/extract/[jobId]" />
              <Stack.Screen name="import/review/[id]" />
              <Stack.Screen name="import/error" />
              <Stack.Screen name="import/manual" />
              <Stack.Screen name="cook/[id]/index" />
              <Stack.Screen name="cook/[id]/step" />
              <Stack.Screen name="cook/[id]/complete" />
              <Stack.Screen
                name="+not-found"
                options={{ title: 'Not found' }}
              />
            </Stack>
            <CaptureSheet />
            <Toast toast={toast} />
            <StatusBar style="dark" />
          </KeyboardDock>
        ) : null}
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
  },
});

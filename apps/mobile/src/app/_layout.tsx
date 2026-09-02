import '../global.css';

import {
  Inter_300Light,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CaptureSheet } from '@/components/capture/capture-sheet';
import { Toast } from '@/components/ui/toast';
import { prefetchHomeQueries } from '@/features/home/prefetch';
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
      setHydrated(true);
    }
    return unsub;
  }, []);

  return hydrated;
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
    Inter_300Light,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontsGaveUp, setFontsGaveUp] = useState(false);
  const prefsHydrated = usePreferencesHydrated();
  const ready = (fontsLoaded || fontsGaveUp) && prefsHydrated;
  const toast = useUiStore((state) => state.toast);
  const hideToast = useUiStore((state) => state.hideToast);

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
    const id = setTimeout(() => hideToast(), 2600);
    return () => clearTimeout(id);
  }, [toast, hideToast]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryProvider>
        {ready ? (
          <>
            <OnboardingGate />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="search" />
              <Stack.Screen name="shop" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen name="import/preview" />
              <Stack.Screen name="import/extract/[jobId]" />
              <Stack.Screen name="import/review/[id]" />
              <Stack.Screen name="import/error" />
              <Stack.Screen name="import/manual" />
              <Stack.Screen name="cook/[id]/index" />
              <Stack.Screen name="cook/[id]/step" />
              <Stack.Screen name="cook/[id]/complete" />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
            <CaptureSheet />
            <Toast toast={toast} />
            <StatusBar style="dark" />
          </>
        ) : null}
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});

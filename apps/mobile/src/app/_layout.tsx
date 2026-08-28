import '../global.css';

import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CaptureSheet } from '@/components/capture/capture-sheet';
import { Toast } from '@/components/ui/toast';
import { QueryProvider } from '@/lib/query-provider';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  const [loaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });
  const toast = useUiStore((state) => state.toast);
  const hideToast = useUiStore((state) => state.hideToast);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loaded]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const id = setTimeout(() => hideToast(), 2600);
    return () => clearTimeout(id);
  }, [toast, hideToast]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryProvider>
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
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});

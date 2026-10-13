import '../global.css';

import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { LogBox, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { prefetchHomeQueries } from '@/features/home/prefetch';
import { useKitchenMigration } from '@/features/kitchen/use-kitchen-migration';
import { usePendingSyncFlush } from '@/features/kitchen/use-pending-sync';
import { ShareRoot } from '@/features/share/share-provider';
import { QueryProvider } from '@/lib/query-provider';
import { useUiStore } from '@/stores/ui-store';
import { useNav } from '@/tortie/nav-store';
import { C } from '@/tortie/theme';

if (__DEV__) LogBox.ignoreAllLogs();

SplashScreen.preventAutoHideAsync().catch(() => undefined);
void prefetchHomeQueries();

const FONT_LOAD_TIMEOUT_MS = 2_000;

function KitchenDataHost() {
  useKitchenMigration();
  usePendingSyncFlush();
  return null;
}

/** Existing data hooks report through `useUiStore`; show those in the Tortie toast. */
function ToastBridge() {
  useEffect(
    () =>
      useUiStore.subscribe((s, prev) => {
        if (s.toast && s.toast !== prev.toast)
          useNav.getState().toastShow(s.toast.text);
      }),
    [],
  );
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_500Medium,
    MaterialSymbolsOutlined: require('../../assets/fonts/MaterialSymbolsOutlined.ttf'),
    MaterialSymbolsOutlinedFill: require('../../assets/fonts/MaterialSymbolsOutlinedFill.ttf'),
  });
  const [fontsGaveUp, setFontsGaveUp] = useState(false);
  const ready = fontsLoaded || fontsGaveUp;

  useEffect(() => {
    if (fontsLoaded) return;
    const id = setTimeout(() => setFontsGaveUp(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [fontsLoaded]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <ShareRoot>
      <GestureHandlerRootView style={styles.root}>
        <QueryProvider>
          <KitchenDataHost />
          <ToastBridge />
          {ready ? (
            <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
          ) : null}
        </QueryProvider>
      </GestureHandlerRootView>
    </ShareRoot>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});

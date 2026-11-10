import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Only the weights the design uses (importing a family's index would bundle every weight).
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { NotoSansArmenian_400Regular } from '@expo-google-fonts/noto-sans-armenian/400Regular';
import { NotoSansArmenian_500Medium } from '@expo-google-fonts/noto-sans-armenian/500Medium';
import { NotoSansArmenian_700Bold } from '@expo-google-fonts/noto-sans-armenian/700Bold';
import { NotoSerifArmenian_500Medium } from '@expo-google-fonts/noto-serif-armenian/500Medium';
import { NotoSerifArmenian_600SemiBold } from '@expo-google-fonts/noto-serif-armenian/600SemiBold';
import { queryClient } from '@/api/queries';
import { api } from '@/api';
import { restoreSession } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useLangStore } from '@/i18n';
import { colors } from '@/theme/tokens';
import { ToastHost } from '@/components/ui/Toast';
import { CelebrationHost } from '@/components/Celebration';
import { configureNotifications } from '@/lib/notifications';

void SplashScreen.preventAutoHideAsync().catch(() => {});
void SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
configureNotifications();

// Refetch stale queries when the app returns to the foreground.
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold, Fraunces_500Medium_Italic,
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_700Bold,
    NotoSansArmenian_400Regular, NotoSansArmenian_500Medium, NotoSansArmenian_700Bold,
    NotoSerifArmenian_500Medium, NotoSerifArmenian_600SemiBold,
  });
  const [booted, setBooted] = useState(false);
  const lang = useLangStore((s) => s.lang);

  useEffect(() => {
    (async () => {
      await usePrefs.getState().load();
      await restoreSession();
      if (usePrefs.getState().analytics) api.content.analyticsVisit().catch(() => {});
    })().finally(() => setBooted(true));
  }, []);

  // A tapped calendar reminder opens the screen it points to (only in-app paths).
  useEffect(() => {
    if (!booted) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync?.().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [booted]);

  // Server content is localized: refetch everything when the language changes.
  useEffect(() => {
    if (booted) void queryClient.invalidateQueries();
  }, [lang, booted]);

  const ready = booted && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="games/catch" options={{ gestureEnabled: false }} />
          </Stack>
          <CelebrationHost />
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Per-weight entry points: only these four Sora files are bundled (Aurora tops out at 700).
import { Sora_400Regular } from '@expo-google-fonts/sora/400Regular';
import { Sora_500Medium } from '@expo-google-fonts/sora/500Medium';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { AppStoreProvider } from '../store/AppStore';
import { AuthProvider } from '../store/Auth';
import { CountryProvider } from '../lib/country';
import { LanguageProvider } from '../i18n';
import { LocationProvider } from '../lib/location';
import { SavedPlacesProvider } from '../lib/savedPlaces';
import { isAdminSite } from '../lib/site';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Web pages are pre-rendered to HTML (for search engines), where fonts never "load":
  // render right away there and let the browser swap the fonts in.
  if (!loaded && !error && Platform.OS !== 'web') return <View style={{ flex: 1, backgroundColor: colors.ivory100 }} />;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
      <AuthProvider>
        <CountryProvider>
        <LocationProvider>
        <SavedPlacesProvider>
        <AppStoreProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory100 } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="verificado" />
            <Stack.Screen name="nueva-clave" />
            <Stack.Screen name="recarga" />
            {/* The admin website only exposes the console. */}
            <Stack.Protected guard={!isAdminSite}>
              <Stack.Screen name="passenger" />
              <Stack.Screen name="driver" />
              <Stack.Screen name="demo" />
              <Stack.Screen name="colombia" />
              <Stack.Screen name="design" />
              {/* Public search landing pages (customer site only). */}
              <Stack.Screen name="taxi-pereira" />
              <Stack.Screen name="taxi-aeropuerto-matecana" />
              <Stack.Screen name="taxi-dosquebradas" />
              <Stack.Screen name="conductores-pereira" />
            </Stack.Protected>
          </Stack>
        </AppStoreProvider>
        </SavedPlacesProvider>
        </LocationProvider>
        </CountryProvider>
      </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

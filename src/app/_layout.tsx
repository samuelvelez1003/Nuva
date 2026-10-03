import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
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
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.midnight }} />;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
      <AuthProvider>
        <CountryProvider>
        <LocationProvider>
        <SavedPlacesProvider>
        <AppStoreProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.midnight } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="verificado" />
            <Stack.Screen name="recarga" />
            {/* The admin website only exposes the console. */}
            <Stack.Protected guard={!isAdminSite}>
              <Stack.Screen name="passenger" />
              <Stack.Screen name="driver" />
              <Stack.Screen name="demo" />
              <Stack.Screen name="colombia" />
              <Stack.Screen name="curazao" />
              <Stack.Screen name="design" />
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

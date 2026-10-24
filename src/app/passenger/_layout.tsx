import React from 'react';
import { Stack } from 'expo-router';
import { PhoneFrame } from '../../components/device/PhoneFrame';
import { colors } from '../../theme/tokens';

export default function PassengerLayout() {
  return (
    <PhoneFrame>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.ivory100 },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ride" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </PhoneFrame>
  );
}

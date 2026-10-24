import React from 'react';
import { Stack } from 'expo-router';
import { PhoneFrame } from '../../components/device/PhoneFrame';
import { colors } from '../../theme/tokens';

export default function DriverLayout() {
  return (
    <PhoneFrame initialTone="light">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.midnight },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="ride" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack>
    </PhoneFrame>
  );
}

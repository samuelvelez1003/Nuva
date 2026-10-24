import React from 'react';
import { Redirect } from 'expo-router';

/** Old address of the Colombian site: the landing page now lives at "/". */
export default function ColombiaPage() {
  return <Redirect href="/" />;
}

import React from 'react';
import { router } from 'expo-router';
import { AuthForm } from '../../components/auth/AuthForm';

export default function PassengerAuth() {
  return <AuthForm role="passenger" onDone={() => router.replace('/passenger/home')} />;
}

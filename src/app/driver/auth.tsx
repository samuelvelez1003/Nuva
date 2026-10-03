import React from 'react';
import { router } from 'expo-router';
import { AuthForm } from '../../components/auth/AuthForm';

export default function DriverAuth() {
  return <AuthForm role="driver" onDone={() => router.replace('/driver')} />;
}

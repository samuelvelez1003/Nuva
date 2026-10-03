// Native: persistent localStorage backed by SQLite (recommended by Expo for Supabase sessions).
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;

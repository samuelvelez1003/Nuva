import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** base64 → bytes (atob exists in Hermes and in browsers). */
function decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The server's refusal when the identity selfie is due (accept_ride). */
export const isSelfieError = (message: string) => /selfie/i.test(message);

/**
 * Identity check: the driver takes a selfie with the front camera (on the web the
 * browser's camera / file picker), it goes to their own folder in the private
 * "selfies" bucket and record_selfie marks the check done. An admin reviews it
 * against the profile photo. Resolves with the check time, or null if cancelled.
 */
export async function takeIdentitySelfie(userId: string): Promise<string | null> {
  if (!supabase) throw new Error('Backend no configurado');

  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Permite el acceso a la cámara para tomarte la selfie');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error('No pudimos leer la foto. Intenta de nuevo');
  const path = `${userId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('selfies').upload(path, decode(asset.base64), { contentType: asset.mimeType ?? 'image/jpeg' });
  if (upErr) throw new Error('No se pudo subir la selfie. Intenta de nuevo');
  const { data, error } = await supabase.rpc('record_selfie', { p_path: path });
  if (error) throw new Error(error.message);
  return (data as string) ?? new Date().toISOString();
}

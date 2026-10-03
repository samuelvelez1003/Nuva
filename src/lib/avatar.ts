import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** base64 → bytes (atob exists in Hermes and in browsers). */
function decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Lets the user pick a square photo from the gallery (or take one), uploads it
 * to their own folder in the "avatars" bucket and saves it on their profile.
 * Resolves with the new URL, or null if the user cancelled.
 */
export async function pickAndUploadAvatar(userId: string, source: 'library' | 'camera' = 'library'): Promise<string | null> {
  if (!supabase) throw new Error('Backend no configurado');

  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === 'camera' ? 'Permite el acceso a la cámara para tomar tu foto' : 'Permite el acceso a tus fotos para elegir una');

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error('No pudimos leer la foto. Prueba con otra');
  const type = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  // New file name each time so phones don't show a cached old photo.
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from('avatars').upload(path, decode(asset.base64), { contentType: type, upsert: true });
  if (upErr) throw new Error('No se pudo subir la foto. Intenta de nuevo');
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.rpc('set_my_avatar', { p_url: url });
  if (error) throw new Error(error.message);
  return url;
}

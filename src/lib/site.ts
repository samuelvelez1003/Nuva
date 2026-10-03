/**
 * Which website this web build is. Set at export time:
 *   (default)                → customer site  (nuva.expo.app)
 *   EXPO_PUBLIC_SITE=admin   → admin console  (admin alias)
 * Native apps ignore it.
 */
export const SITE: 'customer' | 'admin' = process.env.EXPO_PUBLIC_SITE === 'admin' ? 'admin' : 'customer';
export const isAdminSite = SITE === 'admin';

export const CUSTOMER_URL = 'https://nuva.expo.app';

/** Direct .apk file of the latest Android build (downloads immediately). Update after each build. */
export const ANDROID_APK_URL = 'https://expo.dev/artifacts/eas/IKjDwpxQNSoPecNu_lCe_tzZ5uivYhPFI0jr2w2Rf8c.apk';
export const ADMIN_URL = 'https://nuva--admin.expo.app';

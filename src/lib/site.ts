/**
 * Which website this web build is. Set at export time:
 *   (default)                → customer site  (nuva.expo.app)
 *   EXPO_PUBLIC_SITE=admin   → admin console  (admin alias)
 * Native apps ignore it.
 */
export const SITE: 'customer' | 'admin' = process.env.EXPO_PUBLIC_SITE === 'admin' ? 'admin' : 'customer';
export const isAdminSite = SITE === 'admin';

export const CUSTOMER_URL = 'https://nuva.expo.app';

/**
 * Direct .apk file of the latest Android build (downloads immediately). Fixed link:
 * the GitHub Actions workflow (.github/workflows/android-apk.yml) publishes every
 * new build as the latest release of the public nuva-app repo.
 */
export const ANDROID_APK_URL = 'https://github.com/samuelvelez1003/nuva-app/releases/latest/download/nuva.apk';
export const ADMIN_URL = 'https://nuva--admin.expo.app';

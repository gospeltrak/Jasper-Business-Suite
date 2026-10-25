import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Orvix native shell for Android and (later) iOS.
 *
 * IMPORTANT: Keep this as a packaged local build. Adding server.url with
 * https://orvix.africa makes a cold offline start impossible.
 *
 * The native API transport forwards authenticated /api/* traffic to the
 * production HTTPS backend; Supabase still uses its configured HTTPS URL.
 * Web and installed PWAs do not use this transport or native offline writes.
 */
const config: CapacitorConfig = {
  appId: 'africa.orvix.app',
  appName: 'Orvix',
  webDir: 'dist/native-web',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};
export default config;

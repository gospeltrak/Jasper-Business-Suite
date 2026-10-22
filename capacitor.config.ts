import type { CapacitorConfig } from '@capacitor/cli';

// Single shared APK for every tenant (per explicit decision): the native
// shell always loads the live site at orvix.africa -- the exact same code
// and login flow the web/PWA uses -- so there is nothing to rebuild or
// re-point per tenant. Tenant branding (logo, business name) is applied
// inside the app after login, the same way the PWA already does it; only
// the home-screen app icon/name stay generic ("Orvix") for every install.
const config: CapacitorConfig = {
  appId: 'africa.orvix.app',
  appName: 'Orvix',
  webDir: 'dist',
  server: {
    url: 'https://orvix.africa',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;

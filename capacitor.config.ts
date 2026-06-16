import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper for the Play Store build. Web/PWA stays the source of truth; this only
// packages the built web app (www/, see scripts/build-www.mjs) into an Android shell so
// native Google Play Games works. appId is permanent — must match Play Console.
const config: CapacitorConfig = {
  appId: 'com.planeflow.game',
  appName: 'PlaneFlow: Air Traffic Control',
  webDir: 'www',
};

export default config;

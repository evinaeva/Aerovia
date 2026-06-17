import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper for the Play Store build. Web/PWA stays the source of truth; this only
// packages the built web app (www/, see scripts/build-www.mjs) into an Android shell so
// native Google Play Games works. appId is permanent — must match Play Console.
const config: CapacitorConfig = {
  appId: 'com.planeflow.game',
  appName: 'PlaneFlow: Air Traffic Control',
  webDir: 'www',
  plugins: {
    // Capgo OTA: код игры (HTML/CSS/JS — у нас это вся игра) обновляется «по воздуху»
    // из канала в обход стора. autoUpdate (дефолт) проверяет канал и применяет бандл в фоне;
    // в старте обязателен notifyAppReady() (src/game/13-init.js), иначе плагин через ~10с
    // откатит бандл. Бандлы льёт CI (.github/workflows/deploy.yml) на каждый push в main.
    CapacitorUpdater: {
      autoUpdate: true,
    },
  },
};

export default config;

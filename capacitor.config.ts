import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper for the Play Store build. Web/PWA stays the source of truth; this only
// packages the built web app (www/, see scripts/build-www.mjs) into an Android shell so
// native Google Play Games works. appId is permanent — must match Play Console.
const config: CapacitorConfig = {
  appId: 'com.planeflow.game',
  appName: 'PlaneFlow: Air Traffic Control',
  webDir: 'www',
  plugins: {
    // OTA (self-host): код игры (HTML/CSS/JS — у нас это вся игра) обновляется «по воздуху» в обход
    // стора. autoUpdate проверяет updateUrl и применяет бандл в фоне; в старте обязателен
    // notifyAppReady() (src/game/13-init.js), иначе плагин через ~10с откатит бандл. Бэкенд — свой
    // VPS (Caddy + responder + статика бандлов), НЕ облако Capgo. CI на каждый push в main зипует
    // www/ и заливает бандл (.github/workflows/deploy.yml). stats/channel указывают на свой домен
    // (no-op), чтобы плагин не ходил в облако Capgo. Детали: docs/capgo-self-host-migration.md.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl:  'https://capgo.jevgenia.com/updates',
      channelUrl: 'https://capgo.jevgenia.com/channel_self',
      statsUrl:   'https://capgo.jevgenia.com/stats',
    },
  },
};

export default config;

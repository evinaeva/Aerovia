import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper for the Play Store build. Web/PWA stays the source of truth; this only
// packages the built web app (www/, see scripts/build-www.mjs) into an Android shell so
// native Google Play Games works. appId is permanent — must match Play Console.
//
// prod ⟂ dev: set OTA_CHANNEL=dev at build time to produce a SEPARATE dev app that installs
// alongside prod (own appId) and pulls OTA from the dev channel. Defaults to prod when unset,
// so existing prod builds/CI are unchanged. See docs/dev-environment.md.
const isDev = process.env.OTA_CHANNEL === 'dev';
const OTA_BASE = 'https://capgo.jevgenia.com';

const config: CapacitorConfig = {
  // Distinct appId → both apps coexist on one device. Permanent per build flavor; must match Play Console.
  appId:   isDev ? 'com.planeflow.game.dev' : 'com.planeflow.game',
  appName: isDev ? 'PlaneFlow (Dev)'        : 'PlaneFlow: Air Traffic Control',
  webDir: 'www',
  plugins: {
    // OTA (self-host): код игры (HTML/CSS/JS — у нас это вся игра) обновляется «по воздуху» в обход
    // стора. autoUpdate проверяет updateUrl и применяет бандл в фоне; в старте обязателен
    // notifyAppReady() (src/game/13-init.js), иначе плагин через ~10с откатит бандл. Бэкенд — свой
    // VPS (Caddy + responder + статика бандлов), НЕ облако Capgo. CI на каждый push зипует www/ и
    // заливает бандл: push в main → прод-канал (/updates), push в dev → дев-канал (/updates/dev).
    // stats/channel указывают на свой домен (no-op), чтобы плагин не ходил в облако Capgo.
    // Детали: docs/capgo-self-host-migration.md и docs/dev-environment.md.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl:  isDev ? `${OTA_BASE}/updates/dev` : `${OTA_BASE}/updates`,
      channelUrl: `${OTA_BASE}/channel_self`,
      statsUrl:   `${OTA_BASE}/stats`,
    },
  },
};

export default config;

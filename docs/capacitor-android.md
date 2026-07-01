# Capacitor — Android-сборка и тест Play Games

> Как собрать APK из веб-игры и проверить нативный Play Games на телефоне (шаги 1/3/4
> миграции). Состояние PGS и все ID — [`play-games-setup.md`](play-games-setup.md); план —
> [`backlog.md`](backlog.md) (раздел «Переход на Capacitor + Capgo»).

## Что уже в репозитории
- `capacitor.config.ts` — appId `com.planeflow.game`, appName `PlaneFlow: Air Traffic Control`, webDir `www`.
- `src/game/12b-native-play-games.ts` — **мост**: на нативной платформе свопает
  `Account.authProvider` + `Leaderboard.provider` и зеркалит разблокировку медалей (`ACH`) в
  Play Games; на вебе/PWA — no-op (mock-провайдеры остаются).
- `npm run build:www` — собирает `www/` (index.html + assets + manifest + sw) для Capacitor.
- `@capgo/capacitor-updater` (OTA) — в `package.json`; блок `CapacitorUpdater` в
  `capacitor.config.ts`, `notifyAppReady()` в `src/game/13-init.js`, выгрузка бандла в
  `deploy.yml`. Подключение облака — раздел «Capgo OTA» ниже.
- Зависимости Capacitor + плагины — в `package.json` (Capacitor **5.x** под плагин
  `@openforge/capacitor-game-connect`).

`android/` и `www/` — генерируемые, в `.gitignore`.

## Разовая настройка (на машине с Android Studio)

Android Studio несёт встроенный JDK (JBR 21) и Android SDK — отдельный JDK ставить не нужно.

    npm install
    npm run build:www          # www/ с index.html, где ЕСТЬ <head> (без него мост Capacitor не внедряется)
    npx cap add android        # генерирует android/ (Capacitor-дефолты)
    npm run setup:android      # применить наши правки к android/ (см. ниже)
    npx cap sync android

`android/` генерируется и в `.gitignore`, а `npx cap add` сбрасывает его в дефолты — поэтому после
каждого `cap add` прогоняем **`npm run setup:android`** ([`scripts/setup-android.mjs`](../scripts/setup-android.mjs)).
Скрипт идемпотентно проставляет: AGP 8.7.2 / Gradle 8.9 / compileSdk 36 / minSdk 23 / buildToolsVersion
(под JDK 21 + SDK 36, иначе дефолтный Capacitor-стек на JDK 21 не запускается), `local.properties` из
`ANDROID_HOME`, Play Games `APP_ID` + `screenOrientation=sensorLandscape` в манифесте, launcher-иконку
игры (из `assets/icon/`) и полноэкранный (immersive) `MainActivity`.

## Debug SHA-1 → Play Console (шаг #3, «Учетные данные»)
После первой сборки в Android Studio создаётся `~/.android/debug.keystore`:

    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v ^
      -keystore "%USERPROFILE%\.android\debug.keystore" ^
      -alias androiddebugkey -storepass android -keypass android

SHA-1 из вывода → Play Console → Play Games Services → Настройка и управление →
Конфигурация → Учетные данные → Android, package `com.planeflow.game`.

## Сборка и запуск
    npx cap open android          # откроет проект в Android Studio

В Android Studio: Run на подключённом телефоне (USB-debugging) или Build → Build APK.
Телефон должен быть залогинен в Google-аккаунт **из списка тестеров PGS**.

## Проверка (прокол рисков)
- [ ] Canvas плавно рисует в WebView, тач-ввод работает.
- [ ] На старте — системный вход Play Games (тост «Welcome»).
- [ ] Посадка / сервис / взлёт / прохождение уровня → ачивка всплывает в Play Games.
- [ ] Survival-счёт уходит в лидерборд (проверить в системном оверлее Play Games).
- Сброс прогресса ачивок между прогонами — Management API (см. [`play-games-setup.md`](play-games-setup.md)).

## Capgo OTA — self-host на своём VPS (с 2026-06-18)

> Архитектура и эксплуатация — [`capgo-self-host-migration.md`](capgo-self-host-migration.md).

Веб-код (HTML/CSS/JS — у нас это вся игра) доставляется в установленный APK «по воздуху»,
минуя ревью стора. Нативные правки (плагины, `android/`, иконка, мост Play Games) — всё ещё
через новый APK.

**Что в репозитории:** плагин `@capgo/capacitor-updater`, блок `CapacitorUpdater` в
`capacitor.config.ts` (три `*Url` → `capgo.jevgenia.com`), `notifyAppReady()` в
`src/game/13-init.js`, OTA-шаг в `deploy.yml` (атомарный SCP+mv + retention 10 бандлов).

**Каждый push в `main`** = новый бандл уходит на VPS; установленный APK подхватывает при
следующем запуске (в фоне). UptimeRobot следит за `/health`, Telegram — за сбоями сервиса.

**Важные грабли при переинтеграции:**
1. `notifyAppReady()` без `--no-code-check` в CLI — eвристика не находит его в одном `index.html`.
2. Версия бандла `major.minor.<run_number>` должна быть **ВЫШЕ** нативной `versionName` (ставит
   `setup:android` = версия из package.json), иначе плагин сочтёт обновление «понижением».
3. Сборка APK: `npm install && npm run build:www && npm run setup:android && npx cap sync android`
   → Build/Run в Android Studio. ⚠️ **AGP Upgrade Assistant НЕ принимать** (пин AGP 8.7.2).

## После обновления веб-кода
Обычные правки игры (JS/HTML/CSS) ничего вручную не требуют — CI сам выгружает бандл в Capgo,
телефон подхватит. Пересобирать APK нужно только при **нативных** изменениях:

    npm run build:www && npx cap sync android   # затем пересобрать APK в Android Studio

## Перед релизом (напоминание)
- Апнуть Capacitor до актуального мажора (плагин 5.x тестирован на Cap 3–5) **или** сменить плагин;
- release-SHA из Play App Signing → добавить вторым в «Учетные данные»;
- Data Safety + privacy (блокер релиза); затем публикация PGS.
- Из [`play-featuring-plan.md`](play-featuring-plan.md) — чисто ручные пункты Play Console,
  не связанные с кодом: заполнить **анкету контент-рейтинга**; смерить размер AAB против
  лимита базового модуля **150 МБ**; на первом релизе — **staged rollout** (не 100% сразу) +
  managed publishing.
- `targetSdkVersion` в коде = **36** (Android 16), ставит [`setup-android.mjs`](../scripts/setup-android.mjs) —
  выше минимума Play для новых приложений (API 35 на середину 2026). Минимум Play меняется
  **ежегодно** — пере-сверить на момент подачи, но текущее значение с запасом.

## Проверить при первом запуске
- Имя плагина в `window.Capacitor.Plugins` (мост ждёт `CapacitorGameConnect`) — если вход не
  срабатывает, сверить с README плагина и поправить в `12b-native-play-games.ts`.
- Содержимое `www/` (если игра без спрайтов — дополнить копирование в `scripts/build-www.mjs`).

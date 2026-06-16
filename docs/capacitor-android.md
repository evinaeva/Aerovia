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
- Зависимости Capacitor + плагин — в `package.json` (Capacitor **5.x** под плагин
  `@openforge/capacitor-game-connect`).

`android/` и `www/` — генерируемые, в `.gitignore`.

## Разовая настройка (на машине с Android Studio + JDK 17)
    npm install
    npm run build:www
    npx cap add android
    npx cap sync android

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

## После обновления веб-кода
    npm run build:www && npx cap sync android

(до Capgo; с Capgo OTA веб-бандл будет прилетать без пересборки APK.)

## Перед релизом (напоминание)
- Апнуть Capacitor до актуального мажора (плагин 5.x тестирован на Cap 3–5) **или** сменить плагин;
- release-SHA из Play App Signing → добавить вторым в «Учетные данные»;
- Data Safety + privacy (блокер релиза); затем публикация PGS.

## Проверить при первом запуске
- Имя плагина в `window.Capacitor.Plugins` (мост ждёт `CapacitorGameConnect`) — если вход не
  срабатывает, сверить с README плагина и поправить в `12b-native-play-games.ts`.
- Содержимое `www/` (если игра без спрайтов — дополнить копирование в `scripts/build-www.mjs`).

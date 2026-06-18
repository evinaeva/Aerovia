# Облачные сейвы (Google Play Saved Games / Snapshots)

Кроссдевайсный прогресс через **Play Games Saved Games (Snapshots)**. Offline-first:
локальный `localStorage` остаётся единственным источником правды для геймплея, облако —
зеркало. Конфликт версий решается **last-writer-wins** по настенному времени.

## Из чего состоит

| Слой | Файл | Роль |
|------|------|------|
| Нативный плагин | `scripts/setup-android.mjs` → `SnapshotsPlugin.java` | `@CapacitorPlugin(name="Snapshots")` с методами `load()` / `save({data})` поверх `PlayGames.getSnapshotsClient()`. |
| Регистрация | `scripts/setup-android.mjs` → `MainActivity.java` | `registerPlugin(SnapshotsPlugin.class)` до `super.onCreate`. |
| Зависимость | `scripts/setup-android.mjs` → `app/build.gradle` | `implementation "com.google.android.gms:play-services-games-v2:+"` на компил-classpath app-модуля. |
| JS-мост | `src/game/12c-cloud-saves.ts` | `window.PFCloud` — пуш/сверка прогресса, LWW, debounce. На вебе/PWA — no-op. |
| Хук записи | `src/game/11-menu-ui.ts` → `saveGame()` | после записи в `localStorage` дёргает `PFCloud.onLocalSave()` (guard, no-op на вебе). |

Нативного `android/` в git нет (генерируется), поэтому весь native-код живёт шаблонами в
`setup-android.mjs` и накатывается идемпотентно — как и `MainActivity`. См. `docs/capacitor-android.md`.

## Почему именно так

- **PGS v2 уже умеет Snapshots.** Клиент берётся через `PlayGames.getSnapshotsClient(activity)`;
  старый v1 `Games.getSnapshotsClient()` объявлен deprecated. Отдельный v1 SDK не нужен.
- **Вход переиспользуем.** PGS v2 sign-in — app-wide singleton; его уже делает
  `@openforge/capacitor-game-connect` по жесту игрока. Плагин не логинит сам — он попадает в
  работу только после `Account.signIn()` (обёрнут в `12c`).
- **`play-services-games-v2` в `app/build.gradle`.** `@openforge` объявляет артефакт как
  `implementation` своего модуля → он на рантайме, но НЕ на компил-classpath app-модуля, где
  лежит наш плагин. Поэтому дублируем зависимость в app (Gradle сводит обе `+` к одной версии).

## Формат снапшота

Имя снапшота: `planeflow_progress_v1`. Тело — JSON:

```json
{ "v": 1, "savedAt": 1718600000000, "save": { "unlocked": 5, "best": {}, "stars": {}, "...": "" } }
```

`save` — тот же объект, что и в `localStorage[planeflow_save_v1]`. `savedAt` (`Date.now()`) —
ключ сравнения LWW. Локально база сравнения хранится в `localStorage[planeflow_cloud_meta_v1]`.

## Поток синхронизации

- **При входе в Play Games** (`reconcile`): `load()` → если `cloud.savedAt > local` → принимаем
  облако (пишем в `SAVE_KEY`, зовём `loadGame()` + перерисовку), иначе заливаем локальное вверх.
- **При `saveGame()`**: debounce 2.5 c → `save()` в облако. Уход в фон (`visibilitychange`) —
  немедленный flush, чтобы не терять последний прогресс.
- **Серверный конфликт** дополнительно авторезолвится политикой `RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED`.

## Предусловие в Play Console

Saved Games должен быть **включён**: Play Console → *Grow users → Play Games Services → Setup and
management → Configuration → Edit properties → Saved Games: ON*. Активация — до 24 ч (или почистить
данные «Google Play services» на устройстве, чтобы подтянуть конфиг сразу).

## Проверка на устройстве (Pixel)

```bash
npm install
npm run build:www
npx cap add android        # если android/ ещё не сгенерирован
npm run setup:android      # накатывает SnapshotsPlugin.java + регистрацию + зависимость
npx cap sync android
# собрать/запустить APK (Android Studio или ./gradlew installDebug)
```

Сценарий «risk-prick»:
1. На устройстве A: войти в Play Games («G») → пройти пару уровней → свернуть приложение (flush).
2. На устройстве B (тот же Google-аккаунт): войти → прогресс должен подтянуться (`reconcile`).
3. Обратно: новый прогресс на B → вход на A → A берёт более свежую версию (LWW).

Проверить логи плагина: `adb logcat | grep -i Capacitor`; ошибки приходят в JS как reject и
гасятся (офлайн не ломает геймплей — локальный сейв остаётся).

## Известные ограничения (v1)

- Слияние НЕ пообъектное — берётся весь более свежий снапшот целиком (LWW по `savedAt`).
- Смена языка из облака применяется со следующего перезапуска (live-перевод не дёргаем).
- Первичная сверка — на входе в Play Games; авто-вход при старте намеренно не форсим
  (он глушит окно согласия Play Games — см. `src/game/12b-native-play-games.ts`).

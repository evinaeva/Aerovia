# Analytics & soft-launch metrics

Основа под soft launch и метрики. **Это логика, не контент** — единая шина событий
живёт над скинами (см. `CLAUDE.md`): скин/биом/карта попадают в событие как поле
`skin`, никаких `if(SKIN==='…')`. Реализация — модуль `Analytics` в `index.html`
(рядом с `SND`/`HAP`).

## Как устроено

- **`Analytics.init()`** — anonymous `userId` (uuid в `localStorage`, ключ `pf_uid`),
  `first_open` (ключ `pf_first_open`), старт сессии, ловля крашей (`window.error`,
  `unhandledrejection`).
- **`Analytics.track(event, props)`** — кладёт событие с базовым контекстом в буфер
  и (если есть consent) отдаёт в `sink`. Зови откуда угодно из логики.
- **Сессии** — `session_start`/`session_end` (с `duration_ms`). Уход со вкладки
  (`visibilitychange`/`pagehide`) закрывает сессию; возврат после паузы > 30 мин =
  новая сессия.
- **Буфер** — кольцевой, до 500 событий, в `localStorage` (`pf_evt_buffer`).
  Переживает перезагрузку; уже отправленные помечены `_sent`, чтобы не дублить.
- **Consent-гейт** — `Analytics.setConsent(false)` копит события, но молчит в `sink`;
  `setConsent(true)` дольёт накопленное. Задел под GDPR/ATT (см. ниже).
- **Дев-доступ** — `window.PFAnalytics`: `dump()`, `clear()`, `userId`, `sessionId`.

## Базовый контекст (в каждом событии)

`userId, sessionId, seq, ts, appVersion, skin, lang, platform, screenW, screenH`.

## События

| Событие | Когда | Ключевые props |
|---|---|---|
| `first_open` | первый запуск (раз на устройство) | — |
| `session_start` / `session_end` | старт/конец сессии | `duration_ms` |
| `level_start` | начало раунда (`reset()`) | `level, mode, objective, target, startMoney` |
| `level_complete` / `level_fail` | конец раунда (`endLevel`) | `level, mode, reason, stars, value, target, money, peak, time_s, lives` |
| `tutorial_start` | туториал показан | `step` |
| `tutorial_step` | смена шага туториала | `step` (`service`/`takeoff`) |
| `tutorial_complete` | туториал пройден | — |
| `setting_changed` | смена настройки | `key` (`lang`/`sound`/`vibro`/`skin`), `value` |
| `error` | краш JS | `message, source, kind` |
| `purchase` / `revenue` / `ad_watched` | **спят** — нет монетизации | `value, currency, sku` |

`mode` = `campaign` / `biome` / `bonus` / `zen`.

## Какие метрики из чего считаются (на стороне провайдера)

- **Retention D1/D7/D30, churn** — из `first_open` + `session_start` по дням на `userId`.
- **Session length** — из `session_end.duration_ms`.
- **Tutorial dropoff** — воронка `tutorial_start → tutorial_step → tutorial_complete`.
- **Level funnel / сложность** — `level_start` vs `level_complete`/`level_fail` по `level`.
- **Conversion / ARPDAU** — из `purchase`/`revenue` (появятся, когда включим монетизацию).

## Подключение реального провайдера (одной заменой)

Сейчас `sink` = `console.debug` + буфер. Чтобы лить в Firebase/GA4 или свой бэкенд —
подмени `sink`, не трогая ни одной точки `track()`:

```js
// например, свой HTTP-эндпоинт с батчингом
PFAnalytics.sink = evt => queue.push(evt);   // + периодический POST батча
// или Firebase/GA4: logEvent(analytics, evt.event, evt)
```

## Для сторов (TODO к soft launch)

- **Упаковка** ещё не выбрана (web/PWA сейчас). Под сторы — Android TWA, iOS
  Capacitor/WKWebView. Выбор влияет на нативный SDK провайдера и на ATT-промпт.
- **Consent**: до показа баннера согласия / iOS ATT держать `setConsent(false)`;
  включать `true` только после согласия.
- **Google Play Data Safety** и **App Store privacy nutrition labels** — заполнить
  по фактически собираемым полям (см. список контекста выше; userId анонимный).
- **Attribution** (install referrer / UTM) — добавить при выборе обёртки.

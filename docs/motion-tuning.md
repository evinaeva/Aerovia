# Motion Tuning / Designer Tuning

## Этап 1. Аудит параметров

Параметры извлечены из `src/game/04-config-levels.ts`, `src/game/08-gameplay.ts`,
`src/game/08b-gameplay-step.ts`, `src/game/09b-render-entities.ts`,
`src/game/10-scene-loop.ts`, `src/game/11b-editor.ts` и CSS-анимаций.

| Параметр | Где хранится | Значение | Диапазон MT | Назначение | Влияние |
|---|---:|---:|---:|---|---|
| `K.TURN` | `04-config-levels.ts` | `3.2` | `0.5..8` | ограничение доворота `steer/turnTo` | резкость поворота и радиус маршрута |
| `K.SPEED_AIR` | `04-config-levels.ts` | `60` | `20..160` | скорость в воздухе/посадке | темп посадок и время реакции |
| `K.SPEED_TAXI` | `04-config-levels.ts` | `45` | `10..120` | базовая скорость руления | длительность маршрутов по полю |
| `K.SPEED_TAKEOFF` | `04-config-levels.ts` | `150` | `40..260` | скорость разгона/ухода | время занятости ВПП |
| `K.TAKEOFF_LIFT_DIST` | `04-config-levels.ts` | `180` | `0..600` | дистанция набора масштаба за торцом ВПП | резкость/плавность «вырастания» борта после отрыва |
| `K.LAND_ROLLOUT` | `04-config-levels.ts` | `40` | `0..160` | выкат с ВПП вглубь апрона | насколько глубоко севший борт заезжает на апрон |
| `K.ARRIVE` | `04-config-levels.ts` | `12` | `2..40` | захват waypoint | плавность и точность следования маршруту |
| `K.GRAB` | `04-config-levels.ts` | `42` | `16..90` | радиус выбора борта | удобство взаимодействия |
| `K.CRASH_DIST` | `04-config-levels.ts` | `24` | `8..60` | дистанция столкновения | строгость игры к разъездам |
| `K.NEAR_DIST` | `04-config-levels.ts` | `52` | `16..120` | дистанция near-miss | частота эффектов опасного сближения |
| `K.NEAR_COOL` | `04-config-levels.ts` | `2.2` | `0.2..8` | кулдаун near-miss | частота повторных реакций |
| `K.SLOWMO_DUR` | `04-config-levels.ts` | `0.30` | `0..2` | длительность slowmo | драматизация near-miss |
| `K.SLOWMO_SCALE` | `04-config-levels.ts` | `0.45` | `0.1..1` | множитель времени slowmo | сила замедления |
| `K.AIR_BASE` | `04-config-levels.ts` | `30` | `5..90` | воздушное терпение | давление до посадки |
| `K.GROUND_BASE` | `04-config-levels.ts` | `60` | `10..180` | базовое наземное терпение | время на обслуживание |
| `K.GROUND_STEP` | `04-config-levels.ts` | `30` | `0..90` | терпение за услугу | компенсация длинных цепочек услуг |
| `K.SERVE_BASE` | `04-config-levels.ts` | `3.0` | `0.3..12` | базовая длительность услуги | время стоянки в боксе |
| `K.UP_SPEED` | `04-config-levels.ts` | `0.25` | `0..1` | бонус скорости за апгрейд | ценность апгрейдов |
| `K.PACE_IVL_SLOW` | `04-config-levels.ts` | `4.6` | `1..12` | spawn interval при pace=0 | спокойствие ранних карт |
| `K.PACE_IVL_FAST` | `04-config-levels.ts` | `2.4` | `0.5..8` | spawn interval при pace=1 | плотность сложных карт |
| `K.SPAWN_MIN` | `04-config-levels.ts` | `1.8` | `0.3..6` | нижний предел spawn | потолок хаоса |
| `K.SPAWN_DECAY` | `04-config-levels.ts` | `0.04` | `0..0.2` | ускорение за принятый борт | ramp внутри смены |
| `K.PACE_CAP_LOW/HIGH` | `04-config-levels.ts` | `4/10` | `1..20` | лимит одновременных бортов | плотность поля |
| `K.PACE_DEFAULT` | `04-config-levels.ts` | `0.25` | `0..1` | темп не-кампании | фон бонусов/биомов |
| `K.MAX_PLANES` | `04-config-levels.ts` | `10` | `1..30` | жёсткий потолок | производительность/сложность |
| `K.SURV_RAMP_SECS` | `04-config-levels.ts` | `300` | `30..900` | ramp survival | скорость роста сложности |
| `K.VIP_CHANCE` | `04-config-levels.ts` | `0.25` | `0..1` | шанс VIP | частота дорогих срочных бортов |
| `K.TWO_SVC_CHANCE` | `04-config-levels.ts` | `0.45` | `0..1` | шанс двух услуг | длина маршрутов и чек |
| `K.EMERGENCY_CHANCE` | `04-config-levels.ts` | `0.12` | `0..1` | шанс emergency | срочность в воздухе |
| `K.MEDICAL_CHANCE` | `04-config-levels.ts` | `0.10` | `0..1` | шанс medical | приоритетные борта |
| `K.MEDICAL_AIR` | `04-config-levels.ts` | `0.7` | `0.1..1.5` | air-time multiplier | насколько срочный medical |
| `K.RUSH_PERIOD/DUR` | `04-config-levels.ts` | `35/8` | `5..120 / 1..60` | период и длина rush | частота волн |
| `K.FOG_TAXI`, `K.WEATHER_RAIN_TAXI`, `K.WEATHER_SNOW_TAXI` | `04-config-levels.ts` | `0.55/0.8/0.6` | `0.1..1` | погодные множители руления | вязкость поля в погоде |
| `FOR.CREW_SPEED` | `04-config-levels.ts` | `260` | `60..600` | скорость спец-бригады | реакция на помехи лесного биома |
| `FOR.WORK_TIME` | `04-config-levels.ts` | `1.4` | `0.2..8` | работа бригады | время закрытия ВПП |

### Параметры, зашитые в код (пока не редактируемые)

- Множители внутри симуляции: landing speed `K.SPEED_AIR * 0.8`, bay movement `taxiSpeed * 0.85`,
  bonus fly `K.SPEED_TAKEOFF * 0.7`, lerp `dt*6` / `dt*8` / `dt*2`, угловой порог `0.12`,
  геометрия парковки `L=13*ui`, `gap=4*ui`.
- Визуальные тайминги: CSS `transition:.15s` / `transition:.32s`, `--m-dur`, `starPop 0.5s`.
- Таймеры инфраструктуры: revocation/export `setTimeout(..., 5000)`, achievement toast, cloud push debounce.

## Этапы 2–7. Реализация

Единый runtime-реестр `MT_PARAMS` описывает ключ, категорию, подпись, исходное значение, диапазон,
назначение и влияние параметра. Панель читает/пишет только через этот реестр.

- **Источник данных**: `MT_PARAMS` + методы `MT.snapshot/apply/reset/export/importText`.
- **Сохранение/загрузка**: `localStorage` ключ `pf_motion_tuning_v1`.
- **Defaults/reset**: исходные значения из поля `def` в реестре.
- **Presets**: произвольные пользовательские пресеты в `pf_motion_presets_v1`.
- **Export/import**: JSON с полями `version`, `exportedAt`, `values`; импорт через `<input type="file">`.
- **Live Preview**: изменение слайдера мутирует `K`/`FOR` напрямую; игровой цикл читает их каждый кадр.

## Этап 8. Рекомендации

1. **Держать в Motion Tuning**: все параметры движения, маршрутизации, таймингов обслуживания,
   spawn pace, столкновений, near-miss, погодных множителей и лесных бригад.
2. **Оставить в коде**: чистую геометрию экрана, safe-area, константы тестовой инфраструктуры,
   art-only размеры, привязанные к конкретному skin/handoff.
3. **Новые параметры на будущее**: множитель посадочного докатывания, скорость заезда/выезда из бокса,
   lerp alignment speed, порог разворота в боксе, длительность HUD/toast/achievement-анимаций,
   визуальная толщина/яркость route preview.
4. **Архитектура**: расширять `MT_PARAMS`, а не добавлять слайдеры вручную. Если параметр перестаёт
   быть числом `K`/`FOR`, добавить адаптер `target` в `mtTarget`.

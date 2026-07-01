# Биомы Survival — архитектура и руководство по добавлению

> Этот документ описывает как устроена система биомов в коде и что нужно сделать, чтобы добавить следующий биом. Обновлять при добавлении каждого нового биома.

---

## Что такое биом

Биом — это карта режима **Survival**: бесконечная смена с жизнями и личным рекордом. Каждый биом отличается уникальной **механикой помех** на ВПП (не просто другими событиями поверх той же логики).

**Принцип:** биом меняет **правила**, а не только спрайты.

| Биом | Уникальная механика | Статус |
|------|---------------------|--------|
| 🌲 Forest | Падающие деревья, олень, птицы; бригады: пила/техслужба/орёл | ✅ ready |
| ❄️ Arctic | Обледенение ВПП; де-айсинг обязателен перед каждым вылетом | ✅ ready |
| 🏝️ Tropical | Штормовые волны заливают ВПП; насосная бригада откачивает или ждёшь | ✅ ready |
| 🐪 Desert | Песчаные бури засыпают ВПП; нужен пескоочиститель | ✅ ready |
| 🏔️ Mountain | Камнепады блокируют ВПП; медленный бульдозер убирает | ✅ ready |
| 🌆 Mega City | VIP-кортежи блокируют ВПП; рассасываются сами или можно выслать полицию | ✅ ready |

---

## Архитектура: точки расширения

### 1. `src/game/04-config-levels.ts`

**a) Константы биома** (по аналогии с `FOR` и `ARC`):
```typescript
const XYZ = {
  SPAWN_FIRST: N,   // первая помеха через N сек
  SPAWN_MIN: N, SPAWN_MAX: N,
  CREW_SPEED: N,    // px/сек
  WORK_TIME: N,     // сек работы бригады на месте
  REWARD: N,        // монеты за устранение помехи
};
```

**b) Строка в `BIOME_DEFS` — реестр помех (единственная точка привязки биома к логике).**
Раньше связка «биом → конфиг/пул помех» была размазана по цепочкам тернарников в
`08-gameplay` (`reset` / `spawnHazard` / `resolveHazard` / `biomeCfg`) — каждый биом
требовал правок в нескольких местах. Теперь это один стол; добавить биом = одна строка:
```typescript
const BIOME_DEFS = {
  // …
  xyz: { cfg:XYZ, pool:['xyz_hazard'] },
  // snow:true — постоянный снег/обледенение (как arctic);
  // snowPool:['snow'] — доп. помехи при weather==='snow' (как forest).
};
```
`08-gameplay` читает отсюда через `biomeDef(LV.biome)` / `biomeCfg()`, а
`biomeHasHazards(LV.biome)` говорит, есть ли у биома движок помех вообще.

**c) Запись в `BIOMES[]`**:
```typescript
{ id:'xyz', emoji:'🔣', ready:true,
  level:{ biome:'xyz', weather:true/false, deice:true/false,
    objective:{ metric:'served', stars:[8,10,12] },
    sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
    runways:3 } }
```

### 2. `src/game/08-gameplay.ts`

**a) `reset()`** — инициализация уже общая, через реестр; правки НЕ нужны, кроме
редких one-off спецправил (например, постоянный снег арктики выражен флагом `def.snow`):
```typescript
const def = biomeDef(LV.biome);                 // запись биома из BIOME_DEFS
if(def?.snow){ /* постоянная погода */ }
nextHazard = def ? def.cfg.SPAWN_FIRST : Infinity;
```

**b) `neededCrew(h)`** — какая бригада нужна (по виду помехи `h.kind`):
```typescript
if(h.kind==='xyz_hazard') return 'xyz_crew';
```

**c) `spawnHazard()`** — пул помех берётся из реестра; правки НЕ нужны:
```typescript
const def = biomeDef(LV.biome);
let pool = def ? def.pool : ['tree','deer','birds'];
if(def?.snowPool && weather==='snow') pool = pool.concat(def.snowPool);
```
Но: добавить spawn-логику для нового вида `kind` (позиция, `r.closed`, toast) — в цепочке `if(kind==='…')`.

**d) `updateForest()` (или отдельная функция)** — поведение помехи во времени:
- Уходит сама через N сек? → добавить в цикл как deer/birds
- Не уходит без бригады? → ничего не добавлять (как snow/icing)

**e) `resolveHazard()`** — reward/toast уже общие (через `biomeCfg()` и `LV.biome`);
правки НЕ нужны:
```typescript
const reward = biomeCfg().REWARD;               // из BIOME_DEFS[LV.biome].cfg
toast = { text:t((LV.biome||'forest')+'.cleared'), t:0, good:true };
```

### 3. `src/game/08b-gameplay-step.ts`

Правки НЕ нужны — вызов уже общий (по реестру помех):
```typescript
if(biomeHasHazards(LV.biome)) updateForest(dt);
```

### 4. `src/game/09-render.ts`

**a) `drawArcticDecor`-аналог** — декор правой зоны поля. Добавить в `drawNeonField()`:
```typescript
if(LV.biome==='xyz') drawXyzDecor(tm, ax, ay, field.rwR!, ab);
```

**b) Функция `drawXyz(tm)`** — сервисное здание + помехи + бригады. Структура:
1. Сервисное здание (цвета биома, эмблема-эмодзи из `THEME.emblem[biome]`)
2. Рендер помех (цикл по `hazards`)
3. Пульсирующее кольцо + иконка нужной бригады (`!h.dispatched`) — `THEME.crew[neededCrew(h)]`
4. Рендер бригад (`crews`): `THEME.crew[c.kind]` + «искорки работы»

Эмодзи-иконки сведены в единый `THEME` (`01-bootstrap-theme.js`, см. mvp_plan §4.3/§11) —
редизайн набора иконок = правка одного объекта, без правок рендера. Добавить новый
биом = по строке в оба словаря:
```typescript
// 01-bootstrap-theme.js → THEME
crew:   { …, xyz_crew:'🚐' },   // вид бригады → эмодзи (общий на все биомы)
emblem: { …, xyz:'🔣' },        // биом → эмблема сервисного здания
```
(Помеха-специфичные визуалы на полосе — 🌊/🪨/🌪️ и т.п. — остаются инлайн в `drawXyz`,
они завязаны на форму отрисовки конкретной помехи.)

### 5. `src/game/10-scene-loop.ts`

```typescript
if(LV.biome==='forest') drawForest(ts);
else if(LV.biome==='arctic') drawArctic(ts);
else if(LV.biome==='xyz') drawXyz(ts);
```

### 6. `src/game/03-i18n.ts`

Добавить строки в **обе** языковые секции (en + ru):
```typescript
'biome.xyz.name':'...',
'biome.xyz.tag':'...',     // одна строка — тема/антураж
'biome.xyz.hint':'...',    // подсказка как играть
'xyz.hazard_name':'...',   // toast при появлении помехи
'xyz.cleared':'...',       // toast при устранении
'xyz.crew.xyz_crew':'...', // всплывашка при вызове бригады
```

---

## Чеклист добавления нового биома

- [ ] `04-config-levels.ts`: константы XYZ, **строка в `BIOME_DEFS`** (реестр помех), `BIOMES[n].ready = true` + `level` config
- [ ] `08-gameplay.ts`: `neededCrew` (по `h.kind`); spawn-логика нового `kind` в `spawnHazard`; `updateForest` — поведение помехи во времени. `reset`/`spawnHazard`-pool/`resolveHazard` уже общие (читают `BIOME_DEFS`)
- [ ] `08b-gameplay-step.ts`: правок нет — вызов общий (`biomeHasHazards`)
- [ ] `09-render.ts`: `drawNeonField` → вызов декора; `drawXyz(tm)` с сервисным зданием + помехами + бригадами
- [ ] `01-bootstrap-theme.js`: строки в `THEME.crew` (бригада → эмодзи) и `THEME.emblem` (биом → эмблема)
- [ ] `10-scene-loop.ts`: dispatch рендера
- [ ] `03-i18n.ts`: строки en + ru (name, tag, hint, hazard toast, cleared toast, crew name)
- [ ] `npm run typecheck` — чисто
- [ ] `npm test` — 155+ тестов зелёные (реестр проверяется тестом «каждый ready-биом зарегистрирован»)

---

## Готовые биомы: детали реализации

### 🌲 Forest (`biome:'forest'`)

**Помехи:** `tree` · `deer` · `birds` · `snow` (только при `weather==='snow'`)

| kind | r.closed | авто-уходит | бригада | эмодзи бригады |
|------|----------|-------------|---------|----------------|
| tree (standing) | нет | нет | chainsaw | 🪚 |
| tree (fallen) | да | нет | truck | 🚙 |
| deer | да | через 14 сек | truck | 🚙 |
| birds | да | через 9 сек | eagle | 🦅 |
| snow | да | нет | plow | 🚜 |

**Особенность:** 50% деревьев с бобром (`BEAVER_CHANCE`) — падают медленнее (11 vs 6 сек).

**Де-айсинг:** опционален (только при `weather==='snow'`).

**Декор:** зелёная лесная кромка справа от ВПП + сосны.

---

### ❄️ Arctic (`biome:'arctic'`)

**Помехи:** `icing` (только этот тип)

| kind | r.closed | авто-уходит | бригада | эмодзи бригады |
|------|----------|-------------|---------|----------------|
| icing | да | нет | deice_truck | 🚒 |

**Особенности:**
- `weather='snow'`, `weatherUntil=Infinity`, `nextWeather=Infinity` — снег постоянный, система смены погоды отключена
- Де-айсинг обязателен перед каждым вылетом (условие: `weather==='snow'` всегда истинно)
- Бригада медленнее (230 px/с vs 260) и дольше работает (2.5 с vs 1.4 с)
- Нет ветровых/туманных событий (`nextWind=nextFog=Infinity`)

**Декор:** тёмный тундровый фон, белые сугробы, снежинки `*`.

---

## Расположение кода в репозитории

```
src/game/
  01-bootstrap-theme.js — THEME.crew / THEME.emblem (эмодзи-иконки биомов)
  04-config-levels.ts   — BIOMES[], FOR{}, ARC{}…, BIOME_DEFS{} (реестр помех), biomeDef/biomeHasHazards, level configs
  08-gameplay.ts        — spawnHazard, neededCrew, updateForest, resolveHazard, dispatchCrew, biomeCfg (читают BIOME_DEFS)
  08b-gameplay-step.ts  — update() → if(biomeHasHazards(LV.biome)) updateForest()
  09-render.ts          — drawForest, drawArctic, drawForestDecor, drawArcticDecor, drawNeonField
  10-scene-loop.ts      — biome render dispatch
  03-i18n.ts            — все строки биомов en/ru
```

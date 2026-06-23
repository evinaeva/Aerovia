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
| 🏝️ Tropical | Гидросамолёты, плавучие доки, штормовые волны | 🔲 planned |
| 🐪 Desert | Перегрев двигателей, тень как ресурс, песчаные бури | 🔲 planned |
| 🏔️ Mountain | Только малые борты, туманные окна посадки, кнопка wave-off | 🔲 planned |
| 🌆 Mega City | Шумовой комендантский час, двойная ВПП или перегрузка VIP | 🔲 planned |

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

**b) Запись в `BIOMES[]`**:
```typescript
{ id:'xyz', emoji:'🔣', ready:true,
  level:{ biome:'xyz', weather:true/false, deice:true/false,
    objective:{ metric:'served', stars:[8,10,12] },
    sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
    runways:3 } }
```

### 2. `src/game/08-gameplay.ts`

**a) `reset()`** — инициализация состояния биома:
```typescript
const xyz = LV.biome==='xyz';
// примеры: постоянная погода, отключить ветер/туман
if(xyz){ /* ... */ }
nextHazard = forest ? FOR.SPAWN_FIRST : arctic ? ARC.SPAWN_FIRST : xyz ? XYZ.SPAWN_FIRST : Infinity;
```

**b) `neededCrew(h)`** — какая бригада нужна:
```typescript
if(h.kind==='xyz_hazard') return 'xyz_crew';
```

**c) `spawnHazard()`** — пул помех для биома:
```typescript
const pool = xyz ? ['xyz_hazard'] : arctic ? ['icing'] : (weather==='snow' ? ['tree','deer','birds','snow'] : ['tree','deer','birds']);
```
Добавить spawn-логику для нового вида `kind` (позиция, `r.closed`, toast).

**d) `updateForest()` (или отдельная функция)** — поведение помехи во времени:
- Уходит сама через N сек? → добавить в цикл как deer/birds
- Не уходит без бригады? → ничего не добавлять (как snow/icing)

**e) `resolveHazard()`** — если нужен другой reward или toast:
```typescript
const reward = LV.biome==='xyz' ? XYZ.REWARD : LV.biome==='arctic' ? ARC.REWARD : FOR.REWARD;
```

### 3. `src/game/08b-gameplay-step.ts`

Добавить биом в условие вызова `updateForest`:
```typescript
if(LV.biome==='forest' || LV.biome==='arctic' || LV.biome==='xyz') updateForest(dt);
```
*(или перейти на общий `LV.biome && biomeHasHazards()` когда биомов станет больше 3)*

### 4. `src/game/09-render.ts`

**a) `drawArcticDecor`-аналог** — декор правой зоны поля. Добавить в `drawNeonField()`:
```typescript
if(LV.biome==='xyz') drawXyzDecor(tm, ax, ay, field.rwR!, ab);
```

**b) Функция `drawXyz(tm)`** — сервисное здание + помехи + бригады. Структура:
1. Сервисное здание (цвета биома, эмблема-эмодзи)
2. Рендер помех (цикл по `hazards`)
3. Пульсирующее кольцо + иконка нужной бригады (`!h.dispatched`)
4. Рендер бригад (`crews`): эмодзи + «искорки работы»

Добавить эмодзи нового типа бригады в оба словаря (`neededCrew` hint и crew render):
```typescript
({..., xyz_crew:'🚐'} as Record<string, string>)[c.kind]
```

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

- [ ] `04-config-levels.ts`: константы XYZ, `BIOMES[n].ready = true` + `level` config
- [ ] `08-gameplay.ts`: `reset()` init; `neededCrew`; `spawnHazard` pool; `updateForest` or new fn; `resolveHazard` biome-aware
- [ ] `08b-gameplay-step.ts`: добавить биом в условие вызова обновления помех
- [ ] `09-render.ts`: `drawNeonField` → вызов декора; `drawXyz(tm)` с сервисным зданием + помехами + бригадами; эмодзи во всех словарях
- [ ] `10-scene-loop.ts`: dispatch рендера
- [ ] `03-i18n.ts`: строки en + ru (name, tag, hint, hazard toast, cleared toast, crew name)
- [ ] `npm run typecheck` — чисто
- [ ] `npm test` — 155+ тестов зелёные

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
  04-config-levels.ts   — BIOMES[], FOR{}, ARC{}, level configs
  08-gameplay.ts        — spawnHazard, neededCrew, updateForest, resolveHazard, dispatchCrew
  08b-gameplay-step.ts  — update() → updateForest call
  09-render.ts          — drawForest, drawArctic, drawForestDecor, drawArcticDecor, drawNeonField
  10-scene-loop.ts      — biome render dispatch
  03-i18n.ts            — все строки биомов en/ru
```

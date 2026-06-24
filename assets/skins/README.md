# Zone skins — workbench registry

Skins the **tuning workbench** (`tuning.html` → вкладка «Скины») tries on against the
real zone geometry. One **skin = one folder**:

```
assets/skins/<zone>/<name>/skin.json
assets/skins/<zone>/<name>/<state>.png …
```

`<zone>` ∈ `hangar` · `apron` · `runway` · `plane` · `arrival` · `background`.

`skin.json`:
```json
{
  "id": "hangar-01",
  "label": "Ангар 01",
  "base": "assets/sprites/neon",
  "states": { "fuel": "open-fuel.png", "board": "open-board.png",
              "repair": "open-repair.png", "deice": "open-deice.png",
              "locked": "locked.png" }
}
```
- `id` — **стабильный уникальный id скина**. Именно он попадает в экспорт уровня
  (`skins.<zone>` в JSON), поэтому держи его постоянным. Развязан от имени папки:
  папку можно переименовать, а ссылки в уже выгруженных JSON не сломаются. Если поле
  опущено — id = имя папки (для совместимости). Должен быть уникален в пределах зоны.
- `label` — человекочитаемое имя (показывается в табе).
- `base` *(optional)* — если задано, картинки берутся отсюда (путь от корня репо),
  иначе — из самой папки скина. Так скин может переиспользовать уже готовые спрайты
  из `assets/sprites/<name>/` без копирования (имя последней папки `base` тогда ещё
  и совпадает с тем, что грузит игровой превью через `setSkinOverrides`).
- `states` — `состояние → файл`. Для ангара: `fuel`/`board`/`repair`/`deice` (открыто
  по услуге) + `locked` (закрыт). Состояния по зонам — см.
  [`docs/design/skins/ZONES.md`](../../docs/design/skins/ZONES.md).

> В экспорт черновика едут **только id выбранных скинов** (`skins: { hangar: "hangar-01", … }`),
> а не сами файлы. Файлы скинов остаются в репо.

## Добавить скины дизайнера
1. Распакуй архив в `assets/skins/<zone>/<name>/`, положи `skin.json`.
2. `npm run scan:skins` — пересоберёт `index.json` (его читает таб). Он также
   обновляется при `npm run build:tuning`.
3. Открой `tuning.html` → «Скины», выбери скин на превью.

`index.json` — **генерируемый** файл (источник правды — `skin.json`-ы), но
**коммитится**, чтобы всегда присутствовать в развёрнутом дереве (таб грузит его
отдельным `fetch`).

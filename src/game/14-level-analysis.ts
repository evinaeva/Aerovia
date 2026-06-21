// ===== 14-level-analysis — static difficulty analysis for level configs =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: DifficultyComponent, DifficultyReport, analyzeLevel, countOpenHangars, countTotalHangars, countOpenRunwayDirections.
// Reads: 04 (K, Level, HangarDef, RunwayDef, LevelLayout, levelPace, levelDifficulty, levelEconomy, levelEffects, levelEvents, sidesToLayout, SVC_TYPES).

  interface DifficultyComponent {
    label: string;
    weight: number;   // 0..1 weight in the total score
    score: number;    // 0..1 raw component score
    contrib: number;  // weight × score, contribution to total
  }

  interface DifficultyReport {
    level: Level;
    total: number;           // weighted score 0..1 (1 = hardest)
    components: DifficultyComponent[];
    pace: number;            // levelPace() raw value 0..1
    difficulty: number;      // levelDifficulty() raw value 0..ECON_DIFF_CAP
    economy: ReturnType<typeof levelEconomy>;
    openHangars: number;
    totalHangars: number;
    openRunwayDirs: number;  // sum of open landing+takeoff ends at game start
    warnings: string[];      // soft issues found (not blockers)
  }

  // helpers — read static config, no game state
  function countTotalHangars(lv: Level): number {
    if(lv.layout && lv.layout.hangars) return lv.layout.hangars.length;
    const sides: any = (lv && lv.sides) || {};
    let n=0; for(const k in sides) n += (sides[k] && sides[k].slots) || 0;
    return n;
  }

  function countOpenHangars(lv: Level): number {
    if(lv.layout && lv.layout.hangars){
      return lv.layout.hangars.filter((h: HangarDef) => h.open !== false).length;
    }
    const sides: any = (lv && lv.sides) || {};
    let n=0; for(const k in sides) n += (sides[k] && sides[k].open) || 0;
    return n;
  }

  function countOpenRunwayDirections(lv: Level): number {
    if(lv.layout && lv.layout.runways){
      let d=0;
      for(const r of lv.layout.runways){
        if(r.landingOpen !== false) d++;
        if(r.takeoffOpen !== false) d++;
      }
      return d;
    }
    // legacy sides: all runways fully open
    const n = Math.max(1, (lv && (lv as any).runways) || 1);
    return n * 2;
  }

  // geometry quality 0..1: spread and variety of hangar positions in normalized coords.
  // Uses explicit layout only (falls back to 0.5 for legacy sides).
  function _geometryScore(lv: Level): number {
    if(!lv.layout || !lv.layout.hangars || lv.layout.hangars.length === 0) return 0.5;
    const hs = lv.layout.hangars;
    const n = hs.length;
    if(n === 1) return 0.2;

    // y-spread: fraction of vertical range used (0..1)
    let yMin=1, yMax=0;
    for(const h of hs){ if(h.y < yMin) yMin=h.y; if(h.y > yMax) yMax=h.y; }
    const ySpread = yMax - yMin;  // 0..1

    // x-spread: fraction of horizontal range used
    let xMin=1, xMax=0;
    for(const h of hs){ if(h.x < xMin) xMin=h.x; if(h.x > xMax) xMax=h.x; }
    const xSpread = xMax - xMin;

    // service type diversity: how many distinct service types
    const types = new Set<string>(hs.map((h: HangarDef)=>h.type));
    const typeDiversity = Math.min(1, (types.size - 1) / (SVC_TYPES.length - 1));

    // runways: 2..K.RUNWAY_MAX is optimal
    const rn = lv.layout.runways ? lv.layout.runways.length : 1;
    const rwScore = Math.min(1, (rn - 1) / (K.RUNWAY_MAX - 1));

    // hangar count density: more hangars up to ED_HMAX = 14
    const densityScore = Math.min(1, n / 10);

    return (ySpread*0.25 + xSpread*0.15 + typeDiversity*0.25 + rwScore*0.20 + densityScore*0.15);
  }

  function analyzeLevel(lv: Level): DifficultyReport {
    const warnings: string[] = [];
    const pace = levelPace(lv);
    const difficulty = levelDifficulty(lv);
    const econ = levelEconomy(lv);
    const ev: Events = (lv && lv.events) || {};
    const o: Objective = (lv && lv.objective) || ({} as Objective);

    // ---- components (weights must sum to 1) ----

    // traffic (30%): pace is main axis
    const trafficScore = pace;

    // capacity (25%): how constrained is the layout — few open hangars = harder
    const total = countTotalHangars(lv);
    const open = countOpenHangars(lv);
    // fully open layout is easy; all locked is impossible (validator catches it)
    // score: fraction of hangars that are LOCKED at start (player must buy)
    const lockedFrac = total > 0 ? (total - open) / total : 0;
    const capacityScore = lockedFrac;

    // events (10%): VIP only (rest deferred)
    const evScore = ev.vip ? 0.5 : 0;

    // timePressure (10%): timed/race objective
    const timeScore = o.race ? 1.0 : (o.time ? 0.5 : 0);

    // economy (5%): low svcReward relative to kit cost = harder for player
    const kitVsSvc = econ.kitCost > 0 ? Math.max(0, Math.min(1, econ.kitCost / (econ.svcReward * 20 + 1))) : 0;

    // geometry (20%): complex/diverse layout = harder to manage
    const geoScore = _geometryScore(lv);

    const components: DifficultyComponent[] = [
      { label:'traffic',      weight:0.30, score:trafficScore,  contrib:0.30*trafficScore  },
      { label:'capacity',     weight:0.25, score:capacityScore, contrib:0.25*capacityScore },
      { label:'events',       weight:0.10, score:evScore,       contrib:0.10*evScore       },
      { label:'timePressure', weight:0.10, score:timeScore,     contrib:0.10*timeScore     },
      { label:'economy',      weight:0.05, score:kitVsSvc,      contrib:0.05*kitVsSvc      },
      { label:'geometry',     weight:0.20, score:geoScore,      contrib:0.20*geoScore      },
    ];

    const total01 = components.reduce((s,c)=>s+c.contrib, 0);

    // soft warnings (not blockers — validator handles blockers)
    if(open === 0) warnings.push('no open hangars at start — player must buy before any service');
    const openDirs = countOpenRunwayDirections(lv);
    if(openDirs < 2) warnings.push('fewer than 2 open runway directions — very restrictive start');
    if(lv.startMoney != null && lv.startMoney < 0) warnings.push('startMoney is negative');
    if(pace > 0.8 && lockedFrac > 0.7) warnings.push('high pace + most hangars locked — may be unwinnable');

    return {
      level: lv, total: Math.min(1, total01),
      components, pace, difficulty, economy: econ,
      openHangars: open, totalHangars: total, openRunwayDirs: openDirs,
      warnings,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ВАЛИДАТОР ПРОХОДИМОСТИ 1★/2★/3★ — может ли компетентный игрок взять каждый тир.
  // Оценки берём из задокументированной модели (paceInterval/paceCap/levelEconomy);
  // рубрика — docs/design/game-design/star-conditions.md §5. Это «мягкая» проверка для
  // редактора (НЕ блокирует сборку): возвращает по тиру {star, ok, reasons}.
  interface TierVerdict { star: number; ok: boolean; reasons: string[]; }
  interface PassReport  { tiers: TierVerdict[]; globalReasons: string[]; ok: boolean; }

  function validatePassable(lv: Level): PassReport {
    const o: Objective = (lv && lv.objective) || ({} as Objective);
    const pace = levelPace(lv);
    const interval = paceInterval(pace);                 // сек между прилётами (без rush/decay)
    const ec = levelEconomy(lv);
    const avgNSvc = 1 + (levelServices(lv).length >= 2 ? K.TWO_SVC_CHANCE : 0);
    // максимум обслуживаемых: ограничен потоком прилётов в окне времени. Без лимита
    // времени поток бесконечен (борта спавнятся, пока цель не взята) ⇒ Infinity.
    const W = o.time ? o.time : Infinity;
    const servableMax = W === Infinity ? Infinity : Math.floor((W / interval) * 1.05);
    const stars = o.stars || [];
    const tiers: TierVerdict[] = [];
    for(let i=0;i<3;i++){
      const reasons: string[] = [];
      const need = stars[i] ?? 0;
      if(i>0 && need < (stars[i-1] ?? 0)) reasons.push('порог звезды ниже предыдущего (немонотонно)');
      // пропускная способность (для served/timed; survival меряется временем)
      if(o.metric !== 'survival' && need > servableMax)
        reasons.push('цель '+need+' выше достижимого потока ~'+servableMax+' за отведённое время');
      // время на тир: успеть обслужить need бортов
      if(o.timeTier && o.timeTier[i] > 0){
        const tMin = Math.ceil(need * interval);
        if(o.timeTier[i] < tMin) reasons.push('за '+o.timeTier[i]+'с не успеть обслужить '+need+' (нужно ~'+tMin+'с)');
      }
      // деньги: заработок ~ оплата × поток (для survival берём расчётный flow)
      if(o.money && o.money[i] > 0){
        const planes = o.metric === 'survival' ? ec.flow : Math.max(need, 1);
        const earn = ec.startMoney + ec.svcReward * avgNSvc * planes * ec.skillMult;
        const moneyMax = earn - ec.kitCost;
        if(o.money[i] > moneyMax) reasons.push('заработок ~'+Math.round(moneyMax)+' не дотянет до порога денег '+o.money[i]);
      }
      // жизни: нельзя требовать больше стартовых
      if(o.lives && o.lives[i] > K.START_LIVES) reasons.push('требует жизней больше стартовых ('+K.START_LIVES+')');
      tiers.push({ star:i+1, ok: reasons.length===0, reasons });
    }
    const globalReasons: string[] = [];
    if(countOpenRunwayDirections(lv) < 2) globalReasons.push('меньше 2 открытых направлений ВПП — старт нерабочий');
    if(!(Array.isArray(o.stars) && o.stars.length===3)) globalReasons.push('нет трёх порогов звёзд');
    return { tiers, globalReasons, ok: tiers.every(tr=>tr.ok) && globalReasons.length===0 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // АВТО-СЛОЖНОСТЬ — один регулятор target∈[0,1] → согласованный набор факторов.
  // Инвертирует levelDifficulty(): раскладывает целевую сложность (target·CAP) на
  // события (ступенчато, по одному), среду и темп (pace добираем под формулу), плюс
  // выводит скромный спред порогов звёзд. Возвращает ТОЛЬКО ручки сложности/цели —
  // их мержат на геометрию черновика. Затем ослабляет пороги, пока validatePassable
  // не станет зелёным. Правила кривой — docs/design/game-design/difficulty_curve.md.
  function autoDifficulty(target: number): Partial<Level> {
    const tg = Math.max(0, Math.min(1, target || 0));
    const d  = tg * K.ECON_DIFF_CAP;                     // желаемый levelDifficulty (0..CAP)
    // события вводим ступенчато (по одному) с ростом target — как «введение → консолидация»
    const events: Events = {};
    if(tg >= 0.30) events.vip = true;
    if(tg >= 0.50) events.emergency = true;
    if(tg >= 0.68) events.rush = true;
    if(tg >= 0.84) events.medical = true;
    // среда — только на высоком target
    const weather = tg >= 0.92;
    // таймерное давление — в верхней половине (даёт «гонку»)
    const timed = tg >= 0.60;
    const EVENT_DIFF: Record<string, number> = { vip:0.5, rush:1.0, medical:1.0, emergency:0.8, fog:0.8, wind:0.8 };
    let eventScore = 0; for(const k in EVENT_DIFF) if(events[k]) eventScore += EVENT_DIFF[k];
    const timeScore = timed ? 0.5 : 0;
    const envScore  = weather ? 1 : 0;
    // решаем pace под формулу levelDifficulty (см. 04): добираем недостающее темпом
    const paceRaw = (d * K.ECON_DIFF_NORM - K.ECON_W_EVENT*eventScore - K.ECON_W_TIME*timeScore - K.ECON_W_ENV*envScore) / K.ECON_W_DENS;
    const pace = +Math.max(0, Math.min(1, paceRaw)).toFixed(2);
    // пороги звёзд из потока: скромный спред 70%/85%/100% (1★ достижима, 3★ — вызов)
    const base = Math.round(6 + tg * 26);               // 6..32 бортов
    const stars = [Math.max(1, Math.round(base*0.70)), Math.max(1, Math.round(base*0.85)), base];
    const objective: Objective = { metric:'served', stars, target: stars[2] };
    const out: Partial<Level> = { pace, events, objective };
    if(weather) out.weather = true;
    if(timed){ objective.time = Math.max(60, Math.ceil(base * paceInterval(pace) * 1.6)); }
    // гарантия проходимости: ослабляем пороги, пока все тиры не зелёные
    for(let guard=0; guard<10; guard++){
      const rep = validatePassable(out as Level);
      if(rep.ok) break;
      objective.stars = objective.stars.map(n=>Math.max(1, Math.floor(n*0.9)));
      objective.target = objective.stars[2];
      if(objective.time) objective.time = Math.ceil(objective.time * 1.1);
    }
    return out;
  }

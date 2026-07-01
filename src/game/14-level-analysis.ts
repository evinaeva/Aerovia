// ===== 14-level-analysis — static difficulty analysis for level configs =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: DifficultyComponent, DifficultyReport, analyzeLevel, countOpenHangars, countTotalHangars,
//   countOpenRunwayDirections, validatePassable, campaignTarget, archetypeForIndex, ARCHETYPES, autoDifficulty;
//   ПЛЮС достраивает LEVELS до полной кампании (L12–L50) из скелетов CAMPAIGN_PLAN (см. сборщик в конце).
// Reads: 04 (K, LEVELS, CAMPAIGN_LAYOUTS, CAMPAIGN_PLAN, Level, Objective, HangarDef, RunwayDef, LevelLayout,
//   levelPace, levelEconomy, levelServices, levelMaxUp, paceInterval, SVC_TYPES).
//   autoDifficulty НЕ генерирует events/weather — их ставит оператор (в кампании — скелет уровня).

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
      // апгрейды: не больше, чем всего возможно на карте (апгрейдируемые ангары × maxUp)
      if(o.upg && o.upg[i] > 0){
        const hs = (lv.layout && lv.layout.hangars) || [];
        const totalPossUpg = hs.filter((h: HangarDef)=>h.up!==false).length * levelMaxUp(lv);
        if(o.upg[i] > totalPossUpg) reasons.push('апгрейдов '+o.upg[i]+' больше возможных на карте ('+totalPossUpg+')');
      }
      tiers.push({ star:i+1, ok: reasons.length===0, reasons });
    }
    const globalReasons: string[] = [];
    if(countOpenRunwayDirections(lv) < 2) globalReasons.push('меньше 2 открытых направлений ВПП — старт нерабочий');
    if(!(Array.isArray(o.stars) && o.stars.length===3)) globalReasons.push('нет трёх порогов звёзд');
    return { tiers, globalReasons, ok: tiers.every(tr=>tr.ok) && globalReasons.length===0 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // КРИВАЯ СЛОЖНОСТИ КАМПАНИИ — номер уровня → target∈[0,1] насыщающейся кривой.
  // Обучение (пологий низ) → подъём (ease-out) → плато < 1.0; капстоны каждый
  // capstoneEvery-й уровень добиваются до ~1.0. Расширение кампании = больше уровней
  // на том же плато (raw-сложность НЕ растёт выше «предела компетентного игрока»).
  // Правила — docs/design/game-design/difficulty_curve.md. Дефолты ручек — K.CURVE.
  interface CurveOpts { tutorialLen?: number; rampEnd?: number; plateauHeight?: number; capstoneEvery?: number; }
  function campaignTarget(index: number, o: CurveOpts = {}): number {
    const T = o.tutorialLen   ?? K.CURVE.tutorialLen;    // длина обучения
    const R = o.rampEnd       ?? K.CURVE.rampEnd;        // уровень выхода на плато
    const H = o.plateauHeight ?? K.CURVE.plateauHeight;  // высота плато (< 1.0)
    const C = o.capstoneEvery ?? K.CURVE.capstoneEvery;  // период капстонов (0 = выкл)
    const i = Math.max(1, Math.floor(index || 1));
    let t: number;
    if(i <= T){
      t = 0.04 + (0.18 - 0.04) * (i - 1) / Math.max(1, T - 1);          // пологое обучение
    } else if(i <= R){
      const p = (i - T) / Math.max(1, R - T);                          // 0..1
      t = 0.20 + (H - 0.20) * (1 - (1 - p) * (1 - p));                 // ease-out, насыщается к H
    } else {
      t = H;                                                            // плато
    }
    if(C > 0 && i % C === 0) t = Math.min(1.0, Math.max(t, H + 0.08));  // капстон
    return +Math.max(0, Math.min(1, t)).toFixed(3);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // АКЦЕНТЫ ФАКТОРОВ — все факторы победы активны ВСЕГДА; архетип лишь смещает
  // «строгость» групп при заданном target (суммарная сложность ≈ target, проходимость
  // гарантирует validatePassable). Это даёт разнообразие на плато без роста raw-сложности.
  interface Archetype { key: string; traffic: number; money: number; time: number; quality: number; upg: number; }
  const ARCHETYPES: Archetype[] = [
    { key:'mixed',    traffic:1.0, money:1.0, time:1.0, quality:1.0, upg:1.0 },  // баланс (дефолт)
    { key:'economy',  traffic:0.9, money:1.4, time:0.8, quality:1.2, upg:1.0 },  // деньги + безаварийность
    { key:'speed',    traffic:1.1, money:0.8, time:1.4, quality:0.8, upg:0.9 },  // время / timeTier
    { key:'flawless', traffic:0.9, money:1.0, time:0.9, quality:1.5, upg:1.0 },  // 0 просрочек/аварий
    { key:'upgrades', traffic:0.9, money:0.9, time:1.2, quality:1.0, upg:1.5 },  // гонка апгрейдов
    { key:'traffic',  traffic:1.4, money:0.8, time:1.0, quality:0.8, upg:0.9 },  // поток у предела ёмкости
  ];
  // ротация акцентов по номеру уровня; капстон → 'flawless'
  function archetypeForIndex(index: number, capstoneEvery: number = K.CURVE.capstoneEvery): string {
    const i = Math.max(1, Math.floor(index || 1));
    if(capstoneEvery > 0 && i % capstoneEvery === 0) return 'flawless';
    return ARCHETYPES[(i - 1) % ARCHETYPES.length].key;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // АВТО-ГЕНЕРАТОР УРОВНЯ — target∈[0,1] (+ опц. акцент) → согласованный набор ВСЕХ
  // факторов победы и экономики. ЧИТАЕТ разметку и ручные настройки оператора (через
  // opts.locked их НЕ перезаписывает, но учитывает как вход), события/погоду НЕ трогает.
  // Затем ослабляет пороги, пока validatePassable не станет зелёным.
  interface AutoResult {
    pace: number; objective: Objective;
    openCost?: number; upgCost?: number; rwOpenCost?: number;
    maxUp?: number; minUp?: number; startMoney?: number;
    crashPenalty?: number; latePenalty?: number;
  }
  interface AutoOpts { archetype?: string; locked?: string[]; }
  function autoDifficulty(target: number, lv: Partial<Level> = {}, opts: AutoOpts = {}): AutoResult {
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const r = (v: number) => Math.round(v);
    const tg = clamp(target || 0, 0, 1);
    const pace = +tg.toFixed(2);
    const lvRef = lv as Level;

    // — чтение карты (вход; ручные настройки не перезаписываем) —
    const openH    = countOpenHangars(lvRef);
    const totalH   = countTotalHangars(lvRef);
    const openDirs = countOpenRunwayDirections(lvRef);
    const hangars  = (lv.layout && lv.layout.hangars) || [];
    const upgH     = hangars.filter((h: HangarDef) => h.up !== false).length;
    let lockedDirs = 0;
    const rws = (lv.layout && lv.layout.runways) || [];
    for(const rw of rws){ if(rw.landingOpen === false) lockedDirs++; if(rw.takeoffOpen === false) lockedDirs++; }
    const interval = paceInterval(pace);
    const lockedSet = new Set(opts.locked || []);
    // итоговый потолок апгрейда (генерируем, если оператор не задал/не залочил) — от него
    // считаем и пропускную, и totalPossUpg, чтобы они совпали с тем, что увидит валидатор.
    const maxUpV = lockedSet.has('maxUp') ? levelMaxUp(lvRef) : ((lv.maxUp != null) ? lv.maxUp : Math.max(1, r(tg*K.BAY_MAX_LVL)));
    const totalPossUpg = upgH * maxUpV;                  // всего возможных апгрейдов на карте
    const fullUpgThroughput = 1 + maxUpV * K.UP_SPEED;  // ×2.25 при maxUp=5 (реальная формула serveTimeFor)

    // — акцент факторов —
    const A = ARCHETYPES.find(a => a.key === (opts.archetype || lvRef.archetype)) || ARCHETYPES[0];

    // — число бортов (ёмкость карты + полная прокачка) —
    const capFactor = clamp(
      (clamp(openH/3, 0.3, 1.8)*0.5 + clamp(openDirs/3, 0.3, 1.5)*0.3) * fullUpgThroughput * 0.6 + 0.4,
      0.4, 2.4);
    const base = Math.max(4, r((4 + tg*28) * capFactor * A.traffic));
    const stars = [Math.max(1, r(base*0.70)), Math.max(1, r(base*0.85)), Math.max(1, base)];

    // — время на тир (timeTier, ≤; 3★ строже). Низкий tg → очень щедро (необязательно) —
    const tc = Math.max(stars[2], 1) * interval;         // «естественное» время добежать до 3★
    const timePress = clamp(tg * A.time, 0, 1.4);
    const mul3 = 2.6 - 1.5*timePress, mul2 = mul3 + 0.4, mul1 = mul3 + 0.9;
    const timeTier = [Math.max(30, Math.ceil(tc*mul1)), Math.max(30, Math.ceil(tc*mul2)), Math.max(30, Math.ceil(tc*mul3))];

    // — разметочные цены/экономика (единые на карту); считаем ДО денег, чтобы привязать
    //   денежную цель к экономике с этими ценами (как увидит validatePassable). Locked-поля
    //   оператора не трогаем — берём его значения из уже стамплённого layout. —
    const openCostV   = lockedSet.has('openCost')   ? null : r(K.BAY_OPEN_COST * (0.5 + tg));        // 50..200
    const upgCostV    = lockedSet.has('upgCost')    ? null : r(K.BAY_UP_COST[0] * (0.75 + tg*2.25)); // ~60..240
    const rwOpenCostV = lockedSet.has('rwOpenCost') ? null : (lockedDirs > 0 ? r(80 + tg*120) : null);// 80..200
    const minUpV      = lockedSet.has('minUp') ? (lvRef.minUp || 0) : (tg > 0.5 ? 1 : 0);   // maxUpV — выше

    // «как при экспорте»: клонируем layout, штампуем сгенерированные цены и target —
    // levelEconomy здесь даёт те же svcReward/kitCost, что увидит валидатор после экспорта.
    function simLevel(starArr: number[], startMoneyArg?: number): Level {
      const lay = lv.layout ? JSON.parse(JSON.stringify(lv.layout)) : (lvRef as any).layout;
      if(lay && lay.hangars){
        lay.hangars.forEach((h: any) => {
          if(openCostV != null && h.open === false) h.openCost = openCostV;
          if(upgCostV  != null) h.upgCost = upgCostV;
        });
        if(rwOpenCostV != null && lay.runways) lay.runways.forEach((rw: any) => {
          if(rw.landingOpen === false) rw.landingCost = rwOpenCostV;
          if(rw.takeoffOpen === false) rw.takeoffCost = rwOpenCostV;
        });
      }
      const out: any = { ...lvRef, layout: lay, pace, maxUp: maxUpV, minUp: minUpV,
                         objective: { metric:'served', stars: starArr, target: starArr[starArr.length-1] } };
      if(startMoneyArg != null) out.startMoney = startMoneyArg;
      return out as Level;
    }

    // — стартовые деньги: доля стоимости набора (помощь на старте, убывает с tg).
    //   Для money-акцентов (A.money>1) поднимаем до ~0.32·kit, иначе на уровне без событий
    //   нет излишка и денежная цель невыполнима (нужен бюджет, чтобы было что копить). —
    const kitCostNow = levelEconomy(simLevel(stars)).kitCost;
    let startMoneyV: number;
    if(lockedSet.has('startMoney')) startMoneyV = (lvRef.startMoney as number) || 0;
    else {
      startMoneyV = Math.max(0, r(kitCostNow * Math.max(0, 0.4 - tg*0.38)));
      if(A.money > 1.0) startMoneyV = Math.max(startMoneyV, Math.ceil(0.32 * kitCostNow));
    }

    // — деньги (≥): доля РЕАЛЬНО зарабатываемого. Выполнимость проверяем по ХУДШЕЙ из двух
    //   экономик — со сгенерированными ценами (как после экспорта) и с исходными ценами карты —
    //   чтобы цель была достижима независимо от того, заштампует ли потребитель цены. Если
    //   даже нулевая цель недостижима (kit дороже заработка) — деньги опускаем. —
    const avgNSvc = 1 + (levelServices(lvRef).length >= 2 ? K.TWO_SVC_CHANCE : 0);
    const moneyFrac = clamp((0.3 + tg*0.5) * A.money, 0.15, 0.95);
    function origLevel(starArr: number[]): Level {
      return { ...lvRef, pace, maxUp: maxUpV, minUp: minUpV, startMoney: startMoneyV,
               objective: { metric:'served', stars: starArr, target: starArr[starArr.length-1] } } as Level;
    }
    function moneyMaxFor(s: number, e: ReturnType<typeof levelEconomy>): number {
      return e.startMoney + e.svcReward * avgNSvc * Math.max(s, 1) * e.skillMult - e.kitCost;
    }
    function calcMoney(starArr: number[]): number[] | undefined {
      const eS = levelEconomy(simLevel(starArr, startMoneyV));   // сгенерированные (штампованные) цены
      const eO = levelEconomy(origLevel(starArr));               // исходные цены карты
      const rows = starArr.map(s => {
        const mm = Math.min(moneyMaxFor(s, eS), moneyMaxFor(s, eO));
        return { v: Math.max(0, Math.floor(Math.max(0, mm) * moneyFrac)), max: mm };
      });
      if(rows.some(x => x.v > x.max)) return undefined;   // даже 0 недостижим ⇒ нет денежной цели
      return rows.map(x => x.v);
    }
    let money = lockedSet.has('money') ? undefined : calcMoney(stars);

    // — жизни (≥), растут с акцентом качества —
    const q = clamp(tg * A.quality, 0, 1.3);
    const lives = [1, Math.min(K.START_LIVES, 1 + r(q)), Math.min(K.START_LIVES, 1 + r(q*2))];

    // — качество (≤): просрочки/крушения, от щедрых к нулю. «Пол фрустрации»
    //   (difficulty_curve.md: 1★ — проходной порог): строгость q давит верхние тиры
    //   сильнее нижних, а 1★ никогда не требует нулевой чистоты — иначе на капстоунах
    //   (q→1.3) одна просрочка отбирала бы даже проходную звезду —
    const maxLate  = [Math.max(2, r(25*(1-q*0.6))), Math.max(0, r(18*(1-q*0.85))), Math.max(0, r(12*(1-q)))];
    const maxCrash = [Math.max(1, r(15*(1-q*0.6))), Math.max(0, r(10*(1-q*0.85))), Math.max(0, r(6*(1-q)))];

    // — апгрейды (≥), если на карте есть апгрейдируемые ангары. Пороги привязаны к числу
    //   шагов, которое ФИНАНСИРУЕТ экономика (та же модель, что упор kitCost в levelEconomy:
    //   working·upgShare·UP_FRAC·spanFrac), а НЕ к теоретическому максимуму карты — иначе
    //   верхние тиры требовали бы апгрейдов на суммы, которых смена не приносит (деньги
    //   блокировали бы 3★: каждый шаг стоит upgCost, а kit финансирует лишь долю шагов).
    //   Верх клампа 1.5 — добор сверх kit за счёт скилл-излишка (комбо/экспресс). —
    let upg: number[] | undefined;
    if(totalPossUpg > 0){
      const working  = openH + Math.round((totalH - openH) * K.ECON_OPEN_FRAC);
      const upgShare = totalH > 0 ? upgH / totalH : 0;
      const spanFrac = maxUpV > 0 ? (maxUpV - minUpV) / maxUpV : 0;
      const funded   = Math.min(totalPossUpg, working * upgShare * K.ECON_UP_FRAC * spanFrac);
      const u3 = Math.max(1, Math.min(totalPossUpg, r(funded * clamp(0.6 + tg*0.7*A.upg, 0.6, 1.5))));
      upg = [Math.max(1, r(u3*0.4)), Math.max(1, r(u3*0.7)), u3];
      if(upg[1] < upg[0]) upg[1] = upg[0];
      if(upg[2] < upg[1]) upg[2] = upg[1];               // монотонность после round
    }

    // — objective (заданные условия длиной 3) —
    const objective: Objective = { metric:'served', stars, target: stars[2], timeTier, lives, maxLate, maxCrash };
    if(money) objective.money = money;
    if(upg)   objective.upg = upg;

    // — итог: ручки экономики/цен (единые на карту) —
    const out: AutoResult = {
      pace, objective,
      maxUp: maxUpV, minUp: minUpV, startMoney: startMoneyV,
      crashPenalty: +(0.20 + tg*0.60).toFixed(2),
      latePenalty:  +(0.20 + tg*0.40).toFixed(2),
    };
    if(openCostV   != null) out.openCost   = openCostV;
    if(upgCostV    != null) out.upgCost    = upgCostV;
    if(rwOpenCostV != null) out.rwOpenCost = rwOpenCostV;

    // — respect-manual: убрать поля, заданные оператором (НЕ включаем их в результат) —
    const objLocked = new Set(['stars','time','timeTier','money','lives','maxLate','maxCrash','upg','metric','race']);
    for(const key of lockedSet){
      if(objLocked.has(key)) delete (objective as any)[key];
      else delete (out as any)[key];
    }
    if(lockedSet.has('startMoney')) delete (out as any).startMoney;
    if(lockedSet.has('crashPenalty')) delete (out as any).crashPenalty;
    if(lockedSet.has('latePenalty')) delete (out as any).latePenalty;

    // — гарантия проходимости: ослабляем пороги, пока все тиры не зелёные —
    // валидируем тот же стамплённый уровень + locked-значения оператора (baseObj).
    const baseObj = (lvRef && (lvRef as any).objective) || {};
    function validationLevel(): Level {
      const sl = simLevel(objective.stars || stars, startMoneyV) as any;
      sl.objective = { ...baseObj, ...objective };
      return sl as Level;
    }
    for(let guard=0; guard<12; guard++){
      const rep = validatePassable(validationLevel());
      if(rep.ok) break;
      if(objective.timeTier) objective.timeTier = objective.timeTier.map(n => Math.ceil(n*1.15));
      if(objective.upg)      objective.upg      = objective.upg.map(n => Math.max(1, Math.floor(n*0.9)));
      if(objective.stars){ objective.stars = objective.stars.map(n => Math.max(1, Math.floor(n*0.95))); objective.target = objective.stars[2]; }
      // деньги пересчитываем под изменившиеся stars (тот же ec, что у валидатора)
      if(objective.money !== undefined){ const m = calcMoney(objective.stars || stars); if(m) objective.money = m; else delete (objective as any).money; }
    }
    return out;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // СБОРЩИК ГЕНЕРИРУЕМОЙ КАМПАНИИ (L12–L50). Скелеты (раскладка + события) — в
  // CAMPAIGN_LAYOUTS / CAMPAIGN_PLAN (04-config-levels.ts); здесь каждый скелет
  // достраивается до полного уровня: target из кривой campaignTarget(n) (или override
  // скелета), акцент из ротации archetypeForIndex(n), пороги/цены/штрафы — autoDifficulty.
  // Живёт в этом модуле, а не в 04: ARCHETYPES объявлен здесь const'ом — из 04 вызов
  // autoDifficulty упал бы в TDZ. Модуль исполняется между 05 и 06, т.е. ДО того, как
  // кто-либо (стейт, меню, validateGame) читает длину кампании. Детерминированно —
  // без Math.random: одни и те же 50 уровней в каждой сессии.
  for(const spec of CAMPAIGN_PLAN){
    const n = LEVELS.length + 1;                        // 1-based номер собираемого уровня
    const layout = CAMPAIGN_LAYOUTS[spec.lay]();        // своя копия — цены штампуются per-уровень
    const target = spec.target ?? campaignTarget(n);
    const arch   = spec.archetype ?? archetypeForIndex(n);
    const lv: Level = { layout, events: spec.events, target, archetype: arch } as Level;
    const k = autoDifficulty(target, lv, { archetype: arch });
    lv.pace = k.pace; lv.objective = k.objective;
    lv.maxUp = k.maxUp; lv.minUp = k.minUp; lv.startMoney = k.startMoney;
    lv.crashPenalty = k.crashPenalty; lv.latePenalty = k.latePenalty;
    // штамп единых цен карты на объекты раскладки (движок читает их per-объект) —
    // та же схема, что при экспорте из «Разметки» (см. stampedLevel в тестах)
    if(k.openCost != null) layout.hangars.forEach(h => { if(h.open === false) h.openCost = k.openCost; });
    if(k.upgCost  != null) layout.hangars.forEach(h => { h.upgCost = k.upgCost; });
    if(k.rwOpenCost != null) layout.runways.forEach(rw => {
      if(rw.landingOpen === false) rw.landingCost = k.rwOpenCost;
      if(rw.takeoffOpen === false) rw.takeoffCost = k.rwOpenCost;
    });
    LEVELS.push(lv);
  }

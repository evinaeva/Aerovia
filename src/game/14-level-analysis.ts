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

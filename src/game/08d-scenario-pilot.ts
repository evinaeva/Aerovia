// ===== 08d-scenario-pilot — autopilot for tuning preview scenarios =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: scenarioPilot.
// Reads: 04b (MT_META_VALUES); 06 (planes, runways, bays, field, ui, spawnTimer, spawnedTotal, planeSeq, econ);
//         08 (spawnPlane, freeRes, curNeed); 08b (dirOut, PLANE_LEN); 08c (planePrimaryState).
//
// Called from update() (08b) only when window.__SUPPRESS_GOALS is set (tuning preview test mode).
// Drives one demo plane through the scenario selected in MT_META_VALUES.SCENARIO.
// Normal player input still works — the player can take over any routed plane.

  let _spPhase = 0;
  let _spPlane: any = null;
  let _spDelay = 0;
  let _spLastScen = '';

  function _spClear(){ _spPlane = null; _spPhase = 0; }
  function _spKill(){
    if(_spPlane && !_spPlane.dead){ _spPlane.dead = true; freeRes(_spPlane); }
    _spClear();
  }

  // Route the plane to the nearest open runway (landing from air, or takeoff from ground).
  function _spToRunway(pl: any){
    const forLand = pl.zone === 'air';
    const avail = runways.filter(r => !r.closed && (forLand ? r.landingOpen : r.takeoffOpen));
    if(!avail.length) return;
    const r = avail.reduce((best, r) => Math.abs(r.cy - pl.y) < Math.abs(best.cy - pl.y) ? r : best);
    pl.path = []; pl.autoPath = true;
    if(forLand){ pl.approachR = r; pl.path.push({ x: r.x + r.w - PLANE_LEN() * 0.5, y: r.cy }); }
    else       { pl.path.push({ x: r.stopX + 8 * ui, y: r.cy }); }
    pl.moving = true;
  }

  // Route the plane to the bay that matches its current service need.
  // Returns false when no open matching bay is available.
  function _spToBay(pl: any): boolean {
    const need = curNeed(pl);
    const b = bays.find(bb => bb.open && bb.type === need && !bb.occupied);
    if(!b) return false;
    const o = dirOut(b);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const vert = Math.abs(o.dy) > Math.abs(o.dx);
    const half = (vert ? b.h : b.w) / 2;
    // Approach point on gate axis + bay centre (game captures plane at approach point when BAY_APPROACH_DIST>0,
    // or on rect-enter otherwise — both are covered by this two-waypoint path).
    pl.path = [
      { x: cx + o.dx * (half + 22 * ui), y: cy + o.dy * (half + 22 * ui) },
      { x: cx, y: cy },
    ];
    pl.moving = true; pl.autoPath = true;
    return true;
  }

  // Spawn a field plane (no air arrival): one optional service then depart.
  // Placed near field centre-left, offset from depot plane (depot is at x0+PL*0.7, mid-y).
  function _spSpawnField(svcType: string): any {
    const requests = svcType === 'depart' ? ['depart'] : [svcType, 'depart'];
    const nSvc = svcType === 'depart' ? 0 : 1;
    const r0 = runways.length ? runways[0] : null;
    const py = r0 ? r0.cy + 28 * ui : field.y0 * 0.4 + field.y1 * 0.6;
    const pl: any = {
      id: ++planeSeq, x: field.x0 + PLANE_LEN() * 2.5, y: py, ang: 0,
      vip: false, emergency: false, medical: false,
      requests, reqIndex: 0, nSvc,
      zone: 'field', entering: false, path: [], moving: false, selected: false, autoPath: false,
      landing: false, takeoff: false, exiting: false, approachR: null,
      runway: null, bay: null,
      airTime: Infinity, airMax: Infinity, waitMult: 2,
      groundTime: Infinity, groundMax: Infinity,
      serveTime: 0, serveMax: 0, landedAt: 0,
      halfPay: false, dead: false,
      reward: econ ? econ.svcReward : 100,
    };
    planes.push(pl); spawnedTotal++;
    return pl;
  }

  function scenarioPilot(dt: number){
    const scen = (MT_META_VALUES.SCENARIO as string) || 'none';
    if(scen === 'none'){ _spKill(); _spLastScen = 'none'; return; }
    if(scen !== _spLastScen){ _spKill(); _spLastScen = scen; _spDelay = 0.5; }
    if(_spPlane && _spPlane.dead) _spClear();
    // While managing a plane, hold the auto-spawn timer back so no extra planes appear.
    if(_spPlane) spawnTimer = Math.max(spawnTimer, 3);
    if(_spDelay > 0){ _spDelay -= dt; return; }

    switch(scen){
      case 'landing': _spLanding(); break;
      case 'takeoff': _spTakeoff(); break;
      case 'taxi':    _spTaxi();    break;
      case 'service': _spService(); break;
      default:        _spCycle();   break;  // 'complete_cycle'
    }
  }

  // --- посадка: прилёт с воздуха → посадка на ВПП → выкат на апрон → сброс ---
  function _spLanding(){
    if(!_spPlane){
      spawnPlane(); _spPlane = planes[planes.length - 1];
      spawnTimer = 30; return;
    }
    const st = planePrimaryState(_spPlane);
    if(st === 'ARRIVING') return;
    if(st === 'AIRBORNE'){ if(!_spPlane.moving) _spToRunway(_spPlane); return; }
    if(st === 'LANDING' || st === 'ON_RUNWAY') return;  // let rollout complete
    // TAXIING (rolling to apron) or IDLE_FIELD — landing phase done
    _spKill(); _spDelay = 2;
  }

  // --- взлёт: борт на апроне → руление к ВПП → взлёт → сброс ---
  function _spTakeoff(){
    if(!_spPlane){ _spPlane = _spSpawnField('depart'); spawnTimer = 30; return; }
    const st = planePrimaryState(_spPlane);
    if(st === 'IDLE_FIELD'){ if(!_spPlane.moving) _spToRunway(_spPlane); return; }
    if(st === 'TAXIING' || st === 'ON_RUNWAY' || st === 'TAKEOFF') return;
    if(_spPlane.dead){ _spClear(); _spDelay = 1.5; }
  }

  // --- руление: борт на апроне → диагональный перегон через поле → ВПП → взлёт ---
  function _spTaxi(){
    if(!_spPlane){ _spPlane = _spSpawnField('depart'); spawnTimer = 30; _spPhase = 0; return; }
    const st = planePrimaryState(_spPlane);
    if(st === 'IDLE_FIELD'){
      if(_spPhase === 0){
        // Cross apron diagonally to demonstrate turning and path-following
        const mx = field.x0 + (field.x1 - field.x0) * 0.55;
        const my = _spPlane.y < (field.y0 + field.y1) / 2 ? field.y1 - 36 * ui : field.y0 + 36 * ui;
        _spPlane.path = [{ x: mx, y: my }]; _spPlane.moving = true; _spPlane.autoPath = true;
        _spPhase = 1; return;
      }
      if(_spPhase === 1){ _spToRunway(_spPlane); _spPhase = 2; return; }
    }
    if(st === 'TAXIING' || st === 'ON_RUNWAY' || st === 'TAKEOFF') return;
    if(_spPlane.dead){ _spClear(); _spPhase = 0; _spDelay = 1.5; }
  }

  // --- обслуживание: борт на апроне → ангар → сервис → выезд → ВПП → взлёт ---
  function _spService(){
    if(!_spPlane){
      const b = bays.find(bb => bb.open && bb.type !== 'deice');
      _spPlane = _spSpawnField(b ? b.type : 'depart');
      spawnTimer = 30; return;
    }
    const st = planePrimaryState(_spPlane);
    if(st === 'IDLE_FIELD'){
      const need = curNeed(_spPlane);
      if(need === 'depart'){ if(!_spPlane.moving) _spToRunway(_spPlane); return; }
      if(!_spPlane.moving){
        if(!_spToBay(_spPlane)) _spPlane.reqIndex++;  // no matching bay — skip service
      }
      return;
    }
    if(st === 'TAXIING' || st === 'ENTERING_BAY' || st === 'IN_SERVICE' || st === 'EXITING_BAY') return;
    if(st === 'ON_RUNWAY' || st === 'TAKEOFF') return;
    if(_spPlane.dead){ _spClear(); _spDelay = 1.5; }
  }

  // --- полный цикл: прилёт → посадка → обслуживание → взлёт → повтор ---
  function _spCycle(){
    if(!_spPlane){
      spawnPlane(); _spPlane = planes[planes.length - 1];
      spawnTimer = 30; return;
    }
    const st = planePrimaryState(_spPlane);
    if(st === 'ARRIVING') return;
    if(st === 'AIRBORNE'){ if(!_spPlane.moving) _spToRunway(_spPlane); return; }
    if(st === 'LANDING' || st === 'ON_RUNWAY') return;
    if(st === 'IDLE_FIELD'){
      const need = curNeed(_spPlane);
      if(need === 'depart'){ if(!_spPlane.moving) _spToRunway(_spPlane); return; }
      if(!_spPlane.moving){
        if(!_spToBay(_spPlane)) _spPlane.reqIndex++;  // no bay — skip to depart
      }
      return;
    }
    if(st === 'TAXIING' || st === 'ENTERING_BAY' || st === 'IN_SERVICE' || st === 'EXITING_BAY') return;
    if(st === 'TAKEOFF') return;
    if(_spPlane.dead){ _spClear(); _spDelay = 1.5; }
  }

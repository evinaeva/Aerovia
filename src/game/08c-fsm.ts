// ===== 08c-fsm — named plane FSM states + planePrimaryState() helper =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: PlaneState, planePrimaryState.
// Reads: nothing — derives state from plane flags only.
//
// The game uses an implicit FSM (zone + bayPhase + entering/landing/takeoff flags).
// This module adds named states for readability in the editor, HUD, debug overlay,
// and future extensions. Does NOT change any game logic.

  // Поимённые состояния FSM самолёта (производные от runtime-флагов).
  type PlaneState =
    | 'ARRIVING'       // глиссада с правого края до точки зависания (zone=air, entering)
    | 'AIRBORNE'       // ожидает в зоне (zone=air, !entering), убывает airTime
    | 'LANDING'        // посадка на ВПП (zone=runway, landing)
    | 'ON_RUNWAY'      // стоит на ВПП, ждёт маршрута (zone=runway, !landing, !takeoff)
    | 'TAKEOFF'        // взлётный разгон (zone=runway, takeoff)
    | 'TAXIING'        // рулит по полю по маршруту (zone=field, path.length>0)
    | 'IDLE_FIELD'     // стоит на поле без маршрута (zone=field, !path.length)
    | 'ENTERING_BAY'   // заезжает носом к дальней стене (zone=bay, bayPhase!=='out', serveTime>serveMax*0.9)
    | 'IN_SERVICE'     // обслуживается (zone=bay, bayPhase!=='out', serveTime>0)
    | 'EXITING_BAY'    // разворот + выезд (zone=bay, bayPhase==='out')
    | 'DEPARTED';      // вылетел (dead=true — плоскость сразу удаляется после depart())

  // Выводит текущее именованное FSM-состояние из runtime-флагов самолёта.
  // Только чтение: объект самолёта не изменяется.
  function planePrimaryState(pl: any): PlaneState {
    if(pl.dead) return 'DEPARTED';
    if(pl.zone==='air')    return pl.entering ? 'ARRIVING' : 'AIRBORNE';
    if(pl.zone==='runway'){
      if(pl.landing)  return 'LANDING';
      if(pl.takeoff)  return 'TAKEOFF';
      return 'ON_RUNWAY';
    }
    if(pl.zone==='bay'){
      if(pl.bayPhase==='out') return 'EXITING_BAY';
      // IN_SERVICE начинается, как только заезд завершён (борт у дальней стены);
      // отличаем по тому, что along ≈ parkA — нет способа точно без геометрии,
      // поэтому используем serveMax как прокси: если таймер запущен — сервис идёт
      return (pl.serveMax > 0) ? 'IN_SERVICE' : 'ENTERING_BAY';
    }
    // zone==='field'
    return (pl.path && pl.path.length > 0) ? 'TAXIING' : 'IDLE_FIELD';
  }

// ===== 12-achievements-medals — achievements engine (ACH) + the medals screen =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: ACH, openMedals, renderMedals, MEDAL_RAR.
// Reads: 06 (save, planes, money, combo, gameTime, runCrashes, runPenalties, debug); 04 (K, LEVELS); 03 (t); 07 (SND, SEASON_DIVISIONS); 11 (SVGIC, hideAllScreens, saveGame).

  const ACH = (() => {
    // анти-шум: не больше RUN_CAP медалей за раунд (остальные придут в следующих
    // сменах — условия перепроверяются), уведомления не чаще TOAST_GAP_MS
    const RUN_CAP=2, TOAST_GAP_MS=60000, TOAST_SHOW_MS=4000;
    const S: { ach: string[]; stats: Record<string, number> } = { ach:[], stats:{landed:0,services:0,departed:0,earned:0,vip:0,noCrashStreak:0,perfect:0} };
    let unlocked: Set<string> = new Set();
    let run: any = null;
    function newRun(){ run = {landed:0,services:0,departed:0,opens:0,upgrades:0,peakAir:0,
      landTimes:[], types:new Set(), debug:false, time:0, given:0}; }
    newRun();

    interface Def { id: string; tier: number; ic: string; prog?: (s: Record<string, number>) => number[]; pending?: boolean; comp?: boolean; hidden?: boolean; }
    const defs: Def[] = [
      // --- Тир 1: лайтовые ---
      {id:'land1',   tier:1, ic:'🛬'},
      {id:'svc1',    tier:1, ic:'🧰'},
      {id:'takeoff1',tier:1, ic:'🛫'},
      {id:'money1',  tier:1, ic:'🪙'},
      {id:'bayopen1',tier:1, ic:'🏗️'},
      {id:'upg1',    tier:1, ic:'⬆️'},
      {id:'pause',   tier:1, ic:'⏸️'},
      {id:'level1',  tier:1, ic:'✅'},
      {id:'vip1',    tier:1, ic:'💛'},
      {id:'land10',  tier:1, ic:'🎓', prog:S=>[S.landed,10]},
      // --- Тир 2: обычные ---
      {id:'land100', tier:2, ic:'🌊', prog:S=>[S.landed,100]},
      {id:'svc100',  tier:2, ic:'🔧', prog:S=>[S.services,100]},
      {id:'earn1000',tier:2, ic:'💵', prog:S=>[S.earned,1000]},
      {id:'fullchain',tier:2,ic:'🎯'},
      {id:'nopenalty',tier:2,ic:'🧊'},
      {id:'nolife',  tier:2, ic:'❤️'},
      {id:'air5',    tier:2, ic:'🛫'},
      {id:'star3',   tier:2, ic:'🌟'},
      {id:'vip25',   tier:2, ic:'💼', prog:S=>[S.vip,25]},
      {id:'baymax',  tier:2, ic:'🛠️'},
      // --- Тир 3: сложные ---
      {id:'nocrash', tier:3, ic:'☁️'},
      {id:'perfect', tier:3, ic:'💎'},
      {id:'air8',    tier:3, ic:'🤹'},
      {id:'speed20', tier:3, ic:'⚡'},
      {id:'minimalist',tier:3,ic:'🪨'},
      {id:'millionaire',tier:3,ic:'💰', prog:S=>[S.earned,1000000]},
      {id:'combo10', tier:3, ic:'🔥'},
      {id:'marathon',tier:3, ic:'🏃', pending:true},
      // --- Тир 4: задротские ---
      {id:'streak1000',tier:4,ic:'🧠', prog:S=>[S.noCrashStreak,1000]},
      {id:'land10000',tier:4,ic:'🎖️', prog:S=>[S.landed,10000]},
      {id:'all3star',tier:4, ic:'⭐'},
      {id:'ascetic', tier:4, ic:'🧘'},
      {id:'perfectionist',tier:4,ic:'🥇', prog:S=>[S.perfect,10]},
      {id:'daily7',  tier:4, ic:'📅', pending:true},
      {id:'sleepless',tier:4,ic:'🌙', pending:true},
      {id:'surv500', tier:4, ic:'🛟'},
      {id:'combo50', tier:4, ic:'🔥', pending:true},
      // --- Соревновательные (ранговые): пороговые НАВСЕГДА, по глобальному рейтингу.
      //     comp:true → НЕ входят в требование «Легенды» (Легенда = мастерство соло-игры,
      //     не зависит от чужих результатов и наличия сервера). См. ACH.onRank / Leaderboard. ---
      {id:'rank_top100', tier:4, ic:'🏅', comp:true},
      {id:'rank_top10',  tier:4, ic:'🏆', comp:true},
      {id:'rank_1',      tier:4, ic:'👑', comp:true},
      // --- Лига сезона (MVP Фаза 1, план: docs/design/game-design/season-leagues.md):
      //     пороговые НАВСЕГДА бейджи дивизиона — тот же приём, что ранг-медали выше
      //     (comp:true, мимо «Легенды»). Ротирующаяся косметика сезона — ОТДЕЛЬНО, в
      //     Leaderboard.season (стор pf_season_rewards_v1), не в этом Set. ---
      {id:'season_bronze',   tier:4, ic:'🥉', comp:true},
      {id:'season_silver',   tier:4, ic:'🥈', comp:true},
      {id:'season_gold',     tier:4, ic:'🥇', comp:true},
      {id:'season_platinum', tier:4, ic:'💠', comp:true},
      {id:'season_diamond',  tier:4, ic:'💎', comp:true},
      {id:'legend',  tier:4, ic:'🛐'},
      // --- Тир 5: секретные / фановые (скрыты до получения) ---
      {id:'crash10s',tier:5, ic:'💥', hidden:true},
      {id:'asleep',  tier:5, ic:'😴', hidden:true},
      {id:'crashbay',tier:5, ic:'🅿️', hidden:true},
      {id:'crashrw', tier:5, ic:'💢', hidden:true},
      {id:'groundto',tier:5, ic:'⌛', hidden:true},
      {id:'moneyneg',tier:5, ic:'🤑', hidden:true},
      {id:'longshift',tier:5,ic:'🕰️', hidden:true, pending:true},
      {id:'zoo',     tier:5, ic:'🦁', hidden:true},
    ];

    // Необязательное зеркало во внешний сервис достижений (нативный Play Games в обёртке).
    // Ставится из 12b-native-play-games; на вебе остаётся null → no-op.
    let mirror: ((id: string) => void) | null = null;
    // Зеркалим разблокировку в нативный Play Games ОТЛОЖЕННО: системный тост Google
    // нельзя приглушить/подвинуть, поэтому копим id и сливаем в безопасный момент
    // (конец уровня / пауза / экран рейтинга) — чтобы большая гугловская плашка не лезла
    // посреди игры. Наш деликатный тост (toastAch) при этом показывается сразу.
    let mirrorQueue: string[] = [];
    function mirrorAch(id: string){ if(mirror) mirrorQueue.push(id); }
    function flushMirror(){ if(!mirror){ mirrorQueue.length=0; return; } while(mirrorQueue.length){ const id=mirrorQueue.shift()!; try{ mirror(id); }catch(e){} } }
    function persist(){ save.ach=[...unlocked]; save.stats=S.stats; saveGame(); }
    // Третья и далее медаль за раунд СГОРАЕТ: отложенной выдачи нет, в новом раунде
    // «за прошлое» ничего не приходит. Одноразовые (за 1 действие) можно получить,
    // только совершив действие заново; накопительные прогресса не теряют
    // (save.stats растёт) и придут при следующем срабатывании счётчика.
    function give(id: string){
      if(unlocked.has(id)) return;
      if(run.given>=RUN_CAP) return;
      const d=defs.find(x=>x.id===id); if(!d) return;
      run.given++;
      unlocked.add(id); persist(); toastAch(d); mirrorAch(id);
      checkLegend();
    }
    function checkLegend(){
      if(unlocked.has('legend')) return;
      const need=defs.filter(x=>x.id!=='legend' && !x.pending && !x.comp);
      if(need.every(x=>unlocked.has(x.id))) give('legend');
    }
    // выдать медаль МИМО RUN_CAP (для редких крупных событий — ранг в глобальном рейтинге).
    // Лимит «2 за раунд» сделан против шума накопительных медалей; ранг-медаль им не является.
    function giveForce(id: string){
      if(unlocked.has(id)) return;
      const d=defs.find(x=>x.id===id); if(!d) return;
      unlocked.add(id); persist(); toastAch(d); mirrorAch(id); checkLegend();
    }

    // всплывашка: очередь, по одной, не чаще раза в минуту; на границе раундов
    // остаток очереди показывается сразу (flushToasts) — в новый раунд не утекает
    let q: Def[]=[], showing=false, lastShown=-1e9, gapTimer: any=null;
    function toastAch(d: Def){ q.push(d); if(!showing) pump(); }
    function pump(){
      const el=document.getElementById('achToast')!;
      if(!q.length){ showing=false; return; }
      showing=true;
      const wait = lastShown + TOAST_GAP_MS - performance.now();
      if(wait>0){ gapTimer=setTimeout(()=>{ gapTimer=null; pump(); }, wait); return; }
      lastShown = performance.now();
      const d=q.shift()!;
      document.getElementById('achIc')!.textContent=d.ic;
      document.getElementById('achTtl')!.textContent=t('ach.'+d.id+'.t');
      document.getElementById('achDsc')!.textContent=t('ach.'+d.id+'.d');
      SND.medal();
      el.classList.add('show');
      setTimeout(()=>{ el.classList.remove('show'); setTimeout(pump, 360); }, TOAST_SHOW_MS);
    }
    function flushToasts(){
      lastShown=-1e9;
      if(gapTimer){ clearTimeout(gapTimer); gapTimer=null; pump(); }
    }

    return {
      defs,
      init(){ S.ach=Array.isArray(save.ach)?save.ach:[]; Object.assign(S.stats, save.stats||{}); unlocked=new Set(S.ach); },
      onLevelStart(){ flushToasts(); newRun(); },   // рестарт посреди раунда: недопоказанное — сразу, хвостов нет
      onPlaneTouched(pl: any){ if(pl) pl.everTouched=true; },
      onPause(){ give('pause'); flushMirror(); },   // пауза — безопасный момент слить нативные плашки
      onLand(_pl?: any){
        S.stats.landed++; run.landed++; S.stats.noCrashStreak++;
        run.landTimes.push(gameTime);
        give('land1');
        if(S.stats.landed>=10) give('land10');
        if(S.stats.landed>=100) give('land100');
        if(S.stats.landed>=10000) give('land10000');
        if(S.stats.noCrashStreak>=1000) give('streak1000');
        if(run.landed>=500) give('surv500');
        const cut=gameTime-60; while(run.landTimes.length && run.landTimes[0]<cut) run.landTimes.shift();
        if(run.landTimes.length>=20) give('speed20');
      },
      onService(_pl?: any){ S.stats.services++; run.services++; give('svc1'); if(S.stats.services>=100) give('svc100'); },
      onDepart(pl: any, pay: number){
        S.stats.departed++; run.departed++; S.stats.earned+=Math.max(0,pay);
        run.types.add(pl.emergency?'emg':(pl.vip?'vip':'std'));
        give('takeoff1'); if(S.stats.earned>=1) give('money1');
        if(S.stats.earned>=1000) give('earn1000');
        if(S.stats.earned>=1000000) give('millionaire');
        if(pl.vip){ S.stats.vip++; give('vip1'); if(S.stats.vip>=25) give('vip25'); }
        if(pl.nSvc>=2) give('fullchain');
        if(combo>=10) give('combo10');
        if(combo>=50) give('combo50');
        if(run.types.has('std')&&run.types.has('vip')&&run.types.has('emg')) give('zoo');
        persist();
      },
      onBayOpen(_b?: any){ run.opens++; give('bayopen1'); },
      onBayUpgrade(b: any){ run.upgrades++; give('upg1'); if(b.lvl>=K.BAY_MAX_LVL) give('baymax'); },
      onGroundTimeout(_pl?: any){ give('groundto'); },
      onCrash(pl: any, reason: string){
        S.stats.noCrashStreak=0; persist();
        if(gameTime<10) give('crash10s');
        if(reason==='loss.collisionBay') give('crashbay');
        if(reason==='loss.collisionRunway') give('crashrw');
        if(reason==='loss.airTimeout' && !pl.everTouched) give('asleep');
      },
      onTick(dt: number){
        if(debug.infiniteLives||debug.richStart) run.debug=true;
        run.time+=dt;
        let air=0; for(const p of planes) if(!p.dead && p.zone==='air') air++;
        if(air>run.peakAir) run.peakAir=air;
        if(run.peakAir>=5) give('air5');
        if(run.peakAir>=8) give('air8');
        if(money<0) give('moneyneg');
        if(run.time>=900) give('marathon');
        if(run.time>=1800) give('longshift');
        if(run.time>=3600) give('sleepless');
      },
      onLevelEnd(passed: boolean, stars: number, livesFull: boolean){
        const clean=!run.debug;
        if(passed){
          give('level1');
          if(clean && livesFull) give('nolife');
          if(clean && runPenalties===0) give('nopenalty');
          if(clean && runCrashes===0) give('nocrash');
          if(clean && run.opens===0) give('minimalist');
        }
        if(stars>=3){
          give('star3');
          if(clean && livesFull) give('perfect');
          if(clean && run.opens===0 && run.upgrades===0) give('ascetic');
          S.stats.perfect++; if(S.stats.perfect>=10) give('perfectionist');
          let all=LEVELS.length>0; for(let i=0;i<LEVELS.length;i++) if((save.stars[i]||0)<3) all=false;
          if(all) give('all3star');
        } else {
          S.stats.perfect=0;
        }
        persist();
        checkLegend();    // «Легенда» (вся коллекция) — на итогах раунда, не посреди игры
        flushToasts();    // остаток наших уведомлений — на экран итогов, в новый раунд не утекает
        flushMirror();    // нативные (гугловские) плашки — пачкой на итогах, не посреди игры
      },
      // ранг-медали (пороговые навсегда): лучший достигнутый ранг по ЛЮБОМУ срезу
      // (all-time/month/week) открывает медаль. Зовётся после Leaderboard.submitRun().
      onRank(ranks: Record<string, number>){
        if(!ranks) return;
        let best=Infinity; for(const k in ranks){ const r=ranks[k]; if(r) best=Math.min(best, r); }
        if(best<=100) giveForce('rank_top100');
        if(best<=10)  giveForce('rank_top10');
        if(best===1)  giveForce('rank_1');
        flushMirror();
      },
      // сезонные дивизион-бейджи (пороговые навсегда): достиг дивизиона хоть раз в этом
      // сезоне — бейдж твой, и все дивизионы НИЖЕ засчитываются кумулятивно (как выше у
      // ранг-медалей top100→top10→#1). Зовётся после Leaderboard.season.standing().
      onSeasonDivision(divisionIdx: number|null){
        if(divisionIdx==null || divisionIdx<0) return;
        SEASON_DIVISIONS.forEach((d,i)=>{ if(i<=divisionIdx) giveForce('season_'+d.id); });
        flushMirror();
      },
      flushToasts, flushMirror,
      setMirror(fn: ((id: string) => void) | null){ mirror = (typeof fn === 'function') ? fn : null; },
      // анти-чит (клиентский, первый слой): та же метка run.debug, что гейтит достижения
      // (`clean` в onLevelEnd) — Survival зовёт это перед отправкой в Leaderboard.submitRun,
      // чтобы читовые заходы (infiniteLives/richStart) не попадали в рейтинг и ранг-медали.
      isCleanRun(){ return !run.debug; },
      list(){
        const out: any[]=[];
        for(const d of defs){
          let prog=null;
          if(d.prog) prog=d.prog(S.stats);
          else if(d.id==='all3star'){ let c=0; for(let i=0;i<LEVELS.length;i++) if((save.stars[i]||0)>=3)c++; prog=[c,LEVELS.length]; }
          else if(d.id==='legend'){ const tot=defs.filter(x=>x.id!=='legend'&&!x.pending&&!x.comp); prog=[tot.filter(x=>unlocked.has(x.id)).length, tot.length]; }
          out.push({id:d.id,tier:d.tier,ic:d.ic,title:t('ach.'+d.id+'.t'),desc:t('ach.'+d.id+'.d'),hidden:!!d.hidden,pending:!!d.pending,got:unlocked.has(d.id),prog});
        }
        return out;
      },
    };
  })();

  // ---- экран медалей ----
  let medalFrom='start';
  const MEDAL_RAR=['r-common','r-rare','r-epic','r-legend','r-legend'];   // tier 1..5 → редкость диска
  function renderMedals(){
    const list: any[]=ACH.list();
    const got=list.filter(m=>m.got).length, total=list.length;
    document.getElementById('medalCount')!.innerHTML =
      SVGIC('medal')+` <b>${got}</b> <span class="muted">/ ${total}</span>`;
    const grid=document.getElementById('medalGrid')!; grid.innerHTML='';
    const pct=total?Math.round(got/total*100):0;
    const prog=document.createElement('div'); prog.className='medal-progress'; prog.style.gridColumn='1 / -1';
    prog.innerHTML=`<div class="medal-progress__track"><div class="medal-progress__fill" style="width:${pct}%"></div></div>`;
    grid.appendChild(prog);
    for(const tier of [1,2,3,4,5]){
      const items=list.filter(x=>x.tier===tier); if(!items.length) continue;
      const head=document.createElement('div'); head.className='medal-cat';
      head.textContent=t('medals.tier'+tier); grid.appendChild(head);
      for(const m of items){
        const masked = m.hidden && !m.got;             // секретная и ещё не открыта
        const rar = MEDAL_RAR[tier-1]||'r-common';
        const el=document.createElement('div');
        el.className='medal2 '+rar+(m.got?' unlocked':' locked');
        const ic = masked ? '❔' : m.ic;
        const title = masked ? t('medals.secretTitle') : m.title;
        let desc = masked ? t('medals.secretDesc') : m.desc;
        if(m.pending && !m.got && !masked) desc += t('medals.pendingNote');
        let foot;
        if(m.prog && !m.got && !masked){
          const c=Math.min(m.prog[0],m.prog[1]);
          foot=`<div class="medal2__desc" style="color:var(--m-gold);font-weight:800">${fmtNum(c)} / ${fmtNum(m.prog[1])}</div>`;
        } else foot=`<span class="medal2__rar">${t('medals.tier'+tier)}</span>`;
        el.innerHTML=(m.got?`<span class="medal2__check">${SVGIC('check')}</span>`:'')+
          `<div class="medal2__disc">${m.got?ic:SVGIC('lock')}</div>`+
          `<div class="medal2__name">${title}</div><div class="medal2__desc">${desc}</div>${foot}`;
        grid.appendChild(el);
      }
    }
  }
  function openMedals(from: string){ medalFrom=from||'start'; renderMedals(); hideAllScreens();
    document.getElementById('medalScreen')!.classList.remove('hidden'); }

// @ts-nocheck -- TODO(ts-migration): type this module, then remove this line
  const ACH = (() => {
    // анти-шум: не больше RUN_CAP медалей за раунд (остальные придут в следующих
    // сменах — условия перепроверяются), уведомления не чаще TOAST_GAP_MS
    const RUN_CAP=2, TOAST_GAP_MS=60000, TOAST_SHOW_MS=4000;
    const S = { ach:[], stats:{landed:0,services:0,departed:0,earned:0,vip:0,noCrashStreak:0,perfect:0} };
    let unlocked = new Set();
    let run = null;
    function newRun(){ run = {landed:0,services:0,departed:0,opens:0,upgrades:0,peakAir:0,
      landTimes:[], types:new Set(), debug:false, time:0, given:0}; }
    newRun();

    const defs = [
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

    function persist(){ save.ach=[...unlocked]; save.stats=S.stats; saveGame(); }
    // Третья и далее медаль за раунд СГОРАЕТ: отложенной выдачи нет, в новом раунде
    // «за прошлое» ничего не приходит. Одноразовые (за 1 действие) можно получить,
    // только совершив действие заново; накопительные прогресса не теряют
    // (save.stats растёт) и придут при следующем срабатывании счётчика.
    function give(id){
      if(unlocked.has(id)) return;
      if(run.given>=RUN_CAP) return;
      const d=defs.find(x=>x.id===id); if(!d) return;
      run.given++;
      unlocked.add(id); persist(); toastAch(d);
      checkLegend();
    }
    function checkLegend(){
      if(unlocked.has('legend')) return;
      const need=defs.filter(x=>x.id!=='legend' && !x.pending && !x.comp);
      if(need.every(x=>unlocked.has(x.id))) give('legend');
    }
    // выдать медаль МИМО RUN_CAP (для редких крупных событий — ранг в глобальном рейтинге).
    // Лимит «2 за раунд» сделан против шума накопительных медалей; ранг-медаль им не является.
    function giveForce(id){
      if(unlocked.has(id)) return;
      const d=defs.find(x=>x.id===id); if(!d) return;
      unlocked.add(id); persist(); toastAch(d); checkLegend();
    }

    // всплывашка: очередь, по одной, не чаще раза в минуту; на границе раундов
    // остаток очереди показывается сразу (flushToasts) — в новый раунд не утекает
    let q=[], showing=false, lastShown=-1e9, gapTimer=null;
    function toastAch(d){ q.push(d); if(!showing) pump(); }
    function pump(){
      const el=document.getElementById('achToast');
      if(!q.length){ showing=false; return; }
      showing=true;
      const wait = lastShown + TOAST_GAP_MS - performance.now();
      if(wait>0){ gapTimer=setTimeout(()=>{ gapTimer=null; pump(); }, wait); return; }
      lastShown = performance.now();
      const d=q.shift();
      document.getElementById('achIc').textContent=d.ic;
      document.getElementById('achTtl').textContent=t('ach.'+d.id+'.t');
      document.getElementById('achDsc').textContent=t('ach.'+d.id+'.d');
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
      onPlaneTouched(pl){ if(pl) pl.everTouched=true; },
      onPause(){ give('pause'); },
      onLand(){
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
      onService(){ S.stats.services++; run.services++; give('svc1'); if(S.stats.services>=100) give('svc100'); },
      onDepart(pl, pay){
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
      onBayOpen(){ run.opens++; give('bayopen1'); },
      onBayUpgrade(b){ run.upgrades++; give('upg1'); if(b.lvl>=K.BAY_MAX_LVL) give('baymax'); },
      onGroundTimeout(){ give('groundto'); },
      onCrash(pl, reason){
        S.stats.noCrashStreak=0; persist();
        if(gameTime<10) give('crash10s');
        if(reason==='loss.collisionBay') give('crashbay');
        if(reason==='loss.collisionRunway') give('crashrw');
        if(reason==='loss.airTimeout' && !pl.everTouched) give('asleep');
      },
      onTick(dt){
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
      onLevelEnd(passed, stars, livesFull){
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
        flushToasts();    // остаток уведомлений — на экран итогов, в новый раунд не утекает
      },
      // ранг-медали (пороговые навсегда): лучший достигнутый ранг по ЛЮБОМУ срезу
      // (all-time/month/week) открывает медаль. Зовётся после Leaderboard.submitRun().
      onRank(ranks){
        if(!ranks) return;
        let best=Infinity; for(const k in ranks){ const r=ranks[k]; if(r) best=Math.min(best, r); }
        if(best<=100) giveForce('rank_top100');
        if(best<=10)  giveForce('rank_top10');
        if(best===1)  giveForce('rank_1');
      },
      flushToasts,
      list(){
        const out=[];
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
    const list=ACH.list();
    const got=list.filter(m=>m.got).length, total=list.length;
    document.getElementById('medalCount').innerHTML =
      SVGIC('medal')+` <b>${got}</b> <span class="muted">/ ${total}</span>`;
    const grid=document.getElementById('medalGrid'); grid.innerHTML='';
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
  function openMedals(from){ medalFrom=from||'start'; renderMedals(); hideAllScreens();
    document.getElementById('medalScreen').classList.remove('hidden'); }

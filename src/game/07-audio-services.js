  const SND = (() => {
    const SCALE=[220,261.63,293.66,329.63,392,440,523.25,587.33,659.25]; // A3..E5
    let ac=null, master=null, enabled=true;
    function ensure(){
      if(!enabled) return null;
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      if(!ac){ ac=new AC(); master=ac.createGain(); master.gain.value=0.5; master.connect(ac.destination); }
      if(ac.state==='suspended') ac.resume();
      return ac;
    }
    function tone(freq,dur,type,vol,delay){
      if(!ensure()) return;
      const t0=ac.currentTime+(delay||0);
      const o=ac.createOscillator(), g=ac.createGain();
      o.type=type||'sine'; o.frequency.value=freq;
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(vol||0.3,t0+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+(dur||0.18));
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0+(dur||0.18)+0.05);
    }
    function thud(){ // шумовой удар (крушение)
      if(!ensure()) return;
      const t0=ac.currentTime, dur=0.35;
      const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
      const src=ac.createBufferSource(); src.buffer=buf;
      const f=ac.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(900,t0); f.frequency.exponentialRampToValueAtTime(120,t0+dur);
      const g=ac.createGain(); g.gain.setValueAtTime(0.65,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0);
    }
    function whoosh(){ // мягкий «уфф» near-miss: полосовой шум, проносится и стихает
      if(!ensure()) return;
      const t0=ac.currentTime, dur=0.34;
      const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){ const e=i/d.length; d[i]=(Math.random()*2-1)*Math.sin(Math.PI*e); }
      const src=ac.createBufferSource(); src.buffer=buf;
      const f=ac.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.4;
      f.frequency.setValueAtTime(420,t0); f.frequency.exponentialRampToValueAtTime(1100,t0+dur);
      const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(0.16,t0+0.06); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0);
    }
    function squeal(){ // короткий визг резины при касании: узкополосный шум, тон падает
      if(!ensure()) return;
      const t0=ac.currentTime, dur=0.16;
      const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){ const e=i/d.length; d[i]=(Math.random()*2-1)*(1-e); }
      const src=ac.createBufferSource(); src.buffer=buf;
      const f=ac.createBiquadFilter(); f.type='bandpass'; f.Q.value=6;
      f.frequency.setValueAtTime(1800,t0); f.frequency.exponentialRampToValueAtTime(640,t0+dur);
      const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(0.20,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0);
    }
    const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1)); // случайный индекс ноты гаммы
    // Базовые рецепты звуков. Оставлены только три: тап по меню, щелчок
    // фиксации маршрута (вспышка в конце траектории) и визг колёс при посадке.
    // Остальные игровые звуки — пустышки (намеренно выключены), чтобы не трогать
    // десятки мест вызова.
    const RECIPES = {
      btn(){ tone(SCALE[ri(4,6)],0.05,'triangle',0.12); },                       // тап по кнопке меню
      lock(){ tone(1318.5,0.035,'square',0.13); tone(1760,0.05,'square',0.10,0.025); }, // щелчок: маршрут зафиксирован
      screech(){ squeal(); },                                                    // визг резины — касание ВПП
    };
    // Проигрыватель именованного события: один общий набор рецептов (RECIPES).
    function play(name){
      const fn = RECIPES[name];
      if(fn) fn();
    }
    return {
      setEnabled(v){ enabled=v; },
      btn(){ play('btn'); }, lock(){ play('lock'); }, screech(){ play('screech'); },
      pick(){}, land(){}, dock(){}, served(){}, depart(){}, build(){},
      penalty(){}, crash(){}, medal(){}, alarm(){}, nearmiss(){},
    };
  })();
  const HAP = { // вибрация: Android — да, iOS веб — молча игнорирует (в обёртке будет плагин)
    on:true,
    v(p){ if(this.on && navigator.vibrate){ try{ navigator.vibrate(p); }catch(e){} } },
    tap(){ this.v(12); }, ok(){ this.v([18,40,24]); }, penalty(){ this.v(35); }, crash(){ this.v([60,40,90]); },
    near(){ this.v([10,30,10]); },
  };
  // ---- Analytics: единая шина событий для soft-launch-метрик ----
  // Шина одна на всю игру. Сейчас sink =
  // console + кольцевой буфер в localStorage; реальный провайдер (Firebase/GA4 или
  // свой бэкенд) подключается ОДНОЙ заменой Analytics.sink — ни одна точка track() не
  // меняется. Метрики (retention/session length/churn/conversion/ARPDAU/tutorial
  // dropoff) считаются на стороне провайдера из этих сырых событий.
  const Analytics = (() => {
    const UID_KEY='pf_uid', FIRST_KEY='pf_first_open', BUF_KEY='pf_evt_buffer';
    const BUF_MAX=500;              // кольцевой буфер: не растём бесконечно в localStorage
    const SESSION_GAP=30*60*1000;   // >30 мин без активности — это уже новая сессия
    let userId=null, sessionId=null, seq=0, sessionStartedAt=0, lastEventAt=0;
    let consent=true;               // до согласия события буферизуются, но sink молчит (задел под ATT/GDPR в сторах)
    let buffer=[], started=false, sink=defaultSink;

    const ls = {
      get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
      set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
    };
    function now(){ return Date.now(); }
    function uuid(){
      try{ if(self.crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
      });
    }
    // дефолтный sink: тихий console.debug. Подмени Analytics.sink, чтобы лить провайдеру.
    function defaultSink(evt){ try{ if(console&&console.debug) console.debug('[evt]', evt.event, evt); }catch(e){} }

    function loadBuffer(){ try{ const a=JSON.parse(ls.get(BUF_KEY)); if(Array.isArray(a)) buffer=a; }catch(e){} }
    function persistBuffer(){ ls.set(BUF_KEY, JSON.stringify(buffer.slice(-BUF_MAX))); }

    // базовый контекст, который прикладывается к КАЖДОМУ событию
    function ctxBase(){
      let plat='web';
      try{ if(window.matchMedia && matchMedia('(display-mode: standalone)').matches) plat='pwa'; }catch(e){}
      return {
        userId, sessionId, seq:++seq, ts:now(),
        appVersion: (typeof VERSION!=='undefined' ? VERSION : null),
        lang: (typeof lang!=='undefined' ? lang : null),
        platform: plat,
        screenW: (typeof innerWidth!=='undefined' ? innerWidth : 0),
        screenH: (typeof innerHeight!=='undefined' ? innerHeight : 0),
      };
    }
    function emit(evt){
      buffer.push(evt);
      if(buffer.length>BUF_MAX) buffer.splice(0, buffer.length-BUF_MAX);
      if(consent && !evt._sent){ try{ sink(evt); evt._sent=true; }catch(e){} }
      persistBuffer();
    }
    function touchSession(){
      const t=now();
      if(!sessionId || (t-lastEventAt)>SESSION_GAP){ if(sessionId) endSession(); startSession(); }
      lastEventAt=t;
    }
    function startSession(){
      sessionId=uuid(); sessionStartedAt=now(); lastEventAt=sessionStartedAt;
      emit(Object.assign(ctxBase(), {event:'session_start'}));
    }
    function endSession(){
      if(!sessionId) return;
      emit(Object.assign(ctxBase(), {event:'session_end', duration_ms: now()-sessionStartedAt}));
      sessionId=null;
    }
    // главная точка: зови track('level_start', {...}) из ЛЮБОГО места логики
    function track(event, props){
      if(!started) return;          // до init() нет userId/сессии — молчим
      touchSession();
      emit(Object.assign(ctxBase(), {event}, props||{}));
    }
    function init(){
      if(started) return;
      loadBuffer();
      userId = ls.get(UID_KEY); if(!userId){ userId=uuid(); ls.set(UID_KEY, userId); }
      const isFirst = !ls.get(FIRST_KEY);
      if(isFirst) ls.set(FIRST_KEY, String(now()));
      started=true;
      startSession();
      if(isFirst) emit(Object.assign(ctxBase(), {event:'first_open'}));
      // конец сессии при уходе со вкладки/закрытии; возврат позже gap → новая сессия
      try{
        document.addEventListener('visibilitychange', ()=>{
          if(document.visibilityState==='hidden') endSession(); else touchSession();
        });
        window.addEventListener('pagehide', endSession);
      }catch(e){}
      // краши: для soft launch критично понимать, на чём отваливаются
      try{
        window.addEventListener('error', e=>track('error', {
          message:String((e&&e.message)||(e&&e.type)||'error'),
          source:((e&&e.filename)||'')+':'+((e&&e.lineno)||0), kind:'error' }));
        window.addEventListener('unhandledrejection', e=>{
          const r=e&&e.reason; track('error', {message:String((r&&r.message)||r||'rejection'), kind:'unhandledrejection'}); });
      }catch(e){}
    }
    return {
      init, track,
      // consent-гейт под сторы: при отказе sink молчит; при согласии дольём накопленное
      setConsent(v){ consent=!!v; if(consent) buffer.forEach(e=>{ if(!e._sent){ try{ sink(e); e._sent=true; }catch(_){} } }); persistBuffer(); },
      get sink(){ return sink; }, set sink(fn){ if(typeof fn==='function') sink=fn; },
      dump(){ return buffer.slice(); }, clear(){ buffer=[]; persistBuffer(); },
      get userId(){ return userId; }, get sessionId(){ return sessionId; },
      // СПЯЩИЕ монетизационные хелперы: определены, но пока не вызываются (нет IAP/рекламы).
      // Когда появятся — зови Analytics.purchase({value,currency,sku}) / Analytics.adWatched({...}).
      purchase(o){ track('purchase', o||{}); track('revenue', {value:o&&o.value, currency:o&&o.currency, sku:o&&o.sku, kind:'iap'}); },
      adWatched(o){ track('ad_watched', o||{}); track('revenue', {value:o&&o.value, currency:o&&o.currency, kind:'ad'}); },
    };
  })();
  // дев-доступ из консоли (и точка подключения провайдера из обёртки): Analytics.dump()
  try{ window.PFAnalytics = Analytics; }catch(e){}

  // ---- Лидерборды: глобальный рейтинг игроков (all-time / month / week) ----
  // Каркас: счёт за заход (метрика survival —
  // число обслуженных бортов) уходит через СВОПАЕМЫЙ `Leaderboard.provider`. Сейчас
  // provider = локальный mock-стор в localStorage (+синтетические боты, чтобы таблица не
  // пустовала); реальный бэкенд (свой API / Firebase / Supabase) подключается ОДНОЙ
  // заменой Leaderboard.provider — ни submitRun(), ни top() при этом не меняются (тот же
  // приём, что Analytics.sink). Идентичность игрока — модуль Account со свопаемым
  // authProvider: сейчас mock «локальный аккаунт», реальный Google Play Games / OAuth
  // встаёт в ТОТ ЖЕ интерфейс. Периоды (неделя/месяц) — чистая детерминированная функция
  // periodBucket(ts) в UTC, одинаковая на клиенте и будущем сервере (ISO-8601 неделя).
  const PERIODS = ['alltime','month','week'];
  function lbNow(){ return Date.now(); }
  // ISO-8601: ключ недели 'YYYY-Www' (год определяется четвергом недели) + 'YYYY-MM' месяца.
  function periodBucket(ts){
    const d = new Date(ts);
    const month = d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (dt.getUTCDay()+6)%7;                 // Пн=0 … Вс=6
    dt.setUTCDate(dt.getUTCDate() - dayNum + 3);         // четверг текущей недели
    const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const week = dt.getUTCFullYear()+'-W'+String(
      1 + Math.round(((dt - firstThu)/86400000 - 3 + ((firstThu.getUTCDay()+6)%7))/7)
    ).padStart(2,'0');
    return { alltime:'all', month, week };
  }

  // Идентичность: реальные аккаунты (выбор продукт-овнера). Сейчас authProvider — mock
  // «локальный аккаунт» (id из устойчивого pf_uid, ник задаёт игрок). Реальный вход
  // (Google Play Games / OAuth) заменяет Account.authProvider, ничего вокруг не трогая.
  // Аккаунт живёт в своём ключе и ПЕРЕЖИВАЕТ «Сбросить прогресс» (как язык/медали).
  const Account = (() => {
    const ACC_KEY='pf_account_v1', UID_KEY='pf_uid';
    let acct=null;
    function mockAuth(){
      let uid=null; try{ uid=localStorage.getItem(UID_KEY); }catch(e){}
      if(!uid){ uid='local-'+Math.abs((lbNow()^(Math.floor(Math.random()*1e9)))>>>0).toString(36); try{ localStorage.setItem(UID_KEY, uid); }catch(e){} }
      return Promise.resolve({ id:uid, name:null, provider:'mock' });
    }
    let authProvider = mockAuth;
    function load(){ try{ const a=JSON.parse(localStorage.getItem(ACC_KEY)); if(a&&a.id){ acct=a; } }catch(e){} }
    function persist(){ try{ localStorage.setItem(ACC_KEY, JSON.stringify(acct)); }catch(e){} }
    return {
      init(){ load(); },
      current(){ return acct; },
      signedIn(){ return !!(acct&&acct.id); },
      signIn(){ return Promise.resolve(authProvider()).then(a=>{ acct=Object.assign({name:null}, a); persist(); return acct; }); },
      signOut(){ acct=null; try{ localStorage.removeItem(ACC_KEY); }catch(e){} },
      setName(n){ if(!acct) return null; acct.name=String(n||'').trim().slice(0,24)||null; persist(); return acct; },
      get authProvider(){ return authProvider; }, set authProvider(fn){ if(typeof fn==='function') authProvider=fn; },
    };
  })();

  const Leaderboard = (() => {
    const STORE_KEY='pf_lb_v1', TOP_N=100, RING=5000;
    const ls = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
                 set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
    function loadAll(){ try{ const a=JSON.parse(ls.get(STORE_KEY)); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
    function saveAll(a){ ls.set(STORE_KEY, JSON.stringify(a.slice(-RING))); }
    function defaultName(id){ return 'Player-'+String(id||'').slice(-4).toUpperCase(); }
    // mock «как бы глобальная» таблица: подсев несколько ботов, чтобы каркас и UI было
    // видно на пустом устройстве. На реальном бэкенде ботов нет — это деталь mock-провайдера.
    function seedBots(rows){
      if(rows.some(r=>r&&r._seed)) return rows;
      const bots=[['Skylark',38],['Maverick',31],['Tower-9',27],['Otto',22],['Foxtrot',18],['Breeze',14],['Cargo Joe',11],['Nimbus',8]];
      const base=lbNow();
      bots.forEach((b,i)=>rows.push({accountId:'bot-'+i, name:b[0], mode:'survival', score:b[1], ts:base-i*3600000, _seed:true}));
      return rows;
    }
    function rankRows(rows, period, mode){
      const curB = periodBucket(lbNow()), wantAll = (period==='alltime'), best={};
      rows.forEach(r=>{
        if(!r || (mode && r.mode!==mode)) return;
        if(!wantAll && periodBucket(r.ts)[period]!==curB[period]) return;
        const cur=best[r.accountId];
        if(!cur || r.score>cur.score || (r.score===cur.score && r.ts<cur.ts)) best[r.accountId]=r;
      });
      return Object.keys(best).map(k=>best[k]).sort((a,b)=> b.score-a.score || a.ts-b.ts)
        .map((r,i)=>({ rank:i+1, accountId:r.accountId, name:r.name||defaultName(r.accountId), score:r.score, ts:r.ts, seed:!!r._seed }));
    }
    // ПРОВАЙДЕР по умолчанию — локальный mock. Реальный бэкенд: тот же {submit, top}, но с сетью.
    const mockProvider = {
      submit(entry){ const rows=seedBots(loadAll()); rows.push(entry); saveAll(rows); return Promise.resolve(true); },
      top(period, mode){ return Promise.resolve(rankRows(seedBots(loadAll()), period, mode).slice(0,TOP_N)); },
    };
    let provider=mockProvider, started=false;
    return {
      init(){ if(started) return; started=true; Account.init(); },
      account: Account,
      periodBucket, PERIODS,
      get provider(){ return provider; }, set provider(p){ if(p&&typeof p.submit==='function'&&typeof p.top==='function') provider=p; },
      // отправить результат захода. score — число (survival: обслуженные борта). Возвращает
      // {score, ranks:{alltime,month,week}} — место игрока в каждом срезе (null, если вне TOP_N).
      submitRun(opts){
        opts=opts||{}; if(!started) this.init();
        return Promise.resolve(Account.signedIn()?Account.current():Account.signIn()).then(acct=>{
          const entry={ accountId:acct.id, name:acct.name||defaultName(acct.id), mode:opts.mode||'survival',
            score:Math.max(0, Math.round(+opts.score||0)), ts:lbNow(),
            v:(typeof VERSION!=='undefined'?VERSION:null) };
          return Promise.resolve(provider.submit(entry)).then(()=>{
            try{ Analytics.track('leaderboard_submit', {mode:entry.mode, score:entry.score}); }catch(e){}
            const tops=PERIODS.map(p=>Promise.resolve(provider.top(p, entry.mode)).then(list=>{
              const me=list.find(r=>r.accountId===acct.id); return [p, me?me.rank:null];
            }));
            return Promise.all(tops).then(pairs=>{ const ranks={}; pairs.forEach(x=>ranks[x[0]]=x[1]); return {score:entry.score, ranks}; });
          });
        });
      },
      top(period, mode){ if(!started) this.init(); return Promise.resolve(provider.top(period||'alltime', mode||'survival')); },
      me(period, mode){ const acct=Account.current(); if(!acct) return Promise.resolve(null);
        return Promise.resolve(provider.top(period||'alltime', mode||'survival')).then(list=>list.find(r=>r.accountId===acct.id)||null); },
      // личный рекорд (локальный кэш всех отправленных заходов этого аккаунта)
      bestScore(mode){ const acct=Account.current(); if(!acct) return 0;
        return loadAll().filter(r=>r&&r.accountId===acct.id&&(!mode||r.mode===mode)).reduce((m,r)=>Math.max(m,r.score),0); },
    };
  })();
  try{ window.PFLeaderboard = Leaderboard; }catch(e){}

  // конфиг-чек каркаса рейтингов (в духе validateLevels) — зовётся из validateGame()
  function validateLeaderboard(){
    const p=[];
    if(!Array.isArray(PERIODS)||!PERIODS.length){ p.push('PERIODS пуст'); return p; }
    let b; try{ b=periodBucket(lbNow()); }catch(e){ p.push('periodBucket() кинул исключение'); return p; }
    PERIODS.forEach(per=>{ if(b[per]==null) p.push('periodBucket() не даёт ключ для периода "'+per+'"'); });
    ['rank_top100','rank_top10','rank_1'].forEach(id=>{
      if(!ACH.defs.some(d=>d.id===id)) p.push('ранг-медаль "'+id+'" отсутствует в ACH.defs');
      Object.keys(I18N).forEach(c=>{ if(I18N[c]['ach.'+id+'.t']==null) p.push('нет перевода ach.'+id+'.t в языке "'+c+'"'); });
    });
    return p;
  }

  // Звук тапа по любым кнопкам в оверлеях меню (старт / пауза / уровни / настройки и т.д.).
  // Делегирование на document — ловит и динамически созданные кнопки (язык, скин, список уровней).
  document.addEventListener('pointerdown', e=>{
    const b = e.target.closest && e.target.closest('.overlay button');
    if(b && !b.disabled) SND.btn();
  });


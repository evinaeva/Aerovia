// ===== 07-audio-services — sound synthesis + side services (haptics, analytics, leaderboard) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: SND, HAP, Analytics, Leaderboard, periodBucket, validateLeaderboard,
//   seasonKey, seasonNumber, seasonDaysLeft, SEASON_DIVISIONS, seasonDivisionIndex,
//   seasonPercentile, seasonPromote, seasonIdxOf, resolveSeasonDivision.
// Reads: 03 (t, I18N, lang); 06 (VERSION, served, debug); 12 (ACH).

  const SND = (() => {
    const SCALE=[220,261.63,293.66,329.63,392,440,523.25,587.33,659.25]; // A3..E5
    let ac: any = null, master: any = null, enabled=true;
    function ensure(){
      if(!enabled) return null;
      const AC=window.AudioContext||(window as any).webkitAudioContext;
      if(!AC) return null;
      if(!ac){ ac=new AC(); master=ac.createGain(); master.gain.value=0.5; master.connect(ac.destination); }
      if(ac.state==='suspended') ac.resume();
      return ac;
    }
    function tone(freq: number, dur?: number, type?: string, vol?: number, delay?: number){
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
    const ri=(a: number, b: number)=>a+Math.floor(Math.random()*(b-a+1)); // случайный индекс ноты гаммы
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
    function play(name: string){
      const fn = (RECIPES as Record<string, () => void>)[name];
      if(fn) fn();
    }
    return {
      setEnabled(v: boolean){ enabled=v; },
      btn(){ play('btn'); }, lock(){ play('lock'); }, screech(){ play('screech'); },
      pick(){}, land(){}, dock(){}, served(){}, depart(_e?: any){}, build(){},
      penalty(){}, crash(){}, medal(){}, alarm(){}, nearmiss(){},
    };
  })();
  const HAP = { // вибрация: Android — да, iOS веб — молча игнорирует (в обёртке будет плагин)
    on:true,
    v(p: number | number[]){ if(this.on && (navigator as any).vibrate){ try{ (navigator as any).vibrate(p); }catch(e){} } },
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
    let userId: string|null=null, sessionId: string|null=null, seq=0, sessionStartedAt=0, lastEventAt=0;
    let consent=false;              // false до явного согласия (GDPR/ATT); ConsentBanner.init() в 12d выставляет true
    let buffer: any[]=[], started=false, sink=defaultSink;

    const ls = {
      get(k: string){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
      set(k: string, v: string){ try{ localStorage.setItem(k,v); }catch(e){} },
    };
    function now(){ return Date.now(); }
    function uuid(){
      try{ if(self.crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
      });
    }
    // дефолтный sink: тихий console.debug. Подмени Analytics.sink, чтобы лить провайдеру.
    function defaultSink(evt: any){ try{ if(console&&console.debug) console.debug('[evt]', evt.event, evt); }catch(e){} }

    function loadBuffer(){ try{ const a=JSON.parse(ls.get(BUF_KEY) || 'null'); if(Array.isArray(a)) buffer=a; }catch(e){} }
    function persistBuffer(){ ls.set(BUF_KEY, JSON.stringify(buffer.slice(-BUF_MAX))); }

    // базовый контекст, который прикладывается к КАЖДОМУ событию
    function ctxBase(){
      let plat='web';
      try{ if((window as any).matchMedia && matchMedia('(display-mode: standalone)').matches) plat='pwa'; }catch(e){}
      return {
        userId, sessionId, seq:++seq, ts:now(),
        appVersion: (typeof VERSION!=='undefined' ? VERSION : null),
        lang: (typeof lang!=='undefined' ? lang : null),
        platform: plat,
        screenW: (typeof innerWidth!=='undefined' ? innerWidth : 0),
        screenH: (typeof innerHeight!=='undefined' ? innerHeight : 0),
      };
    }
    function emit(evt: any){
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
    function track(event: string, props?: any){
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
      setConsent(v: boolean){ consent=!!v; if(consent) buffer.forEach(e=>{ if(!e._sent){ try{ sink(e); e._sent=true; }catch(_){} } }); persistBuffer(); },
      get sink(){ return sink; }, set sink(fn){ if(typeof fn==='function') sink=fn; },
      dump(){ return buffer.slice(); }, clear(){ buffer=[]; persistBuffer(); },
      get userId(){ return userId; }, get sessionId(){ return sessionId; },
      // СПЯЩИЕ монетизационные хелперы: определены, но пока не вызываются (нет IAP/рекламы).
      // Когда появятся — зови Analytics.purchase({value,currency,sku}) / Analytics.adWatched({...}).
      purchase(o?: any){ track('purchase', o||{}); track('revenue', {value:o&&o.value, currency:o&&o.currency, sku:o&&o.sku, kind:'iap'}); },
      adWatched(o?: any){ track('ad_watched', o||{}); track('revenue', {value:o&&o.value, currency:o&&o.currency, kind:'ad'}); },
    };
  })();
  // дев-доступ из консоли (и точка подключения провайдера из обёртки): Analytics.dump()
  try{ (window as any).PFAnalytics = Analytics; }catch(e){}

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
  function periodBucket(ts: number){
    const d = new Date(ts);
    const month = d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (dt.getUTCDay()+6)%7;                 // Пн=0 … Вс=6
    dt.setUTCDate(dt.getUTCDate() - dayNum + 3);         // четверг текущей недели
    const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const week = dt.getUTCFullYear()+'-W'+String(
      1 + Math.round(((dt.getTime() - firstThu.getTime())/86400000 - 3 + ((firstThu.getUTCDay()+6)%7))/7)
    ).padStart(2,'0');
    return { alltime:'all', month, week, season: seasonKey(ts) };
  }

  // Лига сезона (MVP Фаза 1 — план: docs/design/game-design/season-leagues.md). Как и
  // week/month выше — чистая детерминированная функция, UTC, одинаковая на клиенте и
  // будущем сервере: срез = фильтр того же журнала по текущему сезон-бакету, без
  // разрушающего сброса. Окно фиксированное: 2 недели от якоря SEASON_EPOCH (понедельник
  // 00:00 UTC). Овнер подтвердил старт Фазы 1 на mock 2026-07-01.
  const SEASON_EPOCH = Date.UTC(2026, 0, 5), SEASON_LEN = 14*24*3600*1000;
  function seasonIndex(ts: number){ return Math.floor((ts - SEASON_EPOCH) / SEASON_LEN); }
  function seasonKey(ts: number){ return 'S' + seasonIndex(ts); }            // бакет журнала, напр. 'S37'
  function seasonNumber(ts: number){ return seasonIndex(ts) + 1; }          // для показа: «Сезон 38»
  function seasonEndsAt(ts: number){ return SEASON_EPOCH + (seasonIndex(ts) + 1) * SEASON_LEN; }
  function seasonDaysLeft(ts: number){ return Math.max(0, Math.ceil((seasonEndsAt(ts) - ts) / 86400000)); }
  // 5 дивизионов Bronze→Diamond (по кейсу Google Play «Leagues»). На mock-провайдере это
  // честная демонстрация против сид-ботов (seedBots), не боевой матчмейкинг — см. план.
  // idx: 0=Bronze … 4=Diamond. Пороги — квинтили по позиции в сезонном топе (0=лучший).
  const SEASON_DIVISIONS = [
    { id:'bronze',   ic:'🥉' },
    { id:'silver',   ic:'🥈' },
    { id:'gold',     ic:'🥇' },
    { id:'platinum', ic:'💠' },
    { id:'diamond',  ic:'💎' },
  ];
  // rank — 1-based место в сезонном топе (как из Leaderboard.top('season',…)); total — размер
  // этого топа. Без ранга (только личный bestScore, вне топ-N) — худший перцентиль (база).
  function seasonPercentile(rank: number|null, total: number){
    if(!rank || !total || total<=1) return 1;           // без ранга / вырожденный случай — худший конец
    return (rank - 1) / total;                          // 0 = лучший, ~1 = худший
  }
  function seasonDivisionIndex(rank: number|null, total: number){
    const pct = seasonPercentile(rank, total);
    return pct<0.2 ? 4 : pct<0.4 ? 3 : pct<0.6 ? 2 : pct<0.8 ? 1 : 0;
  }
  // Promotion/relegation (план, раздел «Дивизионы»): топ ~20% дивизиона за сезон повышается,
  // низ ~20% понижается, середина остаётся. pct — перцентиль ИГРОКА в его сезонном топе на
  // момент подведения итога (тот же расчёт, что seasonDivisionIndex — на mock-провайдере это
  // общий список, не бракет по дивизиону, см. season-leagues.md).
  function seasonPromote(prevDivisionIdx: number, pct: number){
    if(pct<0.2) return Math.min(4, prevDivisionIdx+1);
    if(pct>=0.8) return Math.max(0, prevDivisionIdx-1);
    return prevDivisionIdx;
  }
  function seasonIdxOf(key: string){ return parseInt(String(key).slice(1), 10); }
  // Назначение дивизиона на сезон — чистая функция от (сохранённая запись прошлого раунда,
  // индекс ТЕКУЩЕГО сезона, место/размер топа): если рекорд уже за этот сезон — не пересчитываем
  // (дивизион фиксирован на весь сезон); если рекорд за ПРЕДЫДУЩИЙ сезон — промо/релегейт; иначе
  // (первый сезон игрока или пропущенные сезоны) — свежее назначение по перцентилю.
  function resolveSeasonDivision(rec: any, curSeasonIdx: number, rank: number|null, total: number){
    const pct = seasonPercentile(rank, total);
    if(rec && seasonIdxOf(rec.seasonKey)===curSeasonIdx) return rec.divisionIdx;
    if(rec && seasonIdxOf(rec.seasonKey)===curSeasonIdx-1) return seasonPromote(rec.divisionIdx, pct);
    return seasonDivisionIndex(rank, total);
  }

  // Идентичность: реальные аккаунты (выбор продукт-овнера). Сейчас authProvider — mock
  // «локальный аккаунт» (id из устойчивого pf_uid, ник задаёт игрок). Реальный вход
  // (Google Play Games / OAuth) заменяет Account.authProvider, ничего вокруг не трогая.
  // Аккаунт живёт в своём ключе и ПЕРЕЖИВАЕТ «Сбросить прогресс» (как язык/медали).
  const Account = (() => {
    const ACC_KEY='pf_account_v1', UID_KEY='pf_uid';
    let acct: any = null;
    function mockAuth(){
      let uid=null; try{ uid=localStorage.getItem(UID_KEY); }catch(e){}
      if(!uid){ uid='local-'+Math.abs((lbNow()^(Math.floor(Math.random()*1e9)))>>>0).toString(36); try{ localStorage.setItem(UID_KEY, uid); }catch(e){} }
      return Promise.resolve({ id:uid, name:null, provider:'mock' });
    }
    let authProvider = mockAuth;
    function load(){ try{ const a=JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); if(a&&a.id){ acct=a; } }catch(e){} }
    function persist(){ try{ localStorage.setItem(ACC_KEY, JSON.stringify(acct)); }catch(e){} }
    return {
      init(){ load(); },
      current(){ return acct; },
      signedIn(){ return !!(acct&&acct.id); },
      signIn(){ return Promise.resolve(authProvider()).then(a=>{ acct=Object.assign({name:null}, a); persist(); return acct; }); },
      signOut(){ acct=null; try{ localStorage.removeItem(ACC_KEY); }catch(e){} },
      setName(n: string){ if(!acct) return null; acct.name=String(n||'').trim().slice(0,24)||null; persist(); return acct; },
      get authProvider(){ return authProvider; }, set authProvider(fn){ if(typeof fn==='function') authProvider=fn; },
    };
  })();

  const Leaderboard = (() => {
    const STORE_KEY='pf_lb_v1', TOP_N=100, RING=5000;
    const ls = { get(k: string){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
                 set(k: string, v: string){ try{ localStorage.setItem(k,v); }catch(e){} } };
    function loadAll(){ try{ const a=JSON.parse(ls.get(STORE_KEY) || 'null'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
    function saveAll(a: any[]){ ls.set(STORE_KEY, JSON.stringify(a.slice(-RING))); }
    function defaultName(id?: any){ return 'Player-'+String(id||'').slice(-4).toUpperCase(); }
    // личный рекорд аккаунта в срезе (локальный кэш всех отправленных заходов)
    function accountBest(mode?: string){ const acct=Account.current(); if(!acct) return 0;
      return loadAll().filter(r=>r&&!r._seed&&r.accountId===acct.id&&(!mode||r.mode===mode)).reduce((m,r)=>Math.max(m,r.score),0); }
    // mock «как бы глобальная» таблица: боты, чтобы каркас и UI было видно на пустом устройстве.
    // На реальном бэкенде ботов нет — это деталь mock-провайдера, поэтому боты НЕ персистятся, а
    // вычисляются на чтении и ПОДБИРАЮТСЯ ПОД УРОВЕНЬ ИГРОКА (season-leagues.md → «подбор ботов
    // под уровень игрока»): при референсном уровне (~BOT_ANCHOR) раскладка совпадает с прежними
    // фикс-скорами, выше/ниже — линейно масштабируется, чтобы игрок попадал в осмысленный бракет
    // (не всегда последний и не всегда первый). BOT_BASE — относительные тиры силы.
    const BOT_BASE: Array<[string, number]> = [['Skylark',38],['Maverick',31],['Tower-9',27],['Otto',22],['Foxtrot',18],['Breeze',14],['Cargo Joe',11],['Nimbus',8]];
    const BOT_ANCHOR = 24;
    // «уровень игрока» для подбора ботов = лучший survival-счёт из ПРОШЛЫХ сезонов (текущий сезон
    // исключаем: иначе боты гнались бы за только что поставленным рекордом и игрок навсегда застрял
    // бы в середине — прогресс внутри сезона был бы невозможен; так же сохраняются тесты «высокий
    // счёт → 1-е место»: свежий аккаунт без прошлых сезонов → anchor 0 → референсная раскладка).
    // Раз в сезон бракет пере-анкорится на новый уровень — как промо/релегейт в настоящих лигах.
    function seasonBotAnchor(mode?: string){
      const acct=Account.current(); if(!acct) return 0;
      const cur=seasonKey(lbNow());
      return loadAll().filter(r=>r&&!r._seed&&r.accountId===acct.id&&(!mode||r.mode===mode)&&seasonKey(r.ts)!==cur)
        .reduce((m,r)=>Math.max(m,r.score),0);
    }
    function seedBots(rows: any[]){
      const real=rows.filter(r=>!(r&&r._seed));            // прежних персистнутых ботов отбрасываем (миграция) — боты теперь вычисляются на чтении
      const lvl=seasonBotAnchor('survival'), anchor=lvl>0?lvl:BOT_ANCHOR;
      const base=lbNow();
      BOT_BASE.forEach((b,i)=>real.push({accountId:'bot-'+i, name:b[0], mode:'survival',
        score:Math.max(1, Math.round(b[1]*anchor/BOT_ANCHOR)), ts:base-i*3600000, _seed:true}));
      return real;
    }
    function rankRows(rows: any[], period: string, mode?: string){
      const curB = periodBucket(lbNow()), wantAll = (period==='alltime'), best: Record<string, any>={};
      rows.forEach(r=>{
        if(!r || (mode && r.mode!==mode)) return;
        if(!wantAll && (periodBucket(r.ts) as Record<string,string>)[period]!==(curB as Record<string,string>)[period]) return;
        const cur=best[r.accountId];
        if(!cur || r.score>cur.score || (r.score===cur.score && r.ts<cur.ts)) best[r.accountId]=r;
      });
      return Object.keys(best).map(k=>best[k]).sort((a,b)=> b.score-a.score || a.ts-b.ts)
        .map((r,i)=>({ rank:i+1, accountId:r.accountId, name:r.name||defaultName(r.accountId), score:r.score, ts:r.ts, seed:!!r._seed }));
    }
    // ПРОВАЙДЕР по умолчанию — локальный mock. Реальный бэкенд: тот же {submit, top}, но с сетью.
    const mockProvider = {
      // боты не персистятся (вычисляются на чтении) — при сохранении отбрасываем и любых прежних
      submit(entry: any){ const rows=loadAll().filter(r=>!(r&&r._seed)); rows.push(entry); saveAll(rows); return Promise.resolve(true); },
      top(period: string, mode?: string){ return Promise.resolve(rankRows(seedBots(loadAll()), period, mode).slice(0,TOP_N)); },
    };
    let provider=mockProvider, started=false;
    // Лига сезона (MVP Фаза 1) — косметика сезона в СВОЁМ сторе, не в ACH.unlocked: ротирует
    // с сезоном, поэтому не может жить там же, где «медаль=навсегда» (см. season-leagues.md).
    const SEASON_REWARDS_KEY='pf_season_rewards_v1', SEASON_DIVISION_KEY='pf_season_division_v1', SEASON_INVITE_KEY='pf_season_invite_v1';
    const SEASON_ACCENTS=['#c98a4b','#c7d0da','#ffd45e','#7fe0e8','#a9c8ff'];   // Bronze…Diamond
    function loadSeasonRewards(){ try{ const a=JSON.parse(ls.get(SEASON_REWARDS_KEY) || 'null'); return (a&&typeof a==='object')?a:{}; }catch(e){ return {}; } }
    function saveSeasonRewards(o: any){ ls.set(SEASON_REWARDS_KEY, JSON.stringify(o)); }
    // последний известный дивизион игрока (для promotion/relegation в следующем сезоне) —
    // {seasonKey, divisionIdx, rank, total, ts}, один рекорд, не журнал.
    function loadSeasonDivisionRec(){ try{ return JSON.parse(ls.get(SEASON_DIVISION_KEY) || 'null'); }catch(e){ return null; } }
    function saveSeasonDivisionRec(o: any){ ls.set(SEASON_DIVISION_KEY, JSON.stringify(o)); }
    const season = {
      DIVISIONS: SEASON_DIVISIONS,
      number(ts?: number){ return seasonNumber(ts==null?lbNow():ts); },
      daysLeft(ts?: number){ return seasonDaysLeft(ts==null?lbNow():ts); },
      // сезонный топ (тот же приём, что top()) + место игрока + дивизион. Дивизион фиксируется
      // на весь сезон при первом вызове в этом сезоне; на границе сезонов — promotion/relegation
      // от дивизиона прошлого сезона (см. resolveSeasonDivision); pf_season_division_v1 хранит
      // последний рекорд для этого перехода.
      standing(mode?: string){
        if(!started) Leaderboard.init();
        const acct=Account.current();
        return Promise.resolve(provider.top('season', mode||'survival')).then(list=>{
          const total=list.length, me=acct?list.find((r: any)=>r.accountId===acct.id):null;
          const rank=me?me.rank:null, curIdx=seasonIndex(lbNow()), rec=loadSeasonDivisionRec();
          const divisionIdx=resolveSeasonDivision(rec, curIdx, rank, total);
          const fromPrevSeason = !!(rec && seasonIdxOf(rec.seasonKey)===curIdx-1);
          const promoted = fromPrevSeason && divisionIdx>rec.divisionIdx;
          const relegated = fromPrevSeason && divisionIdx<rec.divisionIdx;
          saveSeasonDivisionRec({ seasonKey:seasonKey(lbNow()), divisionIdx, rank, total, ts:lbNow() });
          return { number:seasonNumber(lbNow()), daysLeft:seasonDaysLeft(lbNow()),
            rank, total, divisionIdx, division:SEASON_DIVISIONS[divisionIdx].id, list, promoted, relegated };
        });
      },
      // один косметический приз на сезон — выдаётся раз, при первом достижении дивизиона
      // в ЭТОМ сезоне (ключ = текущий seasonKey). Ротирует, «навсегда»-медали не трогает.
      claimReward(divisionIdx: number){
        const k=seasonKey(lbNow()), store=loadSeasonRewards();
        if(store[k]) return store[k];
        const idx=Math.max(0, Math.min(divisionIdx||0, SEASON_ACCENTS.length-1));
        store[k]={divisionIdx:idx, accent:SEASON_ACCENTS[idx], ts:lbNow()};
        saveSeasonRewards(store);
        return store[k];
      },
      reward(){ return loadSeasonRewards()[seasonKey(lbNow())] || null; },
      // Приглашение в лигу — «сначала активным игрокам» (кейс SYBO: 75% записавшихся уже играли).
      // Активный = есть личный рекорд (bestScore ≥ minBest, т.е. закончил хотя бы один заход).
      // show — раз за сезон (до ackInvite). Чистая синхронная функция над локальным стором;
      // при свопе на реальный бэкенд таргетинг/пуш делает сервер, эта же форма остаётся хуком UI.
      invite(opts?: any){
        opts=opts||{}; const minBest=opts.minBest==null?1:opts.minBest;
        const active=accountBest(opts.mode||'survival')>=minBest;
        const k=seasonKey(lbNow()), seen=(ls.get(SEASON_INVITE_KEY)===k);
        return { number:seasonNumber(lbNow()), season:k, active, seen, show:active&&!seen };
      },
      ackInvite(){ const k=seasonKey(lbNow()); ls.set(SEASON_INVITE_KEY, k); return k; },
    };
    return {
      init(){ if(started) return; started=true; Account.init(); },
      account: Account,
      periodBucket, PERIODS, season,
      get provider(){ return provider; }, set provider(p){ if(p&&typeof p.submit==='function'&&typeof p.top==='function') provider=p; },
      // отправить результат захода. score — число (survival: обслуженные борта). Возвращает
      // {score, ranks:{alltime,month,week}} — место игрока в каждом срезе (null, если вне TOP_N).
      submitRun(opts?: any){
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
            return Promise.all(tops).then(pairs=>{ const ranks: Record<string, any>={}; pairs.forEach((x: any)=>ranks[x[0]]=x[1]); return {score:entry.score, ranks}; });
          });
        });
      },
      top(period?: string, mode?: string){ if(!started) this.init(); return Promise.resolve(provider.top(period||'alltime', mode||'survival')); },
      me(period?: string, mode?: string){ const acct=Account.current(); if(!acct) return Promise.resolve(null);
        return Promise.resolve(provider.top(period||'alltime', mode||'survival')).then(list=>list.find(r=>r.accountId===acct.id)||null); },
      // личный рекорд (локальный кэш всех отправленных заходов этого аккаунта)
      bestScore(mode?: string){ return accountBest(mode); },
    };
  })();
  try{ (window as any).PFLeaderboard = Leaderboard; }catch(e){}

  // конфиг-чек каркаса рейтингов (в духе validateLevels) — зовётся из validateGame()
  function validateLeaderboard(){
    const p: string[]=[];
    if(!Array.isArray(PERIODS)||!PERIODS.length){ p.push('PERIODS пуст'); return p; }
    let b; try{ b=periodBucket(lbNow()); }catch(e){ p.push('periodBucket() кинул исключение'); return p; }
    PERIODS.forEach(per=>{ if((b as Record<string, string>)[per]==null) p.push('periodBucket() не даёт ключ для периода "'+per+'"'); });
    ['rank_top100','rank_top10','rank_1'].forEach(id=>{
      if(!ACH.defs.some(d=>d.id===id)) p.push('ранг-медаль "'+id+'" отсутствует в ACH.defs');
      Object.keys(I18N).forEach(c=>{ if(I18N[c as LangCode]['ach.'+id+'.t']==null) p.push('нет перевода ach.'+id+'.t в языке "'+c+'"'); });
    });
    // Лига сезона (MVP Фаза 1): season-бакет + дивизион-бейджи + их переводы.
    if((b as Record<string,string>).season==null) p.push('periodBucket() не даёт ключ "season"');
    if(!Array.isArray(SEASON_DIVISIONS) || SEASON_DIVISIONS.length!==5) p.push('SEASON_DIVISIONS должен содержать 5 дивизионов');
    SEASON_DIVISIONS.forEach(d=>{
      const id='season_'+d.id;
      if(!ACH.defs.some(x=>x.id===id)) p.push('бейдж дивизиона "'+id+'" отсутствует в ACH.defs');
      Object.keys(I18N).forEach(c=>{ if(I18N[c as LangCode]['ach.'+id+'.t']==null) p.push('нет перевода ach.'+id+'.t в языке "'+c+'"'); });
    });
    return p;
  }

  // Звук тапа по любым кнопкам в оверлеях меню (старт / пауза / уровни / настройки и т.д.).
  // Делегирование на document — ловит и динамически созданные кнопки (язык, скин, список уровней).
  document.addEventListener('pointerdown', e=>{
    const tgt = e.target as Element | null;
    const b = (tgt && tgt.closest) ? tgt.closest('.overlay button') as HTMLButtonElement | null : null;
    if(b && !b.disabled) SND.btn();
  });


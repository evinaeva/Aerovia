// ===== 05-validate — runtime config self-checks (fail-fast on broken levels/medals/i18n/economy) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: validateGame, validateLevels, validateBonus, validateI18n, validateConfig, validateAch.
// Reads: 04 (K, LEVELS, BONUS, Level, levelEconomy, EVENT_KEYS, SVC_TYPES, CALM_LEVELS…); 03 (I18N); 12 (ACH); 07 (validateLeaderboard); 06 (runways, weather).

  function validateLevels(){
    const p: string[] = [];
    if(!Array.isArray(LEVELS) || !LEVELS.length){ p.push('LEVELS пуст'); return p; }
    const firstSeen: Record<string, number> = {};   // тип события -> индекс уровня, где впервые включён
    LEVELS.forEach((lv,i)=>{
      const L = 'L'+(i+1)+': ';
      const o = lv.objective;
      if(!o){ p.push(L+'нет objective'); }
      else {
        if(!['served','upgrades'].includes(o.metric)) p.push(L+'неизвестная метрика "'+o.metric+'"');
        const th = o.stars;
        if(!Array.isArray(th) || th.length!==3) p.push(L+'objective.stars должен быть массивом из 3 порогов [1★,2★,3★]');
        else {
          if(!(th[0]>0)) p.push(L+'objective.stars[0] (порог 1★) должен быть > 0');
          if(!(th[0]<=th[1] && th[1]<=th[2])) p.push(L+'objective.stars должны идти по возрастанию (1★ ≤ 2★ ≤ 3★)');
          if(o.target!=null && o.target!==th[2]) p.push(L+'objective.target должен равняться stars[2] (потолок уровня)');
        }
        if(o.time!=null && !(o.time>0)) p.push(L+'objective.time должен быть > 0');
        if(o.race!=null && o.race!==true) p.push(L+'objective.race должен быть true (или отсутствовать)');
        if(o.race && !((o.time||0)>0)) p.push(L+'race-уровень требует objective.time');
        if(o.upg!=null){
          if(o.metric!=='served') p.push(L+'objective.upg допустим только при metric "served"');
          if(!Array.isArray(o.upg) || o.upg.length!==3) p.push(L+'objective.upg должен быть массивом из 3 порогов');
          else if(!(o.upg[0]<=o.upg[1] && o.upg[1]<=o.upg[2])) p.push(L+'objective.upg должны идти по возрастанию');
        }
      }
      // ГЕОМЕТРИЯ: либо явный layout (конструктор), либо старые sides+runways.
      if(lv.layout){
        const hs = lv.layout.hangars, rws = lv.layout.runways;
        if(!Array.isArray(hs) || !hs.length) p.push(L+'layout.hangars должен быть непустым массивом');
        else hs.forEach((h,hi)=>{
          const HL = L+'hangars['+hi+']: ';
          if(!SVC_TYPES.includes(h.type)) p.push(HL+'неизвестный тип ангара "'+h.type+'"');
          if(!(h.x>=0 && h.x<=1) || !(h.y>=0 && h.y<=1)) p.push(HL+'x/y должны быть в [0,1] (доля апрона)');
          if(h.open!=null && typeof h.open!=='boolean') p.push(HL+'open должен быть boolean');
          if(h.up!=null && typeof h.up!=='boolean') p.push(HL+'up должен быть boolean');
          if(h.gate!=null && !['up','down','left','right'].includes(h.gate)) p.push(HL+'gate должен быть up|down|left|right');
          if(h.openCost!=null && !(h.openCost>=0)) p.push(HL+'openCost должен быть >= 0');
          if(h.upgCost!=null && !(h.upgCost>0)) p.push(HL+'upgCost должен быть > 0');
        });
        if(!Array.isArray(rws) || rws.length<1) p.push(L+'layout.runways должен содержать хотя бы одну ВПП');
        else {
          if(rws.length>K.RUNWAY_MAX) p.push(L+'layout.runways больше потолка '+K.RUNWAY_MAX);
          rws.forEach((r,ri)=>{
            const RL = L+'runways['+ri+']: ';
            if(!(r.y>=0 && r.y<=1)) p.push(RL+'y должен быть в [0,1]');
            if(r.landingOpen!=null && typeof r.landingOpen!=='boolean') p.push(RL+'landingOpen должен быть boolean');
            if(r.takeoffOpen!=null && typeof r.takeoffOpen!=='boolean') p.push(RL+'takeoffOpen должен быть boolean');
            if(r.landingCost!=null && !(r.landingCost>=0)) p.push(RL+'landingCost должен быть >= 0');
            if(r.takeoffCost!=null && !(r.takeoffCost>=0)) p.push(RL+'takeoffCost должен быть >= 0');
          });
          // минимум одна открытая посадка и один открытый взлёт на старте
          if(rws.filter(r=>r.landingOpen!==false).length < 1) p.push(L+'нет ни одной открытой посадочной ВПП (нужен landingOpen:true хотя бы на одной)');
          if(rws.filter(r=>r.takeoffOpen!==false).length < 1) p.push(L+'нет ни одной открытой взлётной ВПП (нужен takeoffOpen:true хотя бы на одной)');
        }
        // каждая услуга, которую может запросить борт, должна иметь ангар такого типа
        if(Array.isArray(hs)){
          const have = new Set(hs.map(h=>h.type));
          for(const sv of levelServices(lv)) if(!have.has(sv)) p.push(L+'услуга "'+sv+'" объявлена, но нет ни одного ангара этого типа');
        }
      } else {
        const sides = (lv.sides || {}) as Record<string, SideCfg | undefined>;
        ['top','left','bottom'].forEach(side=>{
          const c = sides[side];
          if(!c){ p.push(L+'нет стороны "'+side+'"'); return; }
          if(!SVC_TYPES.includes(c.type)) p.push(L+side+': неизвестный тип бокса "'+c.type+'"');
          if(!(c.slots>=1)) p.push(L+side+': slots должен быть >= 1');
          if(!(c.open>=0 && c.open<=c.slots)) p.push(L+side+': open вне диапазона [0, slots]');
        });
        if(!(lv.runways!=null && lv.runways>=1)) p.push(L+'runways должен быть >= 1');
      }
      // services / maxUp — общие для обеих геометрий
      if(lv.services!=null){
        if(!Array.isArray(lv.services) || !lv.services.length) p.push(L+'services должен быть непустым массивом');
        else lv.services.forEach(sv=>{ if(!SVC_TYPES.includes(sv)) p.push(L+'неизвестная услуга "'+sv+'" в services'); });
      }
      if(lv.maxUp!=null && !(Number.isInteger(lv.maxUp) && lv.maxUp>=0 && lv.maxUp<=K.BAY_MAX_LVL)) p.push(L+'maxUp должен быть целым в [0, '+K.BAY_MAX_LVL+']');
      // медицинский борт высаживает пациента в пассажирском боксе — нужен board в услугах
      if(lv.events && lv.events.medical && !levelServices(lv).includes('board')) p.push(L+'событие medical требует услугу "board" в services');
      if(lv.startMoney!=null && !(lv.startMoney>0)) p.push(L+'startMoney должен быть > 0');
      if(lv.weather!=null && lv.weather!==true) p.push(L+'weather должен быть true (или отсутствовать)');
      if(lv.deice!=null && lv.deice!==true) p.push(L+'deice должен быть true (или отсутствовать)');
      // экономика уровня (levelEconomy): оплата в границах, голая смена окупает хотя бы
      // ОДИН новый бокс, и с включёнными эффектами весь ожидаемый набор ДОСТИЖИМ —
      // прямая страховка от «не накопить на бокс» и от того, что деньги блокируют 3★
      if(o){
        const ec = levelEconomy(lv);
        if(!(ec.svcReward>=K.SVC_MIN && ec.svcReward<=K.SVC_MAX)) p.push(L+'svcReward вне [SVC_MIN, SVC_MAX]');
        const avg = 1 + K.TWO_SVC_CHANCE;
        const baseEarn = ec.svcReward * avg * ec.flow;
        if(!(baseEarn >= K.BAY_OPEN_COST)) p.push(L+'базового дохода смены не хватит даже на открытие одного бокса (экономика)');
        const realized = ec.startMoney + ec.svcReward * avg * ec.flow * ec.skillMult;
        if(!(realized >= ec.kitCost * K.ECON_KIT_FLOOR)) p.push(L+'даже с включёнными эффектами competent-игрок не наберёт и '+Math.round(K.ECON_KIT_FLOOR*100)+'% набора (экономика зажата)');
      }
      const ev: Events = lv.events || {};
      Object.keys(ev).forEach(k=>{
        if(!EVENT_KEYS.includes(k)) p.push(L+'неизвестное событие "'+k+'"');
        else if(typeof ev[k]!=='boolean') p.push(L+'событие "'+k+'" должно быть boolean');
      });
      EVENT_KEYS.forEach(k=>{ if(ev[k] && firstSeen[k]==null) firstSeen[k]=i; });
      // спокойный блок L1–L4 — без единого спецсобытия
      if(i < CALM_LEVELS && EVENT_KEYS.some(k=>ev[k])) p.push(L+'спокойный блок L1–L'+CALM_LEVELS+' — без спецсобытий');
      // ТЕМП (pace) — главная ось сложности: обязателен, в [0,1], и НЕ убывает по кампании
      if(!(typeof lv.pace==='number' && lv.pace>=0 && lv.pace<=1)) p.push(L+'pace должен быть числом в [0,1] (темп/интенсивность уровня)');
      else if(i>0 && typeof LEVELS[i-1].pace==='number' && (lv.pace ?? 0) < ((LEVELS[i-1] && LEVELS[i-1].pace) ?? 0)) p.push(L+'pace должен не убывать по кампании (интенсивность только растёт)');
    });
    // прогрессия: спецсобытия вводятся только после спокойного блока (с L5)
    Object.keys(firstSeen).forEach(k=>{
      const i = firstSeen[k];
      if(i < CALM_LEVELS) p.push('Событие "'+k+'" введено на L'+(i+1)+' — спецсобытия только с L'+(CALM_LEVELS+1)+' (L1–L'+CALM_LEVELS+' — спокойный блок)');
    });
    return p;
  }
  function validateI18n(){
    const p: string[] = [], langs = Object.keys(I18N), all = new Set<string>();
    langs.forEach(c=>Object.keys(I18N[c as LangCode]).forEach(k=>{ if(k[0]!=='_') all.add(k); }));
    langs.forEach(c=>{ all.forEach(k=>{ if(I18N[c as LangCode][k]==null) p.push('i18n: в языке "'+c+'" нет ключа "'+k+'"'); }); });
    return p;
  }
  // проверка констант атмосферы (страховка под движки day/night и погоды)
  function validateConfig(){
    const p: string[] = [];
    if(!(K.DAYNIGHT_PERIOD>0)) p.push('K.DAYNIGHT_PERIOD должен быть > 0');
    if(!(K.WEATHER_PERIOD>0)) p.push('K.WEATHER_PERIOD должен быть > 0');
    if(!(K.WEATHER_DUR>0)) p.push('K.WEATHER_DUR должен быть > 0');
    if(!(K.WEATHER_SNOW_CHANCE>=0 && K.WEATHER_SNOW_CHANCE<=1)) p.push('K.WEATHER_SNOW_CHANCE вне [0,1]');
    ['WEATHER_RAIN_TAXI','WEATHER_SNOW_TAXI'].forEach(k=>{
      if(!((K as unknown as Record<string, number>)[k]>0 && (K as unknown as Record<string, number>)[k]<=1)) p.push('K.'+k+' должен быть в (0,1]');
    });
    if(!(K.WEATHER_SNOW_TAXI < K.WEATHER_RAIN_TAXI)) p.push('снег должен мешать рулению сильнее дождя');
    if(!WEATHER_KINDS.includes('clear')) p.push('WEATHER_KINDS должен включать "clear"');
    // экономика: ручки модели в допустимых диапазонах (см. levelEconomy)
    ['ECON_OPEN_FRAC','ECON_UP_FRAC','TWO_SVC_CHANCE','ECON_COMBO_REAL','ECON_EXPRESS_SHARE','ECON_CHAOS','ECON_KIT_FLOOR'].forEach(k=>{
      if(!((K as unknown as Record<string, number>)[k]>=0 && (K as unknown as Record<string, number>)[k]<=1)) p.push('K.'+k+' должен быть в [0,1]');
    });
    if(!(K.ECON_FLOW_SECS>0)) p.push('K.ECON_FLOW_SECS должен быть > 0');
    if(!(K.SVC_MIN>0 && K.SVC_MIN<=K.SVC_MAX)) p.push('K.SVC_MIN должен быть в (0, SVC_MAX]');
    if(!(K.ECON_GEN_BASE>=1)) p.push('K.ECON_GEN_BASE должен быть >= 1 (иначе деньги могут блокировать 3★)');
    if(!(K.ECON_GEN_DIFF>=0)) p.push('K.ECON_GEN_DIFF должен быть >= 0');
    ['ECON_W_EVENT','ECON_W_TIME','ECON_W_DENS','ECON_W_ENV'].forEach(k=>{ if(!((K as unknown as Record<string, number>)[k]>=0)) p.push('K.'+k+' должен быть >= 0'); });
    if(!(K.ECON_DIFF_NORM>0)) p.push('K.ECON_DIFF_NORM должен быть > 0');
    if(!(K.ECON_FLOW_REF>0)) p.push('K.ECON_FLOW_REF должен быть > 0');
    if(!(K.ECON_DIFF_CAP>0)) p.push('K.ECON_DIFF_CAP должен быть > 0');
    if(!(K.BAY_OPEN_COST>0)) p.push('K.BAY_OPEN_COST должен быть > 0');
    if(!(Array.isArray(K.BAY_UP_COST) && K.BAY_UP_COST.length>=1 && K.BAY_UP_COST[0]>0)) p.push('K.BAY_UP_COST должен начинаться с цены > 0');
    return p;
  }
  // бонус-уровни: каждый кратен 5 (бонус «каждые 5 уровней»), валидная раскладка,
  // тема задана, и after не выходит за пределы кампании
  function validateBonus(){
    const p: string[] = [];
    if(!Array.isArray(BONUS)){ p.push('BONUS должен быть массивом'); return p; }
    const seen: Record<string, number> = {};
    BONUS.forEach((b,i)=>{
      const L = 'BONUS['+i+']: ';
      if(b.id==null) p.push(L+'нет id');
      else { if(seen[b.id]) p.push(L+'дублирующийся id '+b.id); seen[b.id]=1; }
      if(!(b.after>=1)) p.push(L+'after должен быть >= 1');
      else {
        if(b.after % 5 !== 0) p.push(L+'after должен быть кратен 5 (бонус каждые 5 уровней)');
        if(b.after > LEVELS.length) p.push(L+'after выходит за пределы кампании (L'+b.after+')');
      }
      const lv: Level = b.level || ({} as Level);
      if(!lv.bonus) p.push(L+'level.bonus (тема) не задана');
      const o = lv.objective;
      if(!o) p.push(L+'нет objective');
      else if(!Array.isArray(o.stars) || o.stars.length!==3 || !(o.stars[0]>0) || !(o.stars[0]<=o.stars[1] && o.stars[1]<=o.stars[2]))
        p.push(L+'objective.stars должен быть [1★,2★,3★] по возрастанию');
      ['top','left','bottom'].forEach(side=>{
        const c = ((lv.sides||{}) as Record<string, SideCfg | undefined>)[side];
        if(!c){ p.push(L+'нет стороны "'+side+'"'); return; }
        if(!SVC_TYPES.includes(c.type)) p.push(L+side+': неизвестный тип бокса "'+c.type+'"');
        if(!(c.slots>=1)) p.push(L+side+': slots должен быть >= 1');
        if(!(c.open>=0 && c.open<=c.slots)) p.push(L+side+': open вне диапазона [0, slots]');
      });
      if(!(lv.runways!=null && lv.runways>=1)) p.push(L+'runways должен быть >= 1');
      if(lv.calm!=null && !(lv.calm>0)) p.push(L+'calm должен быть > 0');
    });
    return p;
  }
  // медали (ACH.defs): уникальные id, валидный тир, непустая иконка, флаги-boolean,
  // и у КАЖДОЙ медали есть текст (ach.<id>.t / .d). Реестр медалей — единственный
  // источник правды (как SKIN_DEFS у скинов): тесты ловят битую запись здесь, а не в
  // рантайме на экране. Прямая страховка от «добавил медаль, забыл i18n / задвоил id /
  // выбрал несуществующий тир».
  function validateAch(){
    const p: string[] = [];
    const defs = ACH && ACH.defs;
    if(!Array.isArray(defs) || !defs.length){ p.push('ACH.defs пуст'); return p; }
    // en — источник правды по тексту (паритет языков отдельно ловит validateI18n)
    const dict = I18N['en' as LangCode] as unknown as Record<string, unknown>;
    const TIER_MAX = 5;   // тиры 1..5: renderMedals перебирает [1..5], MEDAL_RAR на 5, есть medals.tier<n>
    const seen: Record<string, number> = {};
    const tiers = new Set<number>();
    defs.forEach((d: any, i: number)=>{
      const id = (d && d.id!=null) ? String(d.id) : '';
      const L = 'ACH['+(id||i)+']: ';
      if(!id){ p.push(L+'нет id'); return; }
      if(seen[id]) p.push(L+'дублирующийся id "'+id+'"'); else seen[id]=1;
      if(!(Number.isInteger(d.tier) && d.tier>=1 && d.tier<=TIER_MAX)) p.push(L+'tier должен быть целым в [1,'+TIER_MAX+']');
      else tiers.add(d.tier);
      if(typeof d.ic!=='string' || !d.ic) p.push(L+'ic (иконка) должен быть непустой строкой');
      ['pending','comp','hidden'].forEach(f=>{ if(d[f]!=null && d[f]!==true) p.push(L+f+' должен быть true (или отсутствовать)'); });
      if(d.prog!=null && typeof d.prog!=='function') p.push(L+'prog должен быть функцией (s)=>[текущее, цель]');
      ['t','d'].forEach(suf=>{ if(dict['ach.'+id+'.'+suf]==null) p.push(L+'нет i18n-ключа "ach.'+id+'.'+suf+'"'); });
    });
    // заголовок каждого использованного тира (renderMedals зовёт medals.tier<n>)
    tiers.forEach(tr=>{ if(dict['medals.tier'+tr]==null) p.push('ACH: нет i18n-ключа "medals.tier'+tr+'"'); });
    // «Легенда» (вся коллекция) — особая медаль; на неё завязаны checkLegend/give('legend')
    if(!seen['legend']) p.push('ACH: отсутствует медаль "legend" (на неё завязан checkLegend)');
    return p;
  }
  function validateGame(){ return validateLevels().concat(validateBonus()).concat(validateI18n()).concat(validateConfig()).concat(validateAch()).concat(validateLeaderboard()); }

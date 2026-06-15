// @ts-nocheck -- TODO(ts-migration): type this module, then remove this line
  function validateLevels(){
    const p = [];
    if(!Array.isArray(LEVELS) || !LEVELS.length){ p.push('LEVELS пуст'); return p; }
    const firstSeen = {};   // тип события -> индекс уровня, где впервые включён
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
        if(o.race && !(o.time>0)) p.push(L+'race-уровень требует objective.time');
        if(o.upg!=null){
          if(o.metric!=='served') p.push(L+'objective.upg допустим только при metric "served"');
          if(!Array.isArray(o.upg) || o.upg.length!==3) p.push(L+'objective.upg должен быть массивом из 3 порогов');
          else if(!(o.upg[0]<=o.upg[1] && o.upg[1]<=o.upg[2])) p.push(L+'objective.upg должны идти по возрастанию');
        }
      }
      const sides = lv.sides || {};
      ['top','left','bottom'].forEach(side=>{
        const c = sides[side];
        if(!c){ p.push(L+'нет стороны "'+side+'"'); return; }
        if(!SVC_TYPES.includes(c.type)) p.push(L+side+': неизвестный тип бокса "'+c.type+'"');
        if(!(c.slots>=1)) p.push(L+side+': slots должен быть >= 1');
        if(!(c.open>=0 && c.open<=c.slots)) p.push(L+side+': open вне диапазона [0, slots]');
      });
      if(!(lv.runways>=1)) p.push(L+'runways должен быть >= 1');
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
      const ev = lv.events || {};
      Object.keys(ev).forEach(k=>{
        if(!EVENT_KEYS.includes(k)) p.push(L+'неизвестное событие "'+k+'"');
        else if(typeof ev[k]!=='boolean') p.push(L+'событие "'+k+'" должно быть boolean');
      });
      EVENT_KEYS.forEach(k=>{ if(ev[k] && firstSeen[k]==null) firstSeen[k]=i; });
      // спокойный блок L1–L4 — без единого спецсобытия
      if(i < CALM_LEVELS && EVENT_KEYS.some(k=>ev[k])) p.push(L+'спокойный блок L1–L'+CALM_LEVELS+' — без спецсобытий');
      // ТЕМП (pace) — главная ось сложности: обязателен, в [0,1], и НЕ убывает по кампании
      if(!(typeof lv.pace==='number' && lv.pace>=0 && lv.pace<=1)) p.push(L+'pace должен быть числом в [0,1] (темп/интенсивность уровня)');
      else if(i>0 && typeof LEVELS[i-1].pace==='number' && lv.pace < LEVELS[i-1].pace) p.push(L+'pace должен не убывать по кампании (интенсивность только растёт)');
    });
    // прогрессия: спецсобытия вводятся только после спокойного блока (с L5)
    Object.keys(firstSeen).forEach(k=>{
      const i = firstSeen[k];
      if(i < CALM_LEVELS) p.push('Событие "'+k+'" введено на L'+(i+1)+' — спецсобытия только с L'+(CALM_LEVELS+1)+' (L1–L'+CALM_LEVELS+' — спокойный блок)');
    });
    return p;
  }
  function validateI18n(){
    const p = [], langs = Object.keys(I18N), all = new Set();
    langs.forEach(c=>Object.keys(I18N[c]).forEach(k=>{ if(k[0]!=='_') all.add(k); }));
    langs.forEach(c=>{ all.forEach(k=>{ if(I18N[c][k]==null) p.push('i18n: в языке "'+c+'" нет ключа "'+k+'"'); }); });
    return p;
  }
  // проверка констант атмосферы (страховка под движки day/night и погоды)
  function validateConfig(){
    const p = [];
    if(!(K.DAYNIGHT_PERIOD>0)) p.push('K.DAYNIGHT_PERIOD должен быть > 0');
    if(!(K.WEATHER_PERIOD>0)) p.push('K.WEATHER_PERIOD должен быть > 0');
    if(!(K.WEATHER_DUR>0)) p.push('K.WEATHER_DUR должен быть > 0');
    if(!(K.WEATHER_SNOW_CHANCE>=0 && K.WEATHER_SNOW_CHANCE<=1)) p.push('K.WEATHER_SNOW_CHANCE вне [0,1]');
    ['WEATHER_RAIN_TAXI','WEATHER_SNOW_TAXI'].forEach(k=>{
      if(!(K[k]>0 && K[k]<=1)) p.push('K.'+k+' должен быть в (0,1]');
    });
    if(!(K.WEATHER_SNOW_TAXI < K.WEATHER_RAIN_TAXI)) p.push('снег должен мешать рулению сильнее дождя');
    if(!WEATHER_KINDS.includes('clear')) p.push('WEATHER_KINDS должен включать "clear"');
    // экономика: ручки модели в допустимых диапазонах (см. levelEconomy)
    ['ECON_OPEN_FRAC','ECON_UP_FRAC','TWO_SVC_CHANCE','ECON_COMBO_REAL','ECON_EXPRESS_SHARE','ECON_CHAOS','ECON_KIT_FLOOR'].forEach(k=>{
      if(!(K[k]>=0 && K[k]<=1)) p.push('K.'+k+' должен быть в [0,1]');
    });
    if(!(K.ECON_FLOW_SECS>0)) p.push('K.ECON_FLOW_SECS должен быть > 0');
    if(!(K.SVC_MIN>0 && K.SVC_MIN<=K.SVC_MAX)) p.push('K.SVC_MIN должен быть в (0, SVC_MAX]');
    if(!(K.ECON_GEN_BASE>=1)) p.push('K.ECON_GEN_BASE должен быть >= 1 (иначе деньги могут блокировать 3★)');
    if(!(K.ECON_GEN_DIFF>=0)) p.push('K.ECON_GEN_DIFF должен быть >= 0');
    ['ECON_W_EVENT','ECON_W_TIME','ECON_W_DENS','ECON_W_ENV'].forEach(k=>{ if(!(K[k]>=0)) p.push('K.'+k+' должен быть >= 0'); });
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
    const p = [];
    if(!Array.isArray(BONUS)){ p.push('BONUS должен быть массивом'); return p; }
    const seen = {};
    BONUS.forEach((b,i)=>{
      const L = 'BONUS['+i+']: ';
      if(b.id==null) p.push(L+'нет id');
      else { if(seen[b.id]) p.push(L+'дублирующийся id '+b.id); seen[b.id]=1; }
      if(!(b.after>=1)) p.push(L+'after должен быть >= 1');
      else {
        if(b.after % 5 !== 0) p.push(L+'after должен быть кратен 5 (бонус каждые 5 уровней)');
        if(b.after > LEVELS.length) p.push(L+'after выходит за пределы кампании (L'+b.after+')');
      }
      const lv = b.level || {};
      if(!lv.bonus) p.push(L+'level.bonus (тема) не задана');
      const o = lv.objective;
      if(!o) p.push(L+'нет objective');
      else if(!Array.isArray(o.stars) || o.stars.length!==3 || !(o.stars[0]>0) || !(o.stars[0]<=o.stars[1] && o.stars[1]<=o.stars[2]))
        p.push(L+'objective.stars должен быть [1★,2★,3★] по возрастанию');
      ['top','left','bottom'].forEach(side=>{
        const c = (lv.sides||{})[side];
        if(!c){ p.push(L+'нет стороны "'+side+'"'); return; }
        if(!SVC_TYPES.includes(c.type)) p.push(L+side+': неизвестный тип бокса "'+c.type+'"');
        if(!(c.slots>=1)) p.push(L+side+': slots должен быть >= 1');
        if(!(c.open>=0 && c.open<=c.slots)) p.push(L+side+': open вне диапазона [0, slots]');
      });
      if(!(lv.runways>=1)) p.push(L+'runways должен быть >= 1');
      if(lv.calm!=null && !(lv.calm>0)) p.push(L+'calm должен быть > 0');
    });
    return p;
  }
  function validateGame(){ return validateLevels().concat(validateBonus()).concat(validateI18n()).concat(validateConfig()).concat(validateLeaderboard()); }

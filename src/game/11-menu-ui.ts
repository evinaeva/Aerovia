// ===== 11-menu-ui — menus & screens (start, level select, biomes, goals, settings, leaderboard, pause), menu icons, save/load & pause wiring =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: showStart, showLevels, showBiomes, showGoals, showLeaderboard, openSettings, buildLevel/Biome/Bonus, startLevel, setPaused, loadGame, saveGame, resetProgress, SVGIC, applyMenuIcons, hideAllScreens, updateStartChips, goalRowsHTML.
// Reads: 04 (LEVELS, LV, curBiome, curBonus, Biome, Bonus); 06 (save, bays, runways, layout, levelIdx/levelKey, survival, debug, SAVE_KEY); 03 (I18N, lang); 09 (heart).

  function loadGame(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) || 'null'); if(s&&typeof s==='object'){ save.unlocked=s.unlocked||1; save.best=s.best||{}; save.stars=s.stars||{}; save.lang=(s.lang&&I18N[s.lang as LangCode])?s.lang:null; save.ach=Array.isArray(s.ach)?s.ach:[]; save.stats=(s.stats&&typeof s.stats==='object')?s.stats:{}; save.sound=s.sound!==false; save.vibro=s.vibro!==false; save.tutorialDone=!!s.tutorialDone; } }catch(e){} }
  function saveGame(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
  // язык, медали (ach/stats) и звук/вибро — не прогресс уровней, сохраняем при сбросе
  // сброс прогресса заодно возвращает туториал — новый игрок снова увидит обучение
  function resetProgress(){ save={unlocked:1,best:{},stars:{},lang:save.lang,ach:save.ach||[],stats:save.stats||{},sound:save.sound!==false,vibro:save.vibro!==false,tutorialDone:false}; saveGame(); renderLevels(); }
  function buildLevel(idx: number){ curBiome=null; curBonus=null; levelIdx=idx; levelKey=idx; LV=LEVELS[idx]; bays=[]; runways=[]; layout(); }
  function buildBiome(b: Biome){ curBiome=b; curBonus=null; levelIdx=-1; levelKey='b_'+b.id; LV=b.level!; bays=[]; runways=[]; layout(); }
  // бонус-уровень: своя тема и строковый ключ сохранения (как биом — кампанию не двигает)
  function buildBonus(b: Bonus){ curBiome=null; curBonus=b; levelIdx=-1; levelKey='bonus_'+b.id; LV=b.level!; bays=[]; runways=[]; layout(); }
  // ---- menu icons (Lucide-style, inlined from the design system's ui.jsx) ----
  // Иконки меню — подстановка в стиле Lucide (см. HANDOFF.md). SVGIC(name) → строка;
  // статичные кнопки несут <span class="mic" data-mic="name">, заполняется на старте
  // applyMenuIcons(); рендереры зовут SVGIC() напрямую. Цвет наследуется (currentColor).
  const _ICO_STROKE: Record<string, string> = {
    moon:'<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/>',
    tree:'<path d="M12 3 5 13h4l-3 5h12l-3-5h4L12 3Z"/><path d="M12 18v3"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    medal:'<circle cx="12" cy="14" r="6"/><path d="M8.5 8 6 3M15.5 8 18 3M9.5 5.5 12 2l2.5 3.5"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    again:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
    refresh:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
    home:'<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>',
    check:'<path d="m5 13 4 4L19 6"/>',
    back:'<path d="M15 5l-7 7 7 7"/>',
    fwd:'<path d="M9 5l7 7-7 7"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11"/><path d="M12 9C12 9 9.5 3.5 7.2 5.3 5.4 6.7 8.8 9 12 9ZM12 9c0 0 2.5-5.5 4.8-3.7C18.6 6.7 15.2 9 12 9Z"/>',
    trophy:'<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5A1.5 1.5 0 0 0 3 7.5C3 9 4 10.5 7 11M17 6h2.5A1.5 1.5 0 0 1 21 7.5C21 9 20 10.5 17 11M9.5 14h5M12 13v3M9 20h6M10 16h4l.5 4h-5L10 16Z"/>',
    bug:'<rect x="8" y="7" width="8" height="11" rx="4"/><path d="M12 7V4M9 5 7.5 3.5M15 5l1.5-1.5M8 11H4M20 11h-4M8 15H4.5M19.5 15H16"/>',
    hand:'<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-3.6-1.5L4 15.5a1.6 1.6 0 0 1 2.3-2.2L8 15"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    inf:'<path d="M6.5 9a3 3 0 1 0 0 6c1.7 0 2.8-1.5 5.5-3s3.8-3 5.5-3a3 3 0 1 1 0 6c-1.7 0-2.8-1.5-5.5-3"/>',
    expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  };
  const _ICO_FILL: Record<string, string> = {
    play:'<path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z"/>',
    next:'<path d="M5 5.5v13a1 1 0 0 0 1.5.87L14 15v3.5a1 1 0 0 0 1.5.87l8-6.5a1 1 0 0 0 0-1.74l-8-6.5A1 1 0 0 0 14 5.5V9L6.5 4.63A1 1 0 0 0 5 5.5Z"/>',
    plane:'<path d="M21 15.5 13.5 13V6.5a1.5 1.5 0 0 0-3 0V13L3 15.5V18l7.5-2v3l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l8 2v-2.5Z"/>',
    heart:'<path d="M12 20.5 4.3 13a4.7 4.7 0 0 1 6.6-6.7l1.1 1 1.1-1A4.7 4.7 0 0 1 19.7 13L12 20.5Z"/>',
    star:'<path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.5l1.1-6L3.4 9.3l6-.8L12 3Z"/>',
    coin:'<circle cx="12" cy="12" r="9"/>',
    pause:'<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>',
  };
  function SVGIC(name: string){
    if(_ICO_FILL[name]) return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">'+_ICO_FILL[name]+'</svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(_ICO_STROKE[name]||'')+'</svg>';
  }
  // заполнить статические плейсхолдеры иконок (<span class="mic" data-mic="...">)
  function applyMenuIcons(root?: Document | HTMLElement){ try{ (root||document).querySelectorAll('[data-mic]').forEach((el: Element)=>{ (el as HTMLElement).innerHTML=SVGIC((el as HTMLElement).dataset.mic!); }); }catch(e){} }

  // ---- экран рейтинга (каркас): срезы all-time/month/week из Leaderboard (mock-провайдер) ----
  let lbPeriod = 'alltime';
  function lbEsc(s: any){ const _m: Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}; return String(s==null?'':s).replace(/[&<>"]/g, (c: string)=>_m[c]); }
  function showLeaderboard(){ hideAllScreens(); document.getElementById('leaderboardScreen')!.classList.remove('hidden'); renderLeaderboard(); }
  function renderLeaderboard(){
    const acct = Leaderboard.account.current();
    const tabs = document.getElementById('lbTabs');
    if(tabs){ tabs.innerHTML='';
      PERIODS.forEach(p=>{ const b=document.createElement('button');
        b.className='m-btn '+(p===lbPeriod?'m-btn--primary':'m-btn--ghost'); b.style.cssText='flex:1;min-width:0;padding:8px 4px';
        b.textContent=t('lb.tab.'+p); b.onclick=()=>{ if(lbPeriod!==p){ lbPeriod=p; renderLeaderboard(); } }; tabs.appendChild(b); });
    }
    const list = document.getElementById('lbList');
    if(list) list.innerHTML='<div class="muted" style="padding:16px;text-align:center">…</div>';
    Leaderboard.top(lbPeriod,'survival').then(rows=>{
      if(!list) return; list.innerHTML='';
      if(!rows.length){ list.innerHTML='<div class="muted" style="padding:18px;text-align:center">'+lbEsc(t('lb.empty'))+'</div>'; return; }
      const head=document.createElement('div'); head.style.cssText='display:flex;gap:10px;padding:4px 12px 8px;font-size:12px;opacity:.55';
      head.innerHTML='<span style="width:36px">'+t('lb.col.rank')+'</span><span style="flex:1">'+t('lb.col.player')+'</span><span>'+t('lb.col.score')+'</span>';
      list.appendChild(head);
      rows.forEach(r=>{
        const me = !!(acct && r.accountId===acct.id);
        const medal = r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':('#'+r.rank);
        const row=document.createElement('div');
        row.style.cssText='display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:10px;'+
          (me?'background:rgba(120,200,255,.16);font-weight:700':(r.rank%2?'background:rgba(255,255,255,.035)':''));
        row.innerHTML='<span style="width:36px;opacity:.85">'+medal+'</span>'+
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+lbEsc(r.name)+(me?' · '+t('lb.you'):'')+'</span>'+
          '<span style="font-variant-numeric:tabular-nums">'+fmtNum(r.score)+'</span>';
        list.appendChild(row);
      });
    }).catch(()=>{ if(list) list.innerHTML=''; });
    const foot = document.getElementById('lbFoot');
    if(foot){ foot.innerHTML='';
      const best = Leaderboard.bestScore('survival');
      const who = acct ? (t('lb.signedin')+': '+lbEsc(acct.name||('Player-'+String(acct.id).slice(-4).toUpperCase()))) : t('lb.signin');
      const info=document.createElement('div');
      info.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;font-size:13px';
      info.innerHTML='<span class="muted">'+who+'</span><span>'+t('lb.yourbest')+': <b>'+(best?fmtNum(best):lbEsc(t('lb.unranked')))+'</b></span>';
      foot.appendChild(info);
    }
  }

  function hideAllScreens(){ ['startScreen','levelScreen','biomeScreen','overScreen','pauseScreen','settingsScreen','medalScreen','leaderboardScreen','goalsScreen','confirmScreen'].forEach(s=>document.getElementById(s)!.classList.add('hidden')); }
  // главный экран: чип звёзд = сумма заработанных / максимум по основным уровням
  function updateStartChips(){
    let got=0; for(let i=0;i<LEVELS.length;i++) got+=save.stars[i]||0;
    const v=document.getElementById('startStars'), mx=document.getElementById('startStarsMax');
    if(v) v.textContent=fmtNum(got);
    if(mx) mx.textContent='/'+fmtNum(LEVELS.length*3);
  }
  function showStart(){ hideAllScreens(); updateStartChips(); document.getElementById('startScreen')!.classList.remove('hidden'); }
  function showLevels(){ inMenu=true; renderLevels(); hideAllScreens(); document.getElementById('levelScreen')!.classList.remove('hidden'); }
  function startLevel(idx: number){ survival=false; buildLevel(idx); hideAllScreens(); reset(); }
  function startBonus(b: Bonus){ if(!bonusUnlocked(b)) return; survival=false; buildBonus(b); hideAllScreens(); reset(); }
  // карты-биомы = режим SURVIVAL: отдельный экран выбора (из главного меню). Survival живёт
  // ИМЕННО на картах — бесконечный заход с жизнями, счёт = обслуженные борта; на конце (потеря
  // всех жизней) счёт уходит в глобальный рейтинг (см. endLevel → Leaderboard). Интенсивность
  // нарастает со временем (survivalPace); карты различаются своим pace/survRamp и помехами.
  function showBiomes(){ inMenu=true; renderBiomes(); hideAllScreens(); document.getElementById('biomeScreen')!.classList.remove('hidden'); }
  function startBiome(b: Biome){ if(!b.ready) return; survival=true; buildBiome(b); hideAllScreens(); reset(); }
  function renderBiomes(){
    const list=document.getElementById('biomeList')!; list.innerHTML='';
    BIOMES.forEach(b=>{
      const best=save.best['b_'+b.id]||0;
      const card=document.createElement('div');
      card.className='biome'+(b.ready?'':' locked');
      card.style.cursor=b.ready?'pointer':'default';
      const foot = b.ready
        ? `<span class="biome__stars">${SVGIC('trophy')}<span class="biome__best">${t('biomes.best')}</span> ✈ ${fmtNum(best)}</span>`
        : `<span class="biome__lock">${SVGIC('lock')} ${t('biomes.soon')}</span>`;
      card.innerHTML=`<div class="biome__ic">${b.emoji}</div>`+
        `<div class="biome__name">${t('biome.'+b.id+'.name')}</div>`+
        `<div class="biome__desc">${t('biome.'+b.id+'.tag')}</div>`+
        `<div class="biome__foot">${foot}</div>`;
      if(b.ready) card.onclick=()=>startBiome(b);
      list.appendChild(card);
    });
  }
  // звезда из HUD-листа дизайна (инлайн, чтобы карточки не зависели от загрузки листов)
  const STAR_PATH='M11.5 2.3a.53.53 0 0 1 1 0l2.3 4.68a2.1 2.1 0 0 0 1.6 1.16l5.16.75a.53.53 0 0 1 .3.91l-3.74 3.64a2.1 2.1 0 0 0-.6 1.87l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.1 2.1 0 0 0-1.97 0L6.4 21a.53.53 0 0 1-.77-.56l.88-5.14a2.1 2.1 0 0 0-.6-1.87L2.16 9.8a.53.53 0 0 1 .3-.91l5.16-.75a2.1 2.1 0 0 0 1.6-1.16z';
  function starSvg(on: boolean){
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(on
      ? `<path d="${STAR_PATH}" fill="#f4cf5e"/>`
      : `<path d="${STAR_PATH}" fill="none" stroke="#6b6d7a" stroke-width="1.6"/>`)+'</svg>';
  }
  // мини-борд для превью карточки: тармак + вода + полоса + маршрут (вариация от номера)
  // узловые уровни кампании: где впервые включается событие/механика (см. LEVELS).
  // Возвращает {idx:[ключи]} — по этим уровням на карте рисуем иконку фичи (до
  // открытия уровня она спрятана «туманом»). Данные-управляемо: новый блок в
  // LEVELS автоматически даёт новый узел, ничего не хардкодим (см. validateLevels).
  function levelFeatures(){
    const seen=new Set<string>(), out: Record<number, string[]>={};
    LEVELS.forEach((lv,i)=>{
      const ev=lv.events||{}, fresh: string[]=[];
      EVENT_KEYS.forEach(k=>{ if(ev[k] && !seen.has(k)){ fresh.push(k); seen.add(k); } });
      if(fresh.length) out[i]=fresh;
    });
    return out;
  }
  // иконка + цветовой класс бейджа для каждой механики (классы — в CSS .case-feat.*)
  const FEATURE_META: Record<string, {icon: string; cls: string}> = {
    vip:      {icon:'👑', cls:'fvip'},      rush: {icon:'⏱', cls:'frush'},
    medical:  {icon:'✚',  cls:'fmedical'},  emergency:{icon:'⛽', cls:'femergency'},
    fog:      {icon:'🌫', cls:''},          wind: {icon:'🌬', cls:''},
  };
  const LOCK_SVG='<svg class="case-lock" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">'+
    '<rect x="5" y="11" width="14" height="9" rx="2" fill="#8a8c99"/>'+
    '<path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#8a8c99" stroke-width="2" stroke-linecap="round"/></svg>';
  // тягач: кабина смотрит вправо (к самолёту), сцепка-дышло слева (к вагонам)
  const TUG_SVG='<svg viewBox="0 0 54 46" aria-hidden="true">'+
    '<rect x="0" y="26" width="14" height="3" rx="1.5" fill="#3a3550"/>'+              // дышло к вагонам
    '<rect x="12" y="15" width="30" height="16" rx="4" fill="#f2a93b"/>'+              // корпус
    '<rect x="27" y="6" width="15" height="12" rx="3" fill="#3c3552"/>'+               // кабина
    '<rect x="30" y="8" width="10" height="7" rx="2" fill="#bfe9ff" opacity=".85"/>'+  // стекло
    '<circle cx="34" cy="5" r="2" fill="#ef5365"/>'+                                   // маячок
    '<circle cx="19" cy="33" r="7" fill="#1c1828" stroke="#0e0b16" stroke-width="2"/>'+
    '<circle cx="38" cy="33" r="7" fill="#1c1828" stroke="#0e0b16" stroke-width="2"/>'+
    '<circle cx="19" cy="33" r="2.4" fill="#5a5470"/><circle cx="38" cy="33" r="2.4" fill="#5a5470"/></svg>';
  // карта уровней (дизайн-система): пагинация по LV_PER, ветка бонус-уровня,
  // узлы со звёздами/замком/бейджем механики. Данные те же (LEVELS, save.stars,
  // save.unlocked, bonusAfter/bonusUnlocked) — меняется только облик.
  let levelPage = 0, levelPageInit = false;
  const LV_PER = 5;
  function renderLevels(){
    const host=document.getElementById('levelList')!; host.innerHTML='';
    let got=0; for(let i=0;i<LEVELS.length;i++) got+=save.stars[i]||0;
    const max=LEVELS.length*3, sc=document.getElementById('starCount');
    if(sc) sc.innerHTML=SVGIC('star')+` <b>${got}</b> <span class="muted">/ ${max}</span> <span class="unit">${t('levels.stars')}</span>`;

    const feats=levelFeatures();
    const pages=Math.max(1, Math.ceil(LEVELS.length/LV_PER));
    const cur=Math.min(save.unlocked-1, LEVELS.length-1);   // текущий играбельный (0-based)
    if(!levelPageInit){ levelPage=Math.floor(cur/LV_PER); levelPageInit=true; }  // открыть на текущем
    if(levelPage>=pages) levelPage=pages-1; if(levelPage<0) levelPage=0;
    const start=levelPage*LV_PER;
    const tiles=[]; for(let i=start;i<Math.min(start+LV_PER,LEVELS.length);i++) tiles.push(i);

    const map=document.createElement('div'); map.className='lvlmap';
    const prev=document.createElement('button'); prev.className='lvlmap__arrow'; prev.innerHTML=SVGIC('back');
    prev.disabled=levelPage===0; prev.onclick=()=>{ levelPage--; renderLevels(); };
    const next=document.createElement('button'); next.className='lvlmap__arrow'; next.innerHTML=SVGIC('fwd');
    next.disabled=levelPage>=pages-1; next.onclick=()=>{ levelPage++; renderLevels(); };
    const stage=document.createElement('div'); stage.className='lvlmap__stage';
    const line=document.createElement('div'); line.className='lvlmap__line'; stage.appendChild(line);

    // бонус-уровень, чей «after» попадает на эту страницу — ветка над лентой
    let pageBonus=null; for(const i of tiles){ const bn=bonusAfter(i+1); if(bn){ pageBonus=bn; break; } }
    if(pageBonus){
      const unl=bonusUnlocked(pageBonus);
      const wrap=document.createElement('div'); wrap.className='lvlmap__bonus';
      const node=document.createElement('div'); node.className='lvlnode bonus'+(unl?'':' locked');
      node.style.cursor=unl?'pointer':'default';
      node.innerHTML=`<div class="bonus-tag">${pageBonus.emoji||'★'}</div>`+SVGIC('gift');
      node.title = unl ? (bonusName(pageBonus)+(pageBonus.emoji?' '+pageBonus.emoji:'')) : t('bonus.req',{n:pageBonus.after});
      if(unl) node.onclick=()=>startBonus(pageBonus!);
      const branch=document.createElement('div'); branch.className='branch';
      wrap.appendChild(node); wrap.appendChild(branch); stage.appendChild(wrap);
    }

    const nodes=document.createElement('div'); nodes.className='lvlmap__nodes';
    tiles.forEach(i=>{
      const unlocked=debug.unlockAll||i<save.unlocked, stars=save.stars[i]||0;
      const st = !unlocked ? 'locked' : (i===cur ? 'active' : 'done');
      const node=document.createElement('div'); node.className='lvlnode '+st;
      let inner='';
      if(unlocked) inner+='<div class="lvlnode__stars">'+[0,1,2].map(n=>'<span'+(n<stars?'':' class="off"')+' style="display:inline-flex">'+SVGIC('star')+'</span>').join('')+'</div>';
      inner+= unlocked ? `<span class="lvlnode__num">${String(i+1).padStart(2,'0')}</span>` : SVGIC('lock');
      const feat=feats[i];
      if(feat){ const meta=FEATURE_META[feat[0]]||{icon:'?'}; inner+=`<span class="lvlnode__feat" title="${unlocked?t('feat.'+feat[0]):t('feat.mystery')}">${unlocked?meta.icon:'?'}</span>`; }
      if(st==='active') inner+=`<div class="lvlnode__label">${t('start.play')}</div>`;
      node.innerHTML=inner;
      let label=t('level.name',{n:i+1})+' — '+levelName(i);
      if(!unlocked) label+=' — '+t('levels.locked');
      else if(feat) label+=' — '+t('feat.'+feat[0]);
      node.setAttribute('aria-label',label);
      if(unlocked) node.onclick=()=>startLevel(i);
      nodes.appendChild(node);
    });
    stage.appendChild(nodes);
    map.appendChild(prev); map.appendChild(stage); map.appendChild(next);

    const dots=document.createElement('div'); dots.className='lvlmap__dots';
    for(let p=0;p<pages;p++){ const d=document.createElement('span'); d.className='dot'+(p===levelPage?' on':''); d.onclick=()=>{ levelPage=p; renderLevels(); }; dots.appendChild(d); }

    host.appendChild(map); host.appendChild(dots);
  }
  // сцепка между вагонами; если bn задан — на ней «выпавший чемодан» = бонус-уровень N½
  // (открыт — кликабелен и показывает 🦋, закрыт — «?» с подсказкой про нужный уровень)
  function couplingEl(bn: Bonus | null){
    const cp=document.createElement('div'); cp.className='coupling';
    if(bn){
      const unl=bonusUnlocked(bn), done=(save.stars['bonus_'+bn.id]||0)>0;
      if(unl) cp.className += done?' unlocked done':' unlocked';
      const label = unl ? (bonusName(bn)+(bn.emoji?' '+bn.emoji:'')) : t('bonus.req',{n:bn.after});
      const sc=document.createElement('span'); sc.className='bonuscase';
      sc.setAttribute('title',label); sc.setAttribute('aria-label',label);
      sc.textContent = unl ? (bn.emoji||(bn.after+'½')) : '?';
      if(unl) sc.onclick=()=>startBonus(bn);
      cp.appendChild(sc);
    }
    return cp;
  }

  // ---- полноэкранный режим (для телефона: убирает прокрутку и адресную строку) ----
  function lockLandscape(){
    try{ if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); }catch(e){}
  }
  function inFullscreen(){ return !!(document.fullscreenElement || (document as any).webkitFullscreenElement); }
  function toggleFullscreen(){
    const el = document.documentElement;
    if(!inFullscreen()){
      const req = el.requestFullscreen || (el as any).webkitRequestFullscreen;   // iOS Safari не поддерживает fullscreen для div — там помогает «Добавить на экран»
      if(req){ try{ const r = req.call(el); if(r && r.then) r.then(lockLandscape).catch(()=>{}); else lockLandscape(); }catch(e){} }
    } else {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
      if(exit){ try{ exit.call(document); }catch(e){} }
    }
  }
  { const b=document.getElementById('fsBtn'); if(b) b.onclick=toggleFullscreen; }
  ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev, ()=>{ if(inFullscreen()) lockLandscape(); resize(); }));

  document.getElementById('startBtn')!.onclick=showLevels;
  // «Выживание» ведёт прямо на экран карт (карты-биомы = режим Survival)
  { const b=document.getElementById('survivalBtn'); if(b) b.onclick=showBiomes; }
  document.getElementById('backBtn')!.onclick=()=>{ showStart(); };
  document.getElementById('againBtn')!.onclick=()=>{ document.getElementById('overScreen')!.classList.add('hidden'); reset(); };
  function backToSelect(){ if(curBiome) showBiomes(); else showLevels(); }
  document.getElementById('toLevelsBtn')!.onclick=backToSelect;
  document.getElementById('biomesBackBtn')!.onclick=()=>{ showStart(); };
  document.getElementById('nextBtn')!.onclick=()=>{ if(levelIdx+1<LEVELS.length) startLevel(levelIdx+1); };
  document.getElementById('shareBtn')!.onclick=shareShift;

  function setPaused(p: boolean){
    paused=p;
    if(p) ACH.onPause();
    document.getElementById('pauseScreen')!.classList.toggle('hidden', !p);
    if(p) buildPauseInfo();
  }
  // содержимое окна паузы: название смены, живой снимок забега (время · деньги ·
  // прогресс цели) и пороги звёзд. Зовётся при открытии и при смене языка.
  function buildPauseInfo(){
    document.getElementById('pauseTitle')!.textContent = currentLevelName();
    document.getElementById('pauseObjLabel')!.classList.toggle('hidden', false);
    document.getElementById('pauseGoals')!.innerHTML = goalRowsHTML();
    const tShown = LV.objective.time ? Math.max(0, LV.objective.time-gameTime) : gameTime;
    const mv = LV.objective.metric==='upgrades' ? upgradesDone : served;
    const prog = (survival||LV.objective.race) ? fmtNum(served) : (fmtNum(mv)+' / '+fmtNum(LV.objective.target ?? 0));
    const stats=[
      [SVGIC('clock'), fmtTime(tShown), ''],
      [SVGIC('coin'), fmtNum(money), money<0?'var(--m-life)':'var(--m-gold)'],
      [SVGIC('plane'), prog, 'var(--m-plane)'],
    ];
    document.getElementById('pauseStats')!.innerHTML = stats.map(s=>
      `<span class="rs"${s[2]?` style="color:${s[2]}"`:''}>${s[0]}<span>${s[1]}</span></span>`).join('');
  }
  document.getElementById('resumeBtn')!.onclick=()=>setPaused(false);
  document.getElementById('restartBtn')!.onclick=()=>reset();
  document.getElementById('menuBtn')!.onclick=()=>{
    recordResult(); running=false; paused=false; ACH.flushToasts(); backToSelect();
  };
  document.getElementById('optLives')!.onchange=e=>{ debug.infiniteLives=(e.target as HTMLInputElement).checked; saveDebug(); };
  document.getElementById('optMoney')!.onchange=e=>{ debug.richStart=(e.target as HTMLInputElement).checked; if(debug.richStart) money=BIG_MONEY; saveDebug(); };
  document.getElementById('optUnlockAll')!.onchange=e=>{ debug.unlockAll=(e.target as HTMLInputElement).checked; saveDebug(); renderLevels(); };
  // попап отладки в левом нижнем углу главного экрана
  (function(){
    const wrap=document.querySelector('.corner-debug');
    const btn=document.getElementById('debugToggleBtn');
    const pop=document.getElementById('debugPop');
    if(!btn||!pop||!wrap) return;
    function setOpen(open: boolean){ pop!.classList.toggle('hidden', !open); btn!.setAttribute('aria-expanded', open?'true':'false'); if(open) syncDebugUI(); }
    btn.onclick=(e)=>{ e.stopPropagation(); setOpen(pop.classList.contains('hidden')); };
    document.addEventListener('click',(e)=>{ if(!pop.classList.contains('hidden') && !wrap.contains(e.target as Node)) setOpen(false); });
  })();
  document.getElementById('langFlagBtn')!.onclick=()=>{
    const codes=Object.keys(I18N); const i=codes.indexOf(lang);
    setLang(codes[(i+1)%codes.length]);
  };
  // звук/вибро — переключатели-тоглы (.switch) в экране «Настройки» главного меню
  function syncSettingsUI(){
    const s=document.getElementById('optSound2'); if(s){ s.classList.toggle('on', save.sound!==false); s.setAttribute('aria-checked', String(save.sound!==false)); }
    const v=document.getElementById('optVibro2'); if(v){ v.classList.toggle('on', save.vibro!==false); v.setAttribute('aria-checked', String(save.vibro!==false)); }
  }
  function setSound(on: boolean){ save.sound=on; saveGame(); SND.setEnabled(on); syncSettingsUI(); Analytics.track('setting_changed', {key:'sound', value:!!on}); }
  function setVibro(on: boolean){ save.vibro=on; saveGame(); HAP.on=on; syncSettingsUI(); Analytics.track('setting_changed', {key:'vibro', value:!!on}); }
  (function(){
    const s=document.getElementById('optSound2'); if(s) s.onclick=()=>setSound(!(save.sound!==false));
    const v=document.getElementById('optVibro2'); if(v) v.onclick=()=>setVibro(!(save.vibro!==false));
  })();

  // настройки из стартового меню (звук / язык / сброс прогресса)
  function openSettings(){ inMenu=true; syncSettingsUI(); renderLangBtns(); hideAllScreens();
    document.getElementById('settingsScreen')!.classList.remove('hidden'); }
  document.getElementById('settingsMenuBtn')!.onclick=openSettings;
  document.getElementById('settingsBackBtn')!.onclick=()=>{ showStart(); };

  // «Проверить обновления»: дёргаем service worker по запросу (помимо
  // авто-проверки раз в 30 мин). Подтягивает новую версию приложения и
  // освежает закэшированные PNG скинов; статус показываем под кнопкой.
  (function(){
    const btn=document.getElementById('checkUpdatesBtn') as HTMLButtonElement|null; const out=document.getElementById('updStatus');
    if(!btn) return;
    btn.onclick=async()=>{
      if(btn.disabled) return;
      btn.disabled=true; if(out) out.textContent=t('settings.updChecking');
      let status='offline';
      try{ status = ((window as any).pwaCheckForUpdates ? await (window as any).pwaCheckForUpdates() : 'offline'); }
      catch(e){ status='offline'; }
      // при 'updating'/'refreshed' страница перезагрузится сама; текст — на случай, если нет
      const key = status==='updating' ? 'settings.updUpdating'
                : status==='refreshed' ? 'settings.updRefreshed'
                : 'settings.updOffline';
      if(out) out.textContent=t(key);
      btn.disabled=false;
    };
  })();
  function askReset(){ document.getElementById('confirmScreen')!.classList.remove('hidden'); }
  document.getElementById('resetProgBtn2')!.onclick=askReset;
  document.getElementById('resetCancelBtn')!.onclick=()=>document.getElementById('confirmScreen')!.classList.add('hidden');
  document.getElementById('resetConfirmBtn')!.onclick=()=>{ document.getElementById('confirmScreen')!.classList.add('hidden'); resetProgress(); };

  // ---- окно постановки целей смены ----
  // Показывается в начале каждого раунда (на паузе), а также по кнопке «Цели» в
  // паузе. Закрыть: «Понятно» или тап мимо карточки. Звёзды: 1★ цель, 2★ без
  // наземных штрафов, 3★ без крушений (см. computeStars). В Survival — рекорд без звёзд.
  let goalsFromPause=false;
  // Цели смены одной разметкой: звёзды (1★ цель, 2★ без наземных штрафов, 3★ без
  // крушений) + подсказка биома. В Survival — рекорд без звёзд. Используется и окном
  // постановки целей в начале раунда, и встроенным блоком в паузе.
  // иконки целей (24×24, цвет наследуется через currentColor — раскрашиваем в CSS)
  const GICON = {
    clock:  '<svg class="gicon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.4V12l3.1 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plane:  '<svg class="gicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-1.9l-7.5-4.7V3.7a1.5 1.5 0 0 0-3 0v5.7L3 14.1V16l7.5-2.3V18.6L8.4 20.1V21.6l3.1-.9 3.1.9v-1.5l-2.1-1.5V13.7z" fill="currentColor"/></svg>',
    wrench: '<svg class="gicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.7 18.4l-7.1-7.1a4.6 4.6 0 0 0-5.8-5.9l2.9 2.9-2.5 2.5-2.9-2.9a4.6 4.6 0 0 0 5.9 5.8l7.1 7.1a1 1 0 0 0 1.4 0l1.1-1.1a1 1 0 0 0 0-1.3z" fill="currentColor"/></svg>',
    // гусеница (для бонус-мира «луг бабочек»): сегменты-кружки + голова с усиками
    caterpillar: '<svg class="gicon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="15.5" r="3" fill="currentColor"/><circle cx="9.4" cy="14.6" r="3.3" fill="currentColor"/><circle cx="14" cy="13.7" r="3.5" fill="currentColor"/><circle cx="18.4" cy="12.6" r="3.8" fill="currentColor"/><path d="M17.4 9.1l-.7-2.2M19.7 9l.9-2.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };
  const INF = '∞';
  function hasI18n(key: string){ return (I18N[lang] && I18N[lang][key]!=null) || (I18N[DEFAULT_LANG] && I18N[DEFAULT_LANG][key]!=null); }
  // окно/блок целей: вызов + обучающая строка + цели и звёзды-градация иконками.
  // Та же разметка для окна постановки целей и для встроенного блока в паузе.
  function goalRowsHTML(){
    if(survival){
      const best = save.best[levelKey]||0;
      const hint = LV.biome ? `<p class="m-subtitle">${t('biome.'+LV.biome+'.hint')}</p>` : '';
      return `${hint}<p class="m-subtitle">${t('goals.survival')}</p>`+
        `<div class="goal-line"><span class="g g--inf">${GICON.clock}${INF}</span>`+
        `<span class="g g--target">${GICON.plane}${fmtNum(best)}</span></div>`;
    }
    const o = LV.objective, stars = o.stars || [o.target, o.target, o.target];
    // основная метрика: гусеница на лугу бабочек, 🔧 на апгрейд-уровнях, иначе ✈
    const primary = LV.bonus==='butterfly' ? GICON.caterpillar
                  : o.metric==='upgrades' ? GICON.wrench : GICON.plane;
    // вызов (краткое описание) + обучающая строка
    let head;
    if(LV.biome) head = `<p class="m-subtitle">${t('biome.'+LV.biome+'.hint')}</p>`;
    else if(LV.bonus) head = `<p class="m-subtitle">${objectiveDesc()}</p>`;
    else {
      const n = levelIdx+1, dk='level.d.'+n, hk='level.h.'+n;
      head = `<p class="m-subtitle">${hasI18n(dk) ? t(dk) : objectiveDesc()}</p>`;
      if(hasI18n(hk)) head += `<p class="m-subtitle" style="color:var(--m-accent)">${t(hk)}</p>`;
    }
    // сводка целей: ⏱ время/∞  +  основная метрика (потолок или ∞ для race)
    const timeStr = o.time ? fmtTime(o.time) : INF;
    const headTarget = o.race ? INF : fmtNum(o.target ?? 0);
    let line = `<div class="goal-line"><span class="g g--inf">${GICON.clock}${timeStr}</span>`+
               `<span class="g g--target">${primary}${headTarget}</span>`;
    if(o.upg) line += `<span class="g g--target">${GICON.wrench}${fmtNum(o.upg[o.upg.length-1])}</span>`;
    line += `</div>`;
    // пороги звёзд (3★ сверху): ★-иконки + порог по метрике (+ 🔧 на старших)
    const rows = [2,1,0].map(i=>{
      const st=i+1;
      const starsHtml=[0,1,2].map(n=>'<span'+(n<st?'':' class="off"')+' style="display:inline-flex">'+SVGIC('star')+'</span>').join('');
      let req = `<span class="req">${primary}${fmtNum(stars[i])}</span>`;
      if(o.upg && o.upg[i]>0) req = `<span class="req">${primary}${fmtNum(stars[i])} <span class="req-upg">${GICON.wrench}${fmtNum(o.upg[i])}</span></span>`;
      return `<div class="row"><span class="stars">${starsHtml}</span>${req}</div>`;
    }).join('');
    return `${head}${line}<div class="thresholds">${rows}</div>`;
  }
  function buildGoalsContent(){
    document.getElementById('goalsKicker')!.textContent = t('goals.kicker');
    document.getElementById('goalsTitle')!.textContent = currentLevelName();
    document.getElementById('goalsBody')!.innerHTML = goalRowsHTML();
  }
  function showGoals(fromPause?: boolean){
    goalsFromPause=!!fromPause;
    paused=true;                       // заморозить симуляцию, пока окно открыто
    buildGoalsContent();
    if(fromPause) document.getElementById('pauseScreen')!.classList.add('hidden');
    document.getElementById('goalsScreen')!.classList.remove('hidden');
  }
  function closeGoals(){
    document.getElementById('goalsScreen')!.classList.add('hidden');
    if(goalsFromPause) document.getElementById('pauseScreen')!.classList.remove('hidden'); // вернуться в паузу
    else paused=false;                 // продолжить игру
    goalsFromPause=false;
  }
  document.getElementById('goalsOk')!.onclick=closeGoals;
  document.getElementById('goalsScreen')!.addEventListener('pointerdown', e=>{ if((e.target as HTMLElement).id==='goalsScreen') closeGoals(); }); // тап мимо карточки

  // ================= ДОСТИЖЕНИЯ / МЕДАЛИ =================
  // Самодостаточный модуль: ловит игровые события через ACH.onX(...), копит
  // прогресс в save.ach (список открытых) и save.stats (накопительные счётчики).
  // Шум ограничен: максимум 2 медали за раунд, всплывашки не чаще раза в минуту
  // (см. RUN_CAP/TOAST_GAP_MS); во всплывашке — название и за что дана.
  // ⏳ pending:true — медали под фичи, которых пока нет (бесконечный режим, Daily) —
  // крючки есть, но в текущих уровнях не срабатывают и не нужны для «Легенды».

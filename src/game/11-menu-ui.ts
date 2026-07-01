// ===== 11-menu-ui — menus & screens (start, level select, biomes, goals, settings, leaderboard, pause), menu icons, save/load & pause wiring =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: showStart, showLevels, showBiomes, showGoals, showLeaderboard, openSettings, buildLevel/Biome/Bonus, startLevel, setPaused, loadGame, saveGame, resetProgress, SVGIC, applyMenuIcons, hideAllScreens, updateStartChips, goalRowsHTML.
// Reads: 04 (LEVELS, LV, curBiome, curBonus, Biome, Bonus); 06 (save, bays, runways, layout, levelIdx/levelKey, survival, debug, SAVE_KEY); 03 (I18N, lang, fmtNum); 09 (heart); 07 (Leaderboard, PERIODS).

  function loadGame(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) || 'null'); if(s&&typeof s==='object'){ save.unlocked=s.unlocked||1; save.best=s.best||{}; save.stars=s.stars||{}; save.lang=(s.lang&&I18N[s.lang as LangCode])?s.lang:null; save.ach=Array.isArray(s.ach)?s.ach:[]; save.stats=(s.stats&&typeof s.stats==='object')?s.stats:{}; save.sound=s.sound!==false; save.vibro=s.vibro!==false; save.eco=!!s.eco; save.tutorialDone=!!s.tutorialDone; } }catch(e){} }
  function saveGame(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} try{ (window as any).PFCloud && (window as any).PFCloud.onLocalSave(); }catch(e){} }
  // язык, медали (ach/stats) и звук/вибро — не прогресс уровней, сохраняем при сбросе
  // сброс прогресса заодно возвращает туториал — новый игрок снова увидит обучение
  function resetProgress(){ save={unlocked:1,best:{},stars:{},lang:save.lang,ach:save.ach||[],stats:save.stats||{},sound:save.sound!==false,vibro:save.vibro!==false,eco:save.eco||false,tutorialDone:false}; saveGame(); renderLevels(); }
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
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    door:'<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    leaf:'<path d="M2 22c4-9 10-14 18-14-4 8-10 13-18 14Z"/><path d="M2 22 12 12"/>',
    battery:'<rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/>',
    sound:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>',
    mute:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    vibro:'<rect x="9" y="7" width="6" height="10" rx="1.5"/><path d="M5 9.5 3 12l2 2.5M19 9.5l2 2.5-2 2.5"/>',
    'vibro-off':'<rect x="9" y="7" width="6" height="10" rx="1.5"/>',
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
  // «Сезон» — отдельная вкладка UI, НЕ входит в PERIODS (тот массив питает ranks/rank-медали
  // в submitRun/onRank — лига сезона намеренно отдельный класс наград, см. season-leagues.md).
  const LB_TABS = PERIODS.concat(['season']);
  function lbEsc(s: any){ const _m: Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}; return String(s==null?'':s).replace(/[&<>"]/g, (c: string)=>_m[c]); }
  function showLeaderboard(){ hideAllScreens(); document.getElementById('leaderboardScreen')!.classList.remove('hidden'); renderLeaderboard(); }
  function renderLeaderboard(){
    const acct = Leaderboard.account.current();
    const tabs = document.getElementById('lbTabs');
    if(tabs){ tabs.innerHTML='';
      LB_TABS.forEach(p=>{ const b=document.createElement('button');
        b.className='m-btn '+(p===lbPeriod?'m-btn--primary':'m-btn--ghost'); b.style.cssText='flex:1;min-width:0;padding:8px 4px';
        b.textContent=t('lb.tab.'+p); b.onclick=()=>{ if(lbPeriod!==p){ lbPeriod=p; renderLeaderboard(); } }; tabs.appendChild(b); });
    }
    const seasonBox = document.getElementById('lbSeason');
    if(seasonBox){
      if(lbPeriod!=='season'){ seasonBox.classList.add('hidden'); seasonBox.innerHTML=''; }
      else {
        seasonBox.classList.remove('hidden'); seasonBox.innerHTML='<div class="muted" style="text-align:center;padding:6px">…</div>';
        Leaderboard.season.standing('survival').then((st: any)=>{
          const div = Leaderboard.season.DIVISIONS[st.divisionIdx], reward = Leaderboard.season.reward();
          seasonBox.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">'+
              '<b>'+lbEsc(t('lb.season.title',{n:st.number}))+'</b>'+
              '<span class="muted">'+lbEsc(t('lb.season.daysLeft',{n:st.daysLeft, unit:t('unit.days',{n:st.daysLeft})}))+'</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;font-size:14px;margin-top:6px">'+
              '<span style="font-size:20px;line-height:1">'+div.ic+'</span>'+
              '<span>'+lbEsc(t('lb.season.div.'+div.id))+'</span>'+
              (st.promoted ? '<span style="color:var(--m-gold)">▲ '+lbEsc(t('lb.season.promoted'))+'</span>' : '') +
              (st.relegated ? '<span class="muted">▼ '+lbEsc(t('lb.season.relegated'))+'</span>' : '') +
              (reward ? '<span title="'+lbEsc(t('lb.season.reward'))+'" style="margin-left:auto;width:14px;height:14px;border-radius:50%;background:'+reward.accent+';box-shadow:0 0 6px '+reward.accent+'"></span>' : '')+
            '</div>';
        }).catch(()=>{ seasonBox.innerHTML=''; });
      }
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
      const info=document.createElement('div');
      info.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;font-size:13px';
      // Вход — по ЖЕСТУ пользователя: на Android это нативный Play Games (через Account.authProvider),
      // на вебе/PWA — mock. Намеренно НЕ входим при старте — авто-вход заставляет Play Games
      // глушить окно согласия ("sign-in timing strategy suppressed").
      let who: HTMLElement;
      if(acct){
        const s=document.createElement('span'); s.className='muted';
        s.textContent=t('lb.signedin')+': '+(acct.name||('Player-'+String(acct.id).slice(-4).toUpperCase()));
        who=s;
      } else {
        const b=document.createElement('button'); b.className='m-btn m-btn--ghost';
        b.style.cssText='padding:6px 12px;font-size:13px'; b.textContent=t('lb.signin');
        b.onclick=()=>{ b.disabled=true; Promise.resolve(Leaderboard.account.signIn()).then(()=>renderLeaderboard()).catch(()=>{ b.disabled=false; }); };
        who=b;
      }
      const bestSpan=document.createElement('span');
      bestSpan.innerHTML=t('lb.yourbest')+': <b>'+(best?fmtNum(best):lbEsc(t('lb.unranked')))+'</b>';
      info.appendChild(who); info.appendChild(bestSpan);
      foot.appendChild(info);
    }
  }

  // «твоё место» на экране Итогов захода Survival. Зовётся из endLevel после submitRun:
  // res = {score, ranks:{alltime,month,week}} (или null, если отправка не удалась). Показывает
  // ранг в каждом срезе медалью/№; если ранга нет (офлайн / нативный Play Games / вне топ-100) —
  // падает на личный рекорд. Тап по виджету открывает полную таблицу.
  function refreshOverLeaderboard(res: any){
    const box=document.getElementById('overRank'); if(!box) return;
    const ranks = res && res.ranks;
    const medal=(r: any)=> r==null ? '—' : (r===1?'🥇':r===2?'🥈':r===3?'🥉':('#'+r));
    const chips = PERIODS.map(p=>{ const r = ranks ? ranks[p] : null;
      return '<span class="over-rank__chip'+(r!=null&&r<=3?' is-top':'')+'">'+
        '<span class="over-rank__k">'+lbEsc(t('lb.tab.'+p))+'</span>'+
        '<span class="over-rank__v">'+medal(r)+'</span></span>'; }).join('');
    const anyRank = !!ranks && PERIODS.some(p=>ranks[p]!=null);
    const best = Leaderboard.bestScore('survival');
    box.classList.remove('hidden');
    box.innerHTML='<div class="over-rank__cap">'+lbEsc(t('over.rankTitle'))+'</div>'+
      '<div class="over-rank__row">'+chips+'</div>'+
      (anyRank ? '' : '<div class="over-rank__note">'+lbEsc(t('lb.yourbest'))+': <b>'+(best?fmtNum(best):lbEsc(t('lb.unranked')))+'</b></div>');
    box.onclick=showLeaderboard;
  }

  function hideAllScreens(){ ['startScreen','levelScreen','biomeScreen','overScreen','pauseScreen','settingsScreen','debugScreen','medalScreen','leaderboardScreen','goalsScreen','confirmScreen','restartConfirmScreen'].forEach(s=>{ const el=document.getElementById(s); if(el) el.classList.add('hidden'); }); }
  // главный экран: чип звёзд = сумма заработанных / максимум по основным уровням
  function updateStartChips(){
    let got=0; for(let i=0;i<LEVELS.length;i++) got+=save.stars[i]||0;
    const v=document.getElementById('startStars'), mx=document.getElementById('startStarsMax');
    if(v) v.textContent=fmtNum(got);
    if(mx) mx.textContent='/'+fmtNum(LEVELS.length*3);
  }
  function showStart(){ inMenu=true; hideAllScreens(); updateStartChips(); document.getElementById('startScreen')!.classList.remove('hidden'); }
  function showLevels(){ inMenu=true; renderLevels(); hideAllScreens(); document.getElementById('levelScreen')!.classList.remove('hidden'); }
  function startLevel(idx: number){ survival=false; buildLevel(idx); hideAllScreens(); reset(); }
  function startBonus(b: Bonus){ if(!bonusUnlocked(b)) return; survival=false; buildBonus(b); hideAllScreens(); reset(); }
  // КАСТОМНЫЙ уровень из конструктора (tuning.html → «Разметка»). Играется инлайново,
  // как бонус: строковый ключ 'custom' → recordResult не двигает прогресс кампании
  // (см. recordResult: unlocked растёт лишь при числовом levelKey). Так «Сыграть черновик»
  // и загрузка экспортированного JSON в игру не портят сейв.
  const CUSTOM_LEVEL_KEY = 'aerovia:customLevel';
  // Уровень из последнего экспорта конструктора (aerovia-tuning.json → ключ "level").
  // Показывается кнопкой «Свой уровень» если в localStorage нет перезаписи.
  // Демо-композиция «по референсу» (2400×1080): апрон + 12 ангаров кольцом (4 сверху /
  // 4 слева / 4 снизу) + 4 широкие ВПП. Живёт в КАСТОМНОМ уровне (кнопка «Свой уровень»),
  // НЕ в кампании. Вид самодостаточен через пер-левел оверрайды в layout (кампанию не
  // трогают): runwayRatio/runwayR — широкие/короткие ВПП; fitRunways — ВПП ровно внутри
  // апрона (нижняя не вылезает на любом телефоне); noHud — чистая композиция без HUD.
  const BUILTIN_CUSTOM_LEVEL: any = {
    pace: 0.35,
    objective: { metric: 'served', stars: [10, 15, 20], target: 20 },
    services: ['repair', 'board', 'fuel'],
    maxUp: 3,
    layout: {
      apron: { x: 0.155, y: 0.17, w: 0.495, h: 0.63 },
      runwayRatio: 2.2, runwayR: 0.85, fitRunways: true, noHud: true,
      // 12 ангаров кольцом, типы чередуются (fuel/board/repair) — по 4 каждого, чтобы
      // борты любой нужды обслуживались (играбельно). Порядок массива: верх→лево→низ.
      hangars: [
        { type: 'fuel',   x: 0.18, y: 0.00 }, { type: 'board',  x: 0.39, y: 0.00 },
        { type: 'repair', x: 0.63, y: 0.00 }, { type: 'fuel',   x: 0.83, y: 0.00 },
        { type: 'board',  x: 0.00, y: 0.175 }, { type: 'repair', x: 0.00, y: 0.38 },
        { type: 'fuel',   x: 0.00, y: 0.60 }, { type: 'board',  x: 0.00, y: 0.81 },
        { type: 'repair', x: 0.18, y: 1.00 }, { type: 'fuel',   x: 0.39, y: 1.00 },
        { type: 'board',  x: 0.63, y: 1.00 }, { type: 'repair', x: 0.83, y: 1.00 },
      ],
      runways: [{ y: 0.16 }, { y: 0.44 }, { y: 0.70 }, { y: 0.95 }],
    },
    startMoney: 59,
    motion: { landBefore: 1.15, landAfter: 0.95, takeoffRoll: 0.8 },
    crashPenalty: 0.41,
    latePenalty: 0.34,
  };
  // привести произвольный JSON (экспорт конструктора) к форме Level с безопасными умолчаниями
  function normalizeCustomLevel(o: any): Level {
    o = (o && typeof o === 'object') ? o : {};
    const src = (o.objective && typeof o.objective === 'object') ? o.objective : {};
    const obj: Objective = (Array.isArray(src.stars) && src.stars.length === 3)
      ? { metric: (src.metric === 'upgrades' ? 'upgrades' : 'served') as Objective['metric'],
          stars: src.stars.map((n: any) => Math.max(1, +n || 1)) }
      : { metric: 'served' as Objective['metric'], stars: [6, 8, 10] };
    // лимит времени / гонка и опц. пер-тир условия звёзд из конструктора (tuning.html)
    if (typeof src.time === 'number') obj.time = src.time;
    if (src.race === true) obj.race = true;
    (['upg', 'money', 'lives', 'timeTier', 'maxLate', 'maxCrash'] as const).forEach(k => {
      if (Array.isArray(src[k])) obj[k] = src[k].map((n: any) => +n || 0);
    });
    const lv: Level = { objective: obj };
    if (typeof o.pace === 'number') lv.pace = Math.max(0, Math.min(1, o.pace));
    if (Array.isArray(o.services)) lv.services = o.services.slice();
    if (typeof o.maxUp === 'number') lv.maxUp = o.maxUp;
    if (typeof o.minUp === 'number') lv.minUp = o.minUp;
    if (o.layout && typeof o.layout === 'object') lv.layout = o.layout;
    else if (o.sides) lv.sides = o.sides;
    if (typeof o.runways === 'number') lv.runways = o.runways;
    if (o.events && typeof o.events === 'object') lv.events = o.events;
    if (typeof o.startMoney === 'number') lv.startMoney = o.startMoney;
    if (typeof o.crashPenalty === 'number') lv.crashPenalty = o.crashPenalty;
    if (typeof o.latePenalty === 'number') lv.latePenalty = o.latePenalty;
    // среда/сложность: погода, деайсинг, «спокойствие» воздуха — чтобы тестовая
    // игра отражала ВСЕ настройки вкладки «Сложность», а не только геометрию.
    if (o.weather === true) lv.weather = true;
    if (o.deice === true) lv.deice = true;
    if (typeof o.calm === 'number') lv.calm = o.calm;
    // фазовые множители скорости на ВПП (конструктор): берём только числовые ключи,
    // зажимаем в 0.1..3; пустой блок не записываем (движение читает motion?.x ?? 1).
    if (o.motion && typeof o.motion === 'object') {
      const m: NonNullable<Level['motion']> = {};
      (['landBefore', 'landAfter', 'takeoffRoll', 'climb'] as const).forEach(k => {
        const v = o.motion[k];
        if (typeof v === 'number' && isFinite(v)) m[k] = Math.max(0.1, Math.min(3, v));
      });
      if (Object.keys(m).length) lv.motion = m;
    }
    return lv;
  }
  function startCustomLevel(o: any){ survival=false; curBiome=null; curBonus=null; levelIdx=-1; levelKey='custom'; LV=normalizeCustomLevel(o); bays=[]; runways=[]; layout(); hideAllScreens(); reset(); }
  // прочитать сохранённый кастомный уровень (его пишет конструктор «Отправить в игру»)
  function readStoredCustomLevel(): any { try{ const s=localStorage.getItem(CUSTOM_LEVEL_KEY); return s ? JSON.parse(s) : null; }catch(e){ return null; } }
  // карты-биомы = режим SURVIVAL: отдельный экран выбора (из главного меню). Survival живёт
  // ИМЕННО на картах — бесконечный заход с жизнями, счёт = обслуженные борта; на конце (потеря
  // всех жизней) счёт уходит в глобальный рейтинг (см. endLevel → Leaderboard). Интенсивность
  // нарастает со временем (survivalPace); карты различаются своим pace/survRamp и помехами.
  function showBiomes(){ inMenu=true; renderBiomes(); hideAllScreens(); document.getElementById('biomeScreen')!.classList.remove('hidden'); }
  function startBiome(b: Biome){ if(!b.ready) return; survival=true; buildBiome(b); hideAllScreens(); reset(); }
  function renderBiomes(){
    const list=document.getElementById('biomeList')!; list.innerHTML='';
    const tot=document.getElementById('biomeTotal');
    if(tot) tot.innerHTML=SVGIC('plane')+` <b>${fmtNum(save.stats.survivalTotal||0)}</b> <span class="unit">${t('biomes.total')}</span>`;
    const grid=document.createElement('div'); grid.className='biome-grid';
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
      grid.appendChild(card);
    });
    list.appendChild(grid);
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
  // карта уровней (дизайн-система v2): вертикальная 6-колоночная сетка
  // (5 уровней + 1 бонус в ряду), стиль «Заливка». Данные те же (LEVELS,
  // save.stars, save.unlocked, bonusAfter/bonusUnlocked) — меняется только облик.
  function renderLevels(){
    // Счётчик звёзд в заголовке
    let got=0; for(let i=0;i<LEVELS.length;i++) got+=save.stars[i]||0;
    const sc=document.getElementById('starCount');
    if(sc) sc.innerHTML=SVGIC('star')+
      ` <b>${got}</b> <span class="muted">/ ${LEVELS.length*3}</span>` +
      ` <span class="unit">${t('levels.stars')}</span>`;

    const host=document.getElementById('levelList')!;
    const grid=document.createElement('div');
    grid.className='lvlgrid';
    const feats=levelFeatures();

    LEVELS.forEach((lv,i)=>{
      const unlocked=debug.unlockAll||i<save.unlocked;
      const stars=save.stars[i]||0;
      const isCur=(i+1===save.unlocked)&&!debug.unlockAll;
      const st=unlocked?(isCur?'ac':'dn'):'lk';

      // Иконка механики (только первое появление)
      const feat=feats[i];
      const featHtml=feat&&unlocked
        ? `<span class="lvlcard__feat">${FEATURE_META[feat[0]]?.icon||'?'}</span>` : '';
      const playHtml=isCur?'<span class="lvlcard__play">▶</span>':'';

      // Звёзды (top-right) или замок
      const starsHtml=unlocked
        ? `<div class="lvlcard__stars">${[0,1,2].map(j=>starSvg(j<stars)).join('')}</div>`
        : `<div class="lvlcard__lock">${SVGIC('lock')}</div>`;

      const el=document.createElement('div');
      el.className=`lvlcard lvlcard--${st}${!unlocked?' lvlcard--lk-body':''}`;
      el.dataset.lvl=String(i+1);   // для индикатора «ур.N» в скроллбаре
      el.innerHTML=`<div class="lvlcard__inner">
        <div class="lvlcard__top">
          <div class="lvlcard__left">
            <span class="lvlcard__num">${String(i+1).padStart(2,'0')}</span>
            ${featHtml}${playHtml}</div>${starsHtml}</div>
        <div class="lvlcard__nm">${levelName(i)}</div>
      </div>`;
      el.setAttribute('aria-label', levelName(i)+(unlocked?'':' — '+t('levels.locked')));
      if(unlocked) el.onclick=()=>startLevel(i);
      grid.appendChild(el);

      // Бонус-ячейка после каждого 5-го уровня
      const bn=bonusAfter(i+1);
      if(bn){
        const unl=bonusUnlocked(bn);
        const bel=document.createElement('div');
        bel.className='lvlcard lvlcard--bonus'+(unl?'':' lvlcard--bns-locked');
        bel.title=unl
          ? bonusName(bn)+(bn.emoji?' '+bn.emoji:'')
          : t('bonus.req',{n:bn.after});
        bel.innerHTML=`<div class="lvlcard__bns">
          <div class="lvlcard__bns-emoji">${bn.emoji||'★'}</div>
          <div class="lvlcard__bns-name">${bonusName(bn)}</div>
          ${unl
            ? '<span class="lvlcard__bns-cta">✨</span>'
            : `<span class="lvlcard__bns-lock">${t('bonus.req',{n:bn.after})}</span>`}
        </div>`;
        if(unl) bel.onclick=()=>startBonus(bn);
        grid.appendChild(bel);
      } else if((i+1)%5===0){
        // Плейсхолдер для будущих бонусов
        const bel=document.createElement('div');
        bel.className='lvlcard lvlcard--bonus lvlcard--future';
        bel.innerHTML='<div class="lvlcard__bns">' +
          '<div class="lvlcard__bns-emoji">🔮</div>' +
          `<div class="lvlcard__bns-name">${t('levels.bonusSoon')}</div>` +
          '</div>';
        grid.appendChild(bel);
      }
    });

    host.innerHTML='';
    host.appendChild(grid);
    // Прокрутить к текущему уровню + обновить кастомный скроллбар
    setTimeout(()=>{
      const cur=grid.querySelector('.lvlcard--ac') as HTMLElement|null;
      if(cur&&host) host.scrollTop=Math.max(0,cur.offsetTop-80);
      lvScrollUpd?.();
    },60);
  }

  // Кастомный скроллбар списка уровней (нативный скрыт в CSS): тонкая полоса
  // справа — тап по треку прыгает, перетаскивание ползунка скроллит. Слушатели
  // вешаются один раз; renderLevels дёргает lvScrollUpd() после перерисовки.
  let lvScrollUpd:(()=>void)|null=null;
  function initLvScrollbar(){
    const mg=document.getElementById('levelList'),
          track=document.getElementById('lvScrollTrack'),
          thumb=document.getElementById('lvScrollThumb'),
          totEl=document.getElementById('lvScrollTot'),
          posEl=document.getElementById('lvScrollPos');
    if(!mg||!track||!thumb) return;
    if(totEl) totEl.textContent=String(LEVELS.length);   // всего уровней (динамически)
    const upd=()=>{
      const{scrollTop:st,scrollHeight:sh,clientHeight:ch}=mg;
      const trackH=track.offsetHeight, max=sh-ch;
      if(sh<=ch){ thumb.style.opacity='0'; }
      else {
        thumb.style.opacity='1';
        const thH=Math.max(18, ch/sh*trackH);
        thumb.style.height=thH+'px';
        thumb.style.top=(max>0? st/max*(trackH-thH) : 0)+'px';
      }
      // «ур.N» — первый (хотя бы частично) видимый уровень по data-lvl карточек
      if(posEl){
        const listTop=mg.getBoundingClientRect().top; let cur=1;
        const cards=mg.querySelectorAll('.lvlcard[data-lvl]');
        for(let i=0;i<cards.length;i++){ const c=cards[i] as HTMLElement;
          if(c.getBoundingClientRect().bottom>listTop+2){ cur=+(c.dataset.lvl||'1'); break; } }
        posEl.textContent='ур.'+cur;
      }
    };
    lvScrollUpd=upd;
    mg.addEventListener('scroll',upd);
    track.addEventListener('pointerdown',e=>{
      if(e.target===thumb){ // перетаскивание ползунка
        e.preventDefault();
        try{ thumb.setPointerCapture(e.pointerId); }catch{}
        const y0=e.clientY, s0=mg.scrollTop, max=mg.scrollHeight-mg.clientHeight;
        const k=(track.offsetHeight-thumb.offsetHeight)/(max||1);
        const mv=(ev:PointerEvent)=>{ mg.scrollTop=Math.max(0,Math.min(max,s0+(ev.clientY-y0)/(k||1))); upd(); };
        const up=()=>{ thumb.removeEventListener('pointermove',mv); thumb.removeEventListener('pointerup',up); };
        thumb.addEventListener('pointermove',mv);
        thumb.addEventListener('pointerup',up);
        return;
      }
      // тап по треку — прыжок к позиции
      const r=track.getBoundingClientRect(), max=mg.scrollHeight-mg.clientHeight;
      mg.scrollTop=Math.max(0,Math.min(max,((e.clientY-r.top)/r.height)*max));
      upd();
    });
    setTimeout(upd,80);
  }
  initLvScrollbar();

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
  document.getElementById('againBtn')!.onclick=()=>{ document.getElementById('againConfirmScreen')!.classList.remove('hidden'); };
  document.getElementById('againCancelBtn')!.onclick=()=>{ document.getElementById('againConfirmScreen')!.classList.add('hidden'); };
  document.getElementById('againConfirmBtn')!.onclick=()=>{
    document.getElementById('againConfirmScreen')!.classList.add('hidden');
    document.getElementById('overScreen')!.classList.add('hidden');
    reset();
  };
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
    document.getElementById('pauseGoals')!.innerHTML = goalRowsHTML(t('pause.objective'));
  }
  document.getElementById('resumeBtn')!.onclick=()=>setPaused(false);
  document.getElementById('restartBtn')!.onclick=()=>{
    document.getElementById('pauseScreen')!.classList.add('hidden');
    document.getElementById('restartConfirmScreen')!.classList.remove('hidden');
  };
  document.getElementById('restartCancelBtn')!.onclick=()=>{
    document.getElementById('restartConfirmScreen')!.classList.add('hidden');
    document.getElementById('pauseScreen')!.classList.remove('hidden');
  };
  document.getElementById('restartConfirmBtn')!.onclick=()=>{
    document.getElementById('restartConfirmScreen')!.classList.add('hidden');
    reset();
  };
  document.getElementById('pauseLevelsBtn')!.onclick=()=>{
    recordResult(); running=false; paused=false; ACH.flushToasts(); backToSelect();
  };
  document.getElementById('menuBtn')!.onclick=()=>{
    recordResult(); running=false; paused=false; ACH.flushToasts(); showStart();
  };
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && running && !paused) setPaused(true);
  });
  document.getElementById('optLives')!.onchange=e=>{ debug.infiniteLives=(e.target as HTMLInputElement).checked; saveDebug(); };
  document.getElementById('optMoney')!.onchange=e=>{ debug.richStart=(e.target as HTMLInputElement).checked; if(debug.richStart) money=BIG_MONEY; saveDebug(); };
  document.getElementById('optUnlockAll')!.onchange=e=>{ debug.unlockAll=(e.target as HTMLInputElement).checked; saveDebug(); renderLevels(); };
  document.getElementById('optProfiler')!.onchange=e=>{ debug.profiler=(e.target as HTMLInputElement).checked; saveDebug(); };
  // иконка Debug в настройках открывает отдельный экран отладки
  { const btn=document.getElementById('debugToggleBtn');
    if(btn) btn.onclick=()=>{ syncDebugUI(); hideAllScreens(); document.getElementById('debugScreen')?.classList.remove('hidden'); }; }
  { const btn=document.getElementById('debugBackBtn');
    if(btn) btn.onclick=()=>{ document.getElementById('debugScreen')?.classList.add('hidden'); openSettings(); }; }
  document.getElementById('langFlagBtn')!.onclick=()=>{
    const codes=Object.keys(I18N); const i=codes.indexOf(lang);
    setLang(codes[(i+1)%codes.length]);
  };
  // звук/вибро — иконки-кнопки в экране «Настройки», меняют SVG и класс при переключении
  function syncSettingsUI(){
    function applyIconBtn(id: string, on: boolean, iconOn: string, iconOff: string){
      const btn=document.getElementById(id); if(!btn) return;
      const ic=btn.querySelector<HTMLElement>('.mic'); if(!ic) return;
      const key=on?iconOn:iconOff; ic.dataset.mic=key; ic.innerHTML=SVGIC(key);
      btn.classList.toggle('icon-btn--off', !on);
    }
    applyIconBtn('optSoundBtn', save.sound!==false, 'sound', 'mute');
    applyIconBtn('optVibroBtn', save.vibro!==false, 'vibro', 'vibro-off');
    applyIconBtn('optEcoBtn', !!save.eco, 'battery', 'battery');
    const hint=document.getElementById('ecoSlowHint');
    if(hint){ hint.textContent=t('settings.ecoSlow'); hint.classList.toggle('hidden', !_slowDevice); }
  }
  function setSound(on: boolean){ save.sound=on; saveGame(); SND.setEnabled(on); syncSettingsUI(); Analytics.track('setting_changed', {key:'sound', value:!!on}); }
  function setVibro(on: boolean){ save.vibro=on; saveGame(); HAP.on=on; syncSettingsUI(); Analytics.track('setting_changed', {key:'vibro', value:!!on}); }
  function setEco(on: boolean){ save.eco=on; saveGame(); syncSettingsUI(); Analytics.track('setting_changed', {key:'eco', value:!!on}); }
  { const b=document.getElementById('optSoundBtn'); if(b) b.onclick=()=>setSound(!(save.sound!==false)); }
  { const b=document.getElementById('optVibroBtn'); if(b) b.onclick=()=>setVibro(!(save.vibro!==false)); }
  { const b=document.getElementById('optEcoBtn'); if(b) b.onclick=()=>setEco(!save.eco); }

  // настройки из стартового меню (звук / язык / сброс прогресса)
  function openSettings(){ inMenu=true; syncSettingsUI(); renderLangBtns();
    hideAllScreens();
    document.getElementById('settingsScreen')!.classList.remove('hidden'); }
  document.getElementById('settingsMenuBtn')!.onclick=openSettings;
  document.getElementById('settingsBackBtn')!.onclick=()=>{ showStart(); };

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
  // label — метка шапки таблицы: «Цель» (пауза) / «Цели» (окно целей).
  function goalRowsHTML(label?: string){
    const lbl = label || t('pause.objective');
    // одна подсказка-строка по центру (между заголовком и таблицей)
    let hint = '';
    if(survival)      hint = LV.biome ? t('biome.'+LV.biome+'.hint') : t('goals.survival');
    else if(LV.biome) hint = t('biome.'+LV.biome+'.hint');
    else if(LV.bonus) hint = objectiveDesc();
    else { const hk='level.h.'+(levelIdx+1); hint = hasI18n(hk) ? t(hk) : objectiveDesc(); }
    const hintHtml = hint ? `<p class="m-subtitle goal-hint">${hint}</p>` : '';
    // основная метрика: гусеница (луг бабочек) · 🔧 (апгрейды) · ⏱ (survival) · ✈ (иначе)
    const metric = LV.objective.metric;
    const primary = LV.bonus==='butterfly' ? GICON.caterpillar
                  : (!survival && metric==='upgrades') ? GICON.wrench
                  : (!survival && metric==='survival') ? GICON.clock : GICON.plane;
    // порог основной метрики: survival — это секунды (⏱ mm:ss), иначе число
    const fmtThr = (n: number)=> metric==='survival' ? fmtTime(n||0) : fmtNum(n);
    let timeStr: string, headTarget: string, rows = '';
    if(survival){
      timeStr = INF; headTarget = fmtNum(save.best[levelKey]||0);
    } else {
      const o = LV.objective, stars = o.stars || [o.target, o.target, o.target];
      timeStr = o.time ? fmtTime(o.time) : INF;
      headTarget = o.race ? INF : (metric==='survival' ? fmtTime(o.target ?? 0) : fmtNum(o.target ?? 0));
      // доп-условия тира i → компактные чипы (как ✈ + 🔧 на L3, плюс деньги/жизни/время/чистота)
      const chips = (i: number)=>{
        let c = '';
        if(o.upg      && o.upg[i]>0)        c += `<span class="req-upg">${GICON.wrench}${fmtNum(o.upg[i])}</span>`;
        if(o.money    && o.money[i]>0)      c += `<span class="req-upg">💰${fmtNum(o.money[i])}</span>`;
        if(o.lives    && o.lives[i]>0)      c += `<span class="req-upg">♥${fmtNum(o.lives[i])}</span>`;
        if(o.timeTier && o.timeTier[i]>0)   c += `<span class="req-upg">${GICON.clock}${fmtTime(o.timeTier[i])}</span>`;
        if(o.maxLate  && o.maxLate[i]!=null)  c += `<span class="req-upg">⌛≤${fmtNum(o.maxLate[i])}</span>`;
        if(o.maxCrash && o.maxCrash[i]!=null) c += `<span class="req-upg">💥≤${fmtNum(o.maxCrash[i])}</span>`;
        return c;
      };
      rows = [2,1,0].map(i=>{
        const st=i+1;
        const starsHtml=[0,1,2].map(n=>'<span'+(n<st?'':' class="off"')+' style="display:inline-flex">'+SVGIC('star')+'</span>').join('');
        const req = `<span class="req">${primary}<span class="thr-num">${fmtThr(stars[i])}</span> ${chips(i)}</span>`;
        return `<div class="row"><span class="stars">${starsHtml}</span>${req}</div>`;
      }).join('');
    }
    // шапка: метка слева · ⏱ время/∞ по центру · ✈ цель справа (крупнее строк)
    const head = `<div class="thr-head">`+
      `<span class="thr-lbl">${lbl}</span>`+
      `<span class="thr-time">${GICON.clock}<span class="thr-num">${timeStr}</span></span>`+
      `<span class="thr-plane">${primary}<span class="thr-num">${headTarget}</span></span>`+
      `</div>`;
    return `${hintHtml}<div class="thresholds">${head}${rows}</div>`;
  }
  function buildGoalsContent(){
    document.getElementById('goalsTitle')!.textContent = currentLevelName();
    document.getElementById('goalsBody')!.innerHTML = goalRowsHTML(t('goals.objective'));
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
  // «домой» из окна целей: закрыть окно и выйти в выбор уровней/карт
  { const b=document.getElementById('goalsHomeBtn');
    if(b) b.onclick=()=>{ document.getElementById('goalsScreen')!.classList.add('hidden'); goalsFromPause=false; running=false; paused=false; backToSelect(); }; }
  document.getElementById('goalsScreen')!.addEventListener('pointerdown', e=>{ if(!(e.target as HTMLElement).closest('.panel')) closeGoals(); }); // тап мимо карточки

  // ================= ДОСТИЖЕНИЯ / МЕДАЛИ =================
  // Самодостаточный модуль: ловит игровые события через ACH.onX(...), копит
  // прогресс в save.ach (список открытых) и save.stats (накопительные счётчики).
  // Шум ограничен: максимум 2 медали за раунд, всплывашки не чаще раза в минуту
  // (см. RUN_CAP/TOAST_GAP_MS); во всплывашке — название и за что дана.
  // ⏳ pending:true — медали под фичи, которых пока нет (бесконечный режим, Daily) —
  // крючки есть, но в текущих уровнях не срабатывают и не нужны для «Легенды».

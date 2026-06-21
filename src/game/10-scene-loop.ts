// ===== 10-scene-loop — the rAF loop (frame), scene dispatch, level-end, menu/share/timeline renderers & the neon main-screen landing animation (_q*) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: frame, endLevel, drawMenuScene, drawMenuLanding, drawTimeline, drawShareCard.
// Reads: 01 (cv, ctx); 08b (update); 08 (computeStars, metricValue, recordResult); 09 (drawField, drawRunways, drawForest, starfield, vignette…); 09b (drawBay, drawPlane, drawHUD, drawEffects, drawFloaters, drawToast, drawTutorial); 06 (state); 04 (K, LV, LEVELS, levelName, objectiveDesc); 03 (t, fmt*); 07 (Analytics, Leaderboard); 12 (ACH); 11 (SVGIC).

  const _qss=(a: number,b: number,x: number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const _qlerp=(a: number,b: number,t: number)=>a+(b-a)*t;
  const _qcub=(a: number,b: number,c: number,d: number,t: number)=>{const m=1-t;return m*m*m*a+3*m*m*t*b+3*m*t*t*c+t*t*t*d;};
  function _qbez(P: number[][],n: number){const o=[];for(let i=0;i<n;i++){const t=i/n;o.push([_qcub(P[0][0],P[1][0],P[2][0],P[3][0],t),_qcub(P[0][1],P[1][1],P[2][1],P[3][1],t)]);}return o;}
  function _qdep(ty: string,x1: number,y: number){if(ty==='leftClimb')return[[x1,y],[x1-150,y-10],[10,y-150],[-120,y-215]];if(ty==='down')return[[x1,y],[x1-130,y+8],[70,y+90],[150,520]];return[[x1,y],[x1-160,y],[-10,y-26],[-120,y-36]];}
  const _QAN=200,_QRN=170,_QDN=250;
  const _QCFG={rw:{y:368,x0:486,x1:128},boxes:[{x:360,kind:'fuel'},{x:232,kind:'gate'}],exit:'leftClimb',period:9500,cruiseV:1,groundV:0.5};
  let _qpath: any=null;
  function _qbuild(cfg: any){
    const y=cfg.rw.y,x0=cfg.rw.x0,x1=cfg.rw.x1;
    const approach=_qbez([[1030,356],[770,356],[x0+130,y],[x0,y]],_QAN);
    const runway=[];for(let i=0;i<=_QRN;i++)runway.push([_qlerp(x0,x1,i/_QRN),y]);
    const dd=_qdep(cfg.exit,x1,y);const dep=_qbez(dd,_QDN);dep.push(dd[3]);
    const samples=approach.concat(runway.slice(1),dep.slice(1));
    const N=samples.length;const cum=[0];let L=0;
    for(let i=1;i<N;i++){L+=Math.hypot(samples[i][0]-samples[i-1][0],samples[i][1]-samples[i-1][1]);cum.push(L);}
    const fOfS=cum.map(cc=>cc/L);
    const iRwStart=_QAN-1,iRwEnd=_QAN-1+_QRN;
    const rwStartF=fOfS[iRwStart],rwEndF=fOfS[iRwEnd];
    const boxes=cfg.boxes.map((bx: any)=>{const i=iRwStart+Math.round((x0-bx.x)/(x0-x1)*_QRN);return{x:samples[i][0],y:y,kind:bx.kind,sf:fOfS[Math.max(iRwStart,Math.min(i,iRwEnd))]};});
    const stSf=boxes.map((bb: any)=>bb.sf);const sh=0.03;
    const vf=samples.map((p,i)=>{const f=fOfS[i];const ground=_qss(rwStartF-sh,rwStartF+sh,f)*(1-_qss(rwEndF-sh,rwEndF+sh,f));let v=_qlerp(cfg.cruiseV||1,cfg.groundV||0.5,ground);for(const sf of stSf)v*=1-0.82*Math.exp(-Math.pow((f-sf)/0.011,2));return Math.max(v,0.06);});
    const tcum=[0];let T=0;for(let i=1;i<N;i++){T+=(cum[i]-cum[i-1])/vf[i];tcum.push(T);}
    const M=1024,fOf=new Array(M+1);let si=0;
    for(let j=0;j<=M;j++){const tt=(j/M)*T;while(si<N-1&&tcum[si+1]<tt)si++;const t0=tcum[si],t1=(tcum[si+1]!=null?tcum[si+1]:t0),a=t1>t0?(tt-t0)/(t1-t0):0;fOf[j]=_qlerp(fOfS[si],fOfS[Math.min(si+1,N-1)],a);}
    const fb=boxes.find((bb: any)=>bb.kind==='fuel')||boxes[0];const gb=boxes.find((bb: any)=>bb.kind==='gate')||boxes[boxes.length-1];
    return{samples:samples,fOfS:fOfS,fOf:fOf,M:M,x0:x0,x1:x1,y:y,boxes:boxes,fuelSf:fb.sf,gateSf:gb.sf};
  }
  function _qsample(b: any,f: number){const fa=b.fOfS,s=b.samples,N=s.length;let lo=0,hi=N-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(fa[mid]<=f)lo=mid;else hi=mid-1;}const i=Math.min(lo,N-2),f0=fa[i],f1=fa[i+1],a=f1>f0?(f-f0)/(f1-f0):0;const A=s[i],B=s[i+1];return{x:A[0]+(B[0]-A[0])*a,y:A[1]+(B[1]-A[1])*a,ang:Math.atan2(B[1]-A[1],B[0]-A[0])};}
  function _qbox(cx: number,cy: number,kind: string,scale: number){
    const fuel=kind==='fuel',color=fuel?'#ffc14d':'#22e3c6';
    const sz=32*scale,r=9*scale;
    ctx.save();ctx.translate(cx,cy);
    ctx.shadowColor=color;ctx.shadowBlur=13*scale;ctx.fillStyle='#0c1838';
    ctx.beginPath();ctx.roundRect(-sz/2,-sz/2,sz,sz,r);ctx.fill();ctx.shadowBlur=0;
    ctx.lineWidth=1.6*scale;ctx.strokeStyle=color;ctx.beginPath();ctx.roundRect(-sz/2,-sz/2,sz,sz,r);ctx.stroke();
    ctx.fillStyle=color;ctx.strokeStyle=color;
    if(fuel){const g=7.5*scale;ctx.beginPath();ctx.moveTo(0,-g);ctx.bezierCurveTo(g*0.95,-g*0.05,g*0.78,g*0.95,0,g);ctx.bezierCurveTo(-g*0.78,g*0.95,-g*0.95,-g*0.05,0,-g);ctx.fill();}
    else{ctx.lineWidth=2.1*scale;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.arc(0,-4*scale,3.1*scale,0,7);ctx.stroke();ctx.beginPath();ctx.arc(0,9.5*scale,6.4*scale,Math.PI*1.18,Math.PI*1.82);ctx.stroke();}
    ctx.restore();
  }
  function drawMenuLanding(tm: number){
    if(!_qpath)_qpath=_qbuild(_QCFG);
    const b=_qpath;
    const S=W/960,offY=H-444*S;
    const MX=function(lx: number){return lx*S;},MY=function(ly: number){return offY+ly*S;};
    const HOLD=0.9,period=_QCFG.period,tail=0.0040,QTRAIL=32;
    const pr=(tm%period)/period,pa=pr/HOLD;
    let f;if(pa>=1)f=1;else{const fi=pa*b.M,j=Math.floor(fi);f=_qlerp(b.fOf[j],b.fOf[Math.min(j+1,b.M)],fi-j);}
    const s0=_qsample(b,f);
    const offscr=s0.x<-34||s0.x>994||s0.y<-34||s0.y>478||pa>=1;
    ctx.save();ctx.lineCap='round';
    ctx.globalAlpha=0.16;ctx.strokeStyle='#22e3c6';ctx.lineWidth=26*S;
    ctx.beginPath();ctx.moveTo(MX(b.x0),MY(b.y));ctx.lineTo(MX(b.x1),MY(b.y));ctx.stroke();
    ctx.globalAlpha=1;ctx.strokeStyle='rgba(234,255,255,0.42)';ctx.lineWidth=2*S;ctx.setLineDash([14*S,14*S]);
    ctx.beginPath();ctx.moveTo(MX(b.x0),MY(b.y));ctx.lineTo(MX(b.x1),MY(b.y));ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
    ctx.save();ctx.fillStyle='#3ad2ff';ctx.shadowColor='#3ad2ff';
    for(let k=0;k<QTRAIL;k++){const ff=f-(k+1)*tail;if(ff<0||pa>=1)continue;const sp=_qsample(b,ff),q=1-k/QTRAIL;ctx.globalAlpha=Math.pow(q,1.6)*0.85;ctx.shadowBlur=7*S;ctx.beginPath();ctx.arc(MX(sp.x),MY(sp.y),(1.6+2.4*q)*S,0,7);ctx.fill();}
    ctx.restore();
    const occl=Math.max(0,...b.boxes.map((bx: any)=>Math.exp(-Math.pow((f-bx.sf)/0.009,2))));
    if(!offscr){ctx.save();ctx.globalAlpha=Math.max(0,1-0.92*occl);(drawPlaneBodyAt as any)(MX(s0.x),MY(s0.y),s0.ang,S,false,false);ctx.restore();}
    for(const bx of b.boxes){const act=pa>=1?0:Math.exp(-Math.pow((f-bx.sf)/0.02,2));_qbox(MX(bx.x),MY(bx.y),bx.kind,(1+0.2*act)*S);}
  }
function drawMenuScene(tm: number){
    // фон: радиальный градиент COL.core→tarmac→ink (как CSS --m-board) — вместо плоской заливки COL.ink («плоское тёмное»)
    const bx=W*0.5, by=H*0.46, brad=Math.max(W,H)*0.8;
    const bgGrad=ctx.createRadialGradient(bx,by,0, bx,by,brad);
    bgGrad.addColorStop(0,COL.core); bgGrad.addColorStop(0.5,COL.tarmac); bgGrad.addColorStop(1,COL.ink);
    ctx.fillStyle=bgGrad; ctx.fillRect(0,0,W,H);
    // «дышащее» ядро-свечение в центре (циан, ~120px, период 6s)
    const corePulse=0.5+0.5*Math.sin(tm*Math.PI*2/6000);
    const coreGlow=ctx.createRadialGradient(bx,by,0, bx,by,120);
    coreGlow.addColorStop(0,hexa(COL.phosphor,0.10+0.10*corePulse)); coreGlow.addColorStop(1,hexa(COL.phosphor,0));
    ctx.fillStyle=coreGlow; ctx.fillRect(0,0,W,H);
    // тонкая неон-сетка 54px
    ctx.strokeStyle=hexa(COL.phosphor,.05); ctx.lineWidth=1; ctx.beginPath();
    for(let gx=0;gx<=W;gx+=54){ ctx.moveTo(gx,0); ctx.lineTo(gx,H); }
    for(let gy=0;gy<=H;gy+=54){ ctx.moveTo(0,gy); ctx.lineTo(W,gy); }
    ctx.stroke();
    starfield(tm);
    const rx=W*0.5, ry=H*0.52, R=Math.min(W,H)*0.42;   // центр кадра (как RadarBg 50%/52%)
    ctx.save(); ctx.translate(rx,ry);
    for(let i=1;i<=4;i++){ ctx.beginPath(); ctx.arc(0,0,R*i/4,0,7);
      ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.phosphor,.08+i*0.01); ctx.stroke(); }
    // крест через центр кадра (как RadarBg: горизонталь + вертикаль), вместо 8 радиальных спиц
    ctx.strokeStyle=hexa(COL.phosphor,.10); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-rx,0); ctx.lineTo(W-rx,0);
                     ctx.moveTo(0,-ry); ctx.lineTo(0,H-ry); ctx.stroke();
    ctx.save(); ctx.rotate(tm*0.0013);
    const grad=ctx.createLinearGradient(0,0,R,0);
    grad.addColorStop(0,hexa(COL.phosphor,.28)); grad.addColorStop(1,hexa(COL.phosphor,0));
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R,-0.5,0); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill(); ctx.restore();
    [[0.55,1.1],[0.8,3.0],[0.35,4.6],[0.62,5.6]].forEach((b2,i)=>{
      const x=Math.cos(b2[1])*R*b2[0], y=Math.sin(b2[1])*R*b2[0];
      const f=0.4+0.6*Math.abs(Math.sin(tm*0.002+i));
      ctx.fillStyle=hexa(COL.phosphor,f); ctx.beginPath(); ctx.arc(x,y,2.5,0,7); ctx.fill();
    });
    ctx.restore();
    // бирюзовое свечение горизонта
    const hg=ctx.createLinearGradient(0,H-120*ui,0,H);
    hg.addColorStop(0,'rgba(16,48,58,0)'); hg.addColorStop(1,hexa(COL.teal,.10));
    ctx.fillStyle=hg; ctx.fillRect(0,H-120*ui,W,120*ui);
    drawMenuLanding(tm);
    vignette();
  }

  function frame(ts: number){
    if(!lastTs)lastTs=ts;
    let dt=(ts-lastTs)/1000; lastTs=ts;
    if(dt>0.05)dt=0.05;
    nowT=ts;
    // лёгкое замедление времени на миг near-miss (таймер идёт в реальном
    // времени, замедляется только симуляция — вспышки/всплывашки тикают как обычно)
    let udt = dt;
    if(slowmo>0){ slowmo=Math.max(0, slowmo-dt); udt = dt*K.SLOWMO_SCALE; }
    if(running && !paused) update(udt);

    if(inMenu){
      drawMenuScene(ts);
    } else {
      drawField(ts);
      drawRunways(ts);
      if(LV.biome) drawForest(ts);
      bays.forEach(drawBay);
      planes.forEach(p=>{ if(!p.dead) drawPlane(p); });
      drawEffects(dt);
      vignette();
      drawFloaters(dt);
      drawHUD();
      if(tut) drawTutorial();
      if(toast){ toast.t+=dt; if(toast.t>2.4) toast=null; else drawToast(); }
    }
    requestAnimationFrame(frame);
  }

  function endLevel(reasonKey: string){          // reasonKey — ключ i18n (end.*)
    running=false; const prevBest = save.best[levelKey]||0; recordResult();
    const stars=computeStars(), v=metricValue(), passed=stars>=1;
    Analytics.track(passed ? 'level_complete' : 'level_fail', {
      level: levelKey,
      mode: currentMode(),
      reason: reasonKey, stars,
      metric: LV.objective && LV.objective.metric, value: v, target: LV.objective && LV.objective.target,
      money, peak: statPeak, time_s: Math.round(gameTime), lives: Math.max(0, lives),
    });
    ACH.onLevelEnd(passed, stars, lives>=K.START_LIVES);
    // Survival → счёт захода (обслуженные борта) уходит в глобальный рейтинг; место в
    // таблице открывает пороговые ранг-медали. Каркас: mock-провайдер сейчас, бэкенд потом.
    // Не-survival режимы рейтинг не трогают (кампания/бонусы остаются как есть).
    if(currentMode()==='survival'){
      const runScore = served;
      Leaderboard.submitRun({mode:'survival', score:runScore}).then(res=>{
        lastShift.survivalScore = runScore;
        if(res){ lastShift.ranks = res.ranks; ACH.onRank(res.ranks); }
        refreshOverLeaderboard(res);                 // «твоё место» — место в мире
      }).catch(()=>{ refreshOverLeaderboard(null); }); // submit упал → виджет показывает личный рекорд, не зависает на «…»
    }
    document.getElementById('overKicker')!.textContent = survival ? t('over.survival') : t(passed?'over.passed':'over.failed');
    document.getElementById('finalStars')!.innerHTML = survival
      ? '<span class="pop" style="display:inline-flex;color:var(--m-gold)">'+SVGIC('trophy')+'</span>'
      : [0,1,2].map(i=>
      '<span class="'+(i<stars?'pop':'off')+'" style="display:inline-flex'+(i<stars?';animation-delay:'+(i*0.13)+'s':'')+'">'+SVGIC('star')+'</span>').join('');
    const mSurv = LV.objective.metric==='survival';
    const unit = t(mSurv?'unit.seconds':(LV.objective.metric==='upgrades'?'unit.upgrades':'unit.planes'), {n:v});
    document.getElementById('overMsg')!.textContent = survival
      ? t(served>prevBest ? 'over.survRecord' : 'over.survResult', {n:fmtNum(served), best:fmtNum(Math.max(served,prevBest)), money:fmtMoney(money)})
      : t('over.result', {reason:t(reasonKey), desc:objectiveDesc(), n:fmtNum(v), unit, money:fmtMoney(money)});
    // «твоё место» — глобальный ранг (только Survival). Место приходит асинхронно из submitRun →
    // показываем заглушку-ожидание, refreshOverLeaderboard() её заменит (или покажет личный рекорд).
    const rankBox=document.getElementById('overRank')!;
    rankBox.classList.toggle('hidden', !survival);
    if(survival) rankBox.innerHTML='<div class="over-rank__cap">'+t('over.rankTitle')+'</div><div class="over-rank__row"><span class="muted">…</span></div>';
    else { rankBox.innerHTML=''; rankBox.onclick=null; }
    // снимок смены — для карточки статистики, графика и шеринга
    lastShift = {
      passed, stars, surv:survival, metric:LV.objective.metric, v, target:survival?null:LV.objective.target,
      money, peak:statPeak, time:gameTime,
      levelName: currentLevelName(),
      samples: statSamples.slice(),
    };
    // карточка статистики смены
    const statsBox=document.getElementById('overStats')!; statsBox.innerHTML='';
    [[mSurv?t('stats.time'):(LV.objective.metric==='upgrades'?t('stats.upgrades'):t('stats.served')),
      survival?fmtNum(v):(mSurv?(fmtTime(v)+' / '+fmtTime(LV.objective.target ?? 0)):(fmtNum(v)+' / '+fmtNum(LV.objective.target ?? 0))), 'v-phos'],
     [t('stats.money'), fmtMoney(money), 'v-gold'],
     [t('stats.peak'), '✈ '+fmtNum(statPeak), 'v-teal'],
     [t('stats.lives'), '♥ '+fmtNum(Math.max(0,lives))+' / '+fmtNum(K.START_LIVES), 'v-life'],
     [t('stats.time'), fmtTime(gameTime), 'v-phos']
    ].forEach(s2=>{
      const d=document.createElement('div'); d.className='rstat';
      d.innerHTML=`<div class="k">${s2[0]}</div><div class="v ${s2[2]}">${s2[1]}</div>`;
      statsBox.appendChild(d);
    });
    const hasNext = !LV.biome && !LV.bonus && levelIdx+1<LEVELS.length && (debug.unlockAll||(levelIdx+1)<save.unlocked);
    document.getElementById('nextBtn')!.classList.toggle('hidden', !hasNext);
    document.getElementById('toLevelsBtn')!.classList.remove('hidden');
    document.getElementById('overScreen')!.classList.remove('hidden');
    // график рисуем после показа экрана — нужен реальный размер канваса
  }

  // ---- статистика смены: график во времени + карточка для шеринга ----
  // Рисуем в произвольный 2D-контекст (экранный канвас или офскрин для картинки):
  // область «нагрузка» (бирюза) + линия «принято» (золото) на общей оси времени.
  function drawTimeline(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shift: any){
    const pad=10, gx=x+pad+18, gy=y+pad, gw=w-pad*2-18, gh=h-pad*2-14;
    g.fillStyle=hexa(COL.phosphor,.04); g.fillRect(x,y,w,h);
    // сетка
    g.strokeStyle=hexa(COL.phosphor,.10); g.lineWidth=1;
    for(let i=0;i<=3;i++){ const yy=gy+gh*i/3; g.beginPath(); g.moveTo(gx,yy); g.lineTo(gx+gw,yy); g.stroke(); }
    const s=shift.samples||[];
    if(s.length<2){
      g.fillStyle=hexa(COL.muted,.7); g.font=`11px ${MONO}`; g.textAlign='center'; g.textBaseline='middle';
      g.fillText('—', x+w/2, y+h/2); return;
    }
    const tMax=Math.max(shift.time, s[s.length-1].t, 1);
    const loadMax=Math.max(2, ...s.map((p: any)=>p.load));
    const servMax=Math.max(1, ...s.map((p: any)=>p.served));
    const X=(t: number)=>gx + gw*Math.min(1,t/tMax);
    const Yl=(v: number)=>gy+gh - gh*(v/loadMax);
    const Ys=(v: number)=>gy+gh - gh*(v/servMax);
    // нагрузка — заливка + линия
    g.beginPath(); g.moveTo(X(s[0].t), gy+gh);
    s.forEach((p: any)=>g.lineTo(X(p.t), Yl(p.load))); g.lineTo(X(s[s.length-1].t), gy+gh); g.closePath();
    g.fillStyle=hexa(COL.teal,.16); g.fill();
    g.beginPath(); s.forEach((p: any,i: number)=>{ const fx=X(p.t),fy=Yl(p.load); i?g.lineTo(fx,fy):g.moveTo(fx,fy); });
    g.strokeStyle=COL.teal; g.lineWidth=2; g.lineJoin='round'; g.stroke();
    // принято — золотая линия (накопительно)
    g.beginPath(); s.forEach((p: any,i: number)=>{ const fx=X(p.t),fy=Ys(p.served); i?g.lineTo(fx,fy):g.moveTo(fx,fy); });
    g.strokeStyle=COL.gold; g.lineWidth=2; g.stroke();
    // подписи осей: пик нагрузки слева сверху, время справа снизу
    g.textBaseline='middle'; g.fillStyle=hexa(COL.teal,.9); g.font=`9px ${MONO}`; g.textAlign='right';
    g.fillText(String(loadMax), gx-4, gy+2);
    g.fillStyle=hexa(COL.muted,.8); g.textAlign='left'; g.textBaseline='alphabetic';
    g.fillText('0:00', gx, y+h-3); g.textAlign='right'; g.fillText(fmtTime(tMax), gx+gw, y+h-3);
    // легенда
    g.textAlign='left'; g.textBaseline='middle'; g.font=`9px ${MONO}`;
    g.fillStyle=COL.teal; g.fillRect(gx+2,gy+5,8,3); g.fillStyle=hexa(COL.muted,.9); g.fillText(t('graph.load'), gx+14, gy+6);
    const lx=gx+14+g.measureText(t('graph.load')).width+12;
    g.fillStyle=COL.gold; g.fillRect(lx,gy+5,8,3); g.fillStyle=hexa(COL.muted,.9); g.fillText(t('graph.served'), lx+12, gy+6);
  }
  // локальный скруглённый прямоугольник для офскрин-контекста (rr() завязан на ctx)
  function rrp(g: CanvasRenderingContext2D,x: number,y: number,w: number,h: number,r: number){ r=Math.min(r,w/2,h/2);
    g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
  // квадратная карточка для «поделиться картинкой»
  function drawShareCard(canvas: HTMLCanvasElement, shift: any){
    const S=1080, g=canvas.getContext('2d')!;
    const grad=g.createLinearGradient(0,0,0,S);
    grad.addColorStop(0,'#0e2230'); grad.addColorStop(1,COL.ink);
    g.fillStyle=grad; g.fillRect(0,0,S,S);
    g.fillStyle=hexa(COL.phosphor,.06); for(let i=0;i<70;i++){ const rx=(i*173)%S, ry=(i*97)%S; g.fillRect(rx,ry,2,2); }
    // шапка
    g.textAlign='center';
    g.fillStyle=COL.phosphor; g.font=`700 64px ${MONO}`; g.fillText(t('app.name'), S/2, 130);
    g.fillStyle=hexa(COL.muted,.9); g.font=`24px ${MONO}`;
    g.fillText((shift.surv?t('over.survival'):(shift.passed?t('over.passed'):t('over.failed')))+' · '+shift.levelName, S/2, 178);
    // «твоё место» в мире — лучший ранг из всех срезов (только Survival, если рейтинг успел прийти)
    if(shift.surv && shift.ranks){
      const r=['alltime','month','week'].map(p=>shift.ranks[p]).filter((x: any)=>x!=null).sort((a: number,b: number)=>a-b)[0];
      if(r!=null){ g.fillStyle=COL.gold; g.font=`700 30px ${MONO}`; g.fillText(t('over.shareRank',{rank:r}), S/2, 222); }
    }
    // звёзды
    g.fillStyle=COL.gold; g.font=`80px ${MONO}`; g.shadowColor=hexa(COL.gold,.5); g.shadowBlur=24;
    g.fillText(shift.surv?('✈ '+fmtNum(shift.v)):('★'.repeat(shift.stars)+'☆'.repeat(3-shift.stars)), S/2, 290); g.shadowBlur=0;
    // плитки статистики 2×2
    const tiles=[
      [shift.metric==='upgrades'?t('stats.upgrades'):t('stats.served'), shift.surv?fmtNum(shift.v):(fmtNum(shift.v)+' / '+fmtNum(shift.target)), COL.phosphor],
      [t('stats.money'), fmtMoney(shift.money), COL.gold],
      [t('stats.peak'), '✈ '+fmtNum(shift.peak), COL.teal],
      [t('stats.time'), fmtTime(shift.time), COL.phosphor],
    ];
    const tw=440, th=120, gap=40, ox=(S-tw*2-gap)/2, oy=340;
    tiles.forEach((tl,i)=>{ const cx=ox+(i%2)*(tw+gap), cy=oy+Math.floor(i/2)*(th+gap);
      rrp(g,cx,cy,tw,th,18); g.fillStyle=hexa(COL.phosphor,.05); g.fill();
      g.lineWidth=2; g.strokeStyle=hexa(COL.phosphor,.15); rrp(g,cx,cy,tw,th,18); g.stroke();
      g.textAlign='left'; g.textBaseline='alphabetic';
      g.fillStyle=hexa(COL.muted,.85); g.font=`20px ${MONO}`; g.fillText(tl[0].toUpperCase(), cx+26, cy+44);
      g.fillStyle=tl[2]; g.font=`600 46px ${MONO}`; g.fillText(tl[1], cx+26, cy+98);
    });
    // график во времени
    g.textAlign='left'; g.textBaseline='alphabetic';
    g.fillStyle=hexa(COL.muted,.85); g.font=`20px ${MONO}`; g.fillText(t('graph.title').toUpperCase(), ox, 700);
    // drawTimeline использует пиксельные шрифты ~9-11px → масштабируем контекст
    g.save(); g.translate(ox, 720); g.scale(2.4,2.4);
    drawTimeline(g, 0,0, (tw*2+gap)/2.4, 230/2.4, shift); g.restore();
    g.textAlign='center'; g.fillStyle=hexa(COL.phosphor,.5); g.font=`22px ${MONO}`;
    g.fillText('#PlaneFlow', S/2, S-46);
  }
  async function shareShift(){
    if(!lastShift) return;
    const card=document.createElement('canvas'); card.width=1080; card.height=1080;
    drawShareCard(card, lastShift);
    card.toBlob(async blob=>{
      if(!blob) return;
      const file=new File([blob], 'planeflow-shift.png', {type:'image/png'});
      try{
        if(navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({files:[file], title:t('app.name')}); return;
        }
      }catch(e){ /* отмена/нет поддержки — падаем в скачивание */ }
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='planeflow-shift.png'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  // ---- меню / уровни / сохранение ----

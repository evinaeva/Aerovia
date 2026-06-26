  /* ── Asset Calibration Tool (designer-only shared metadata contract) ───── */
  (function () {
    const root = document.getElementById('asset-calibration-root');
    if (!root) return;

    /** Shared AssetMetadataFile contract types (runtime PR must stay compatible).
     * @typedef {'apron'|'hangar'|'runway'|'plane'|'runwayConnector'|'hud'|'background'|'sky'} AssetKind
     * @typedef {'anchor'|'entrance'|'exit'|'insideStop'|'snap'|'landingEntry'|'touchdown'|'runwayStop'|'takeoffStart'|'liftOff'|'centerlineStart'|'centerlineEnd'|'apronConnection'|'runwayConnection'|'nose'|'tail'|'shadowOffset'|'hudTextSlot'|'hudIconSlot'|'pauseButton'} AssetPointKind
     * @typedef {'visualBounds'|'collisionBounds'|'hitArea'|'contentSafeArea'|'gameplayArea'|'textSlot'|'iconSlot'|'decorativeOnly'} AssetRectKind
     * @typedef {'background'|'apron'|'structures'|'entities'|'routes'|'vfx'|'hud'} AssetLayer
     */
    const ASSET_KINDS = ['apron','hangar','runway','plane','runwayConnector','hud','background','sky'];
    const POINT_KINDS = ['anchor','entrance','exit','insideStop','snap','landingEntry','touchdown','runwayStop','takeoffStart','liftOff','centerlineStart','centerlineEnd','apronConnection','runwayConnection','nose','tail','shadowOffset','hudTextSlot','hudIconSlot','pauseButton'];
    const RECT_KINDS = ['visualBounds','collisionBounds','hitArea','contentSafeArea','gameplayArea','textSlot','iconSlot','decorativeOnly'];
    const LAYERS = ['background','apron','structures','entities','routes','vfx','hud'];
    const SPECS = {
      hangar: { points:['anchor','entrance','insideStop','exit','snap'], rects:['visualBounds','collisionBounds','hitArea'], optionalPoints:[], optionalRects:[] },
      runway: { points:['anchor','centerlineStart','centerlineEnd','touchdown','runwayStop','takeoffStart','liftOff','snap'], rects:['visualBounds','hitArea'], optionalPoints:['landingEntry'], optionalRects:[] },
      plane: { points:['anchor','nose'], rects:['visualBounds'], optionalPoints:['tail','shadowOffset'], optionalRects:['collisionBounds'] },
      runwayConnector: { points:['anchor','apronConnection','runwayConnection'], rects:['visualBounds','hitArea'], optionalPoints:[], optionalRects:[] },
      apron: { points:[], rects:['visualBounds','gameplayArea'], optionalPoints:[], optionalRects:['contentSafeArea'] },
      hud: { points:[], rects:['visualBounds'], anyRect:['textSlot','iconSlot'], optionalPoints:[], optionalRects:['textSlot','iconSlot'] },
      background: { points:[], rects:['visualBounds'], optionalPoints:[], optionalRects:['decorativeOnly'] },
      sky: { points:[], rects:['visualBounds'], optionalPoints:[], optionalRects:['decorativeOnly'] },
    };
    const POINT_COLORS = { anchor:'#fff', entrance:'#35e678', insideStop:'#c678ff', exit:'#ffe45c', snap:'#31d7ff', nose:'#ff5454', hudTextSlot:'#31d7ff', hudIconSlot:'#31d7ff', pauseButton:'#31d7ff' };
    const RECT_COLORS = { visualBounds:'#31d7ff', collisionBounds:'#ff9f3c', hitArea:'#35e678', contentSafeArea:'#c678ff', gameplayArea:'#c678ff', textSlot:'#5695ff', iconSlot:'#ffe45c', decorativeOnly:'#9aa3ad' };
    const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0));
    const round = (v) => Math.round(clamp01(v) * 10000) / 10000;
    const uid = (kind) => String(kind).replace(/[^a-z0-9]+/gi,'') || 'item';
    const defaultAsset = () => ({ id:'', kind:'hangar', src:'', logicalSize:{ w:220, h:150 }, anchor:{ x:.5, y:.5 }, rects:[{ id:'visual', kind:'visualBounds', x:0, y:0, w:1, h:1 }], points:[{ id:'anchor', kind:'anchor', x:.5, y:.5 }], allowedRotations:[0,90,180,270], defaultRotation:0, rotationOffset:0, layer:'structures', tags:[], notes:'' });
    const state = { assets:[defaultAsset()], selectedAsset:0, selectedType:'point', selectedKind:'anchor', selectedId:'anchor', natural:{w:0,h:0}, cursor:null, dragging:null, drawing:null, exportWarnings:false, lastJson:'' };
    const asset = () => state.assets[state.selectedAsset] || state.assets[0];
    const spec = () => SPECS[asset().kind] || SPECS.hangar;
    const ensureAnchor = (a) => { const p = a.points.find(p => p.kind === 'anchor'); a.anchor = p ? { x:p.x, y:p.y } : (a.anchor || { x:.5, y:.5 }); };
    const hasAnchor = (a) => !!a.anchor && Number.isFinite(+a.anchor.x) && Number.isFinite(+a.anchor.y);
    const pointColor = (k) => POINT_COLORS[k] || (['centerlineStart','centerlineEnd','touchdown','runwayStop','takeoffStart','liftOff','landingEntry'].includes(k) ? '#5695ff' : '#31d7ff');

    function exportAsset(a) {
      ensureAnchor(a);
      return {
        id:a.id, kind:a.kind, src:a.src,
        logicalSize:{ w:+a.logicalSize.w, h:+a.logicalSize.h },
        anchor:{ x:round(a.anchor.x), y:round(a.anchor.y) },
        rects:a.rects.map(r => ({ id:r.id, kind:r.kind, x:round(r.x), y:round(r.y), w:round(r.w), h:round(r.h), ...(r.label?{label:r.label}:{}), ...(r.notes?{notes:r.notes}:{}) })),
        points:a.points.filter(p => p.kind !== 'anchor').map(p => ({ id:p.id, kind:p.kind, x:round(p.x), y:round(p.y), ...(p.radius !== undefined && p.radius !== '' ? { radius:round(p.radius) } : {}), ...(p.label?{label:p.label}:{}), ...(p.notes?{notes:p.notes}:{}) })),
        ...(a.allowedRotations?.length ? { allowedRotations:a.allowedRotations.map(Number) } : {}),
        ...(a.defaultRotation !== '' ? { defaultRotation:+a.defaultRotation } : {}),
        ...(a.rotationOffset !== '' ? { rotationOffset:+a.rotationOffset } : {}),
        ...(a.layer ? { layer:a.layer } : {}),
        ...(a.tags?.length ? { tags:a.tags } : {}),
        ...(a.notes ? { notes:a.notes } : {}),
      };
    }
    function validate(a) {
      const warnings = [];
      if (!a.id.trim()) warnings.push('missing asset id');
      if (!a.src.trim()) warnings.push('missing src');
      if (!ASSET_KINDS.includes(a.kind)) warnings.push('missing/invalid kind');
      if (!a.logicalSize || +a.logicalSize.w <= 0 || +a.logicalSize.h <= 0) warnings.push('logicalSize <= 0');
      if (!hasAnchor(a) || a.anchor.x < 0 || a.anchor.x > 1 || a.anchor.y < 0 || a.anchor.y > 1) warnings.push('anchor outside 0..1');
      const dupes = (xs) => xs.filter((x,i) => xs.indexOf(x) !== i);
      dupes(a.points.map(p => p.id)).forEach(id => warnings.push('duplicate point id: ' + id));
      dupes(a.rects.map(r => r.id)).forEach(id => warnings.push('duplicate rect id: ' + id));
      a.points.forEach(p => { if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) warnings.push(`${p.id} point outside 0..1`); if (p.kind === 'snap' && +p.radius <= 0) warnings.push(`${p.id} snap radius <= 0`); });
      a.rects.forEach(r => { if (r.x < 0 || r.x > 1 || r.y < 0 || r.y > 1 || r.x + r.w > 1 || r.y + r.h > 1) warnings.push(`${r.id} rect outside 0..1`); if (+r.w <= 0 || +r.h <= 0) warnings.push(`${r.id} rect w/h <= 0`); });
      spec().points.forEach(k => { if (k === 'anchor' ? !hasAnchor(a) : !a.points.some(p => p.kind === k)) warnings.push('missing required point: ' + k); });
      spec().rects.forEach(k => { if (!a.rects.some(r => r.kind === k)) warnings.push('missing required rect: ' + k); });
      if (spec().anyRect && !a.rects.some(r => spec().anyRect.includes(r.kind))) warnings.push('missing required rect: at least one ' + spec().anyRect.join(' or '));
      if (a.allowedRotations.length && !a.allowedRotations.map(Number).includes(+a.defaultRotation)) warnings.push('defaultRotation not included in allowedRotations');
      return warnings;
    }
    function normFromEvent(e) { const img = root.querySelector('.ac-canvas-img'); if (!img) return null; const b = img.getBoundingClientRect(); return { x:round((e.clientX - b.left) / b.width), y:round((e.clientY - b.top) / b.height), px:Math.round((e.clientX - b.left) / b.width * (state.natural.w || b.width)), py:Math.round((e.clientY - b.top) / b.height * (state.natural.h || b.height)) }; }
    function findPoint(a, id, kind) { return a.points.find(p => p.id === id) || a.points.find(p => p.kind === kind); }
    function findRect(a, id, kind) { return a.rects.find(r => r.id === id) || a.rects.find(r => r.kind === kind); }
    function upsertPoint(kind, n) { const a = asset(); let p = findPoint(a, state.selectedId, kind); if (!p) { p = { id:uid(kind), kind, x:n.x, y:n.y, ...(kind === 'snap' ? { radius:.1 } : {}) }; a.points.push(p); } p.x = n.x; p.y = n.y; if (kind === 'anchor') a.anchor = { x:n.x, y:n.y }; state.selectedType = 'point'; state.selectedKind = kind; state.selectedId = p.id; }
    function upsertRect(kind, r) { const a = asset(); let rect = findRect(a, state.selectedId, kind); if (!rect) { rect = { id:uid(kind), kind, x:r.x, y:r.y, w:r.w, h:r.h }; a.rects.push(rect); } Object.assign(rect, r); state.selectedType = 'rect'; state.selectedKind = kind; state.selectedId = rect.id; }
    function selectedItem() { const a=asset(); return state.selectedType === 'rect' ? findRect(a,state.selectedId,state.selectedKind) : findPoint(a,state.selectedId,state.selectedKind); }

    function render() {
      const a = asset(); ensureAnchor(a); const warnings = validate(a); const sp = spec();
      root.innerHTML = `<div class="ac-grid">
        <div class="ac-form">
          <div class="ac-row"><label>Asset id<input data-field="id" value="${escHtml(a.id)}" placeholder="hangar_fuel_v1"></label><label>Kind<select data-field="kind">${ASSET_KINDS.map(k=>`<option ${a.kind===k?'selected':''}>${k}</option>`).join('')}</select></label></div>
          <label>PNG src/path<input data-field="src" value="${escHtml(a.src)}" placeholder="assets/skins/hangars/hangar_fuel.png"></label>
          <div class="ac-row"><label>Logical width<input type="number" data-field="logicalW" value="${escHtml(a.logicalSize.w)}"></label><label>Logical height<input type="number" data-field="logicalH" value="${escHtml(a.logicalSize.h)}"></label></div>
          <div class="ac-row"><label>Allowed rotations<input data-field="allowedRotations" value="${escHtml(a.allowedRotations.join(', '))}"></label><label>Default rotation<input type="number" data-field="defaultRotation" value="${escHtml(a.defaultRotation)}"></label></div>
          <div class="ac-row"><label>Rotation offset<input type="number" data-field="rotationOffset" value="${escHtml(a.rotationOffset)}"></label><label>Layer<select data-field="layer"><option value=""></option>${LAYERS.map(k=>`<option ${a.layer===k?'selected':''}>${k}</option>`).join('')}</select></label></div>
          <label>Tags<input data-field="tags" value="${escHtml(a.tags.join(', '))}" placeholder="fuel, service"></label><label>Notes<textarea data-field="notes">${escHtml(a.notes)}</textarea></label>
        </div>
        <div class="ac-preview-wrap"><div class="ac-toolbar"><button class="p-btn" data-action="fit">Fit/reset</button><span>Natural: ${state.natural.w||'—'}×${state.natural.h||'—'} px</span><span>Logical: ${a.logicalSize.w}×${a.logicalSize.h}</span><span>Cursor: ${state.cursor ? `n ${state.cursor.x}, ${state.cursor.y} · px ${state.cursor.px}, ${state.cursor.py}` : '—'}</span></div>
          <div class="ac-stage"><div class="ac-canvas">${a.src ? `<img class="ac-canvas-img" src="${escHtml(a.src)}" alt="${escHtml(a.id || 'asset')} calibration preview">` : '<div class="ac-empty">Enter a PNG path to preview it.</div>'}<svg class="ac-overlay" viewBox="0 0 1 1" preserveAspectRatio="none">${a.rects.map(r=>`<rect data-hit="rect" data-id="${escHtml(r.id)}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${RECT_COLORS[r.kind]||'#aaa'}" stroke-width="0.006" vector-effect="non-scaling-stroke"></rect><text x="${r.x+.01}" y="${r.y+.035}" fill="${RECT_COLORS[r.kind]||'#aaa'}" font-size="0.035">${escHtml(r.id)}</text>`).join('')}${a.points.map(p=>`<g data-hit="point" data-id="${escHtml(p.id)}"><circle cx="${p.x}" cy="${p.y}" r="0.012" fill="${pointColor(p.kind)}" stroke="#001" stroke-width="0.004" vector-effect="non-scaling-stroke"></circle>${p.kind==='anchor'?`<path d="M ${p.x-.025} ${p.y} L ${p.x+.025} ${p.y} M ${p.x} ${p.y-.025} L ${p.x} ${p.y+.025}" stroke="#fff" stroke-width="0.004" vector-effect="non-scaling-stroke"/>`:''}${p.kind==='snap'&&p.radius?`<circle cx="${p.x}" cy="${p.y}" r="${p.radius}" fill="none" stroke="#31d7ff" stroke-dasharray="0.01 0.01" stroke-width="0.004" vector-effect="non-scaling-stroke"></circle>`:''}<text x="${p.x+.018}" y="${p.y-.018}" fill="${pointColor(p.kind)}" font-size="0.035">${escHtml(p.id)}</text></g>`).join('')}</svg></div></div>
        </div>
        <div class="ac-side"><h4>Required for ${escHtml(a.kind)}</h4><div class="ac-checks">${[...sp.rects.map(k=>['rect',k]), ...(sp.anyRect?[['rectAny',sp.anyRect.join(' or ')]]:[]), ...sp.points.map(k=>['point',k])].map(([t,k])=>{ const ok=t==='rectAny'?a.rects.some(r=>sp.anyRect.includes(r.kind)):t==='rect'?a.rects.some(r=>r.kind===k):a.points.some(p=>p.kind===k); return `<button class="ac-check ${ok?'ok':'missing'} ${state.selectedKind===k?'sel':''}" data-select-type="${t==='point'?'point':'rect'}" data-kind="${escHtml(String(k).split(' ')[0])}">${ok?'✓':'○'} ${escHtml(k)}</button>`; }).join('')}</div>
          <details open><summary>Optional/recommended</summary><div class="ac-checks">${[...(sp.optionalRects||[]).map(k=>['rect',k]), ...(sp.optionalPoints||[]).map(k=>['point',k])].map(([t,k])=>`<button class="ac-check" data-select-type="${t}" data-kind="${k}">+ ${k}</button>`).join('') || '<span class="lab-empty">—</span>'}</div></details>
          <div id="ac-editor">${editorHtml()}</div>
          <div class="ac-valid ${warnings.length?'warn':'ready'}">${warnings.length ? 'Warnings:<ul>' + warnings.map(w=>`<li>${escHtml(w)}</li>`).join('') + '</ul><label><input type="checkbox" data-field="exportWarnings" ${state.exportWarnings?'checked':''}> Export with warnings</label>' : 'Ready to export'}</div>
          <p class="ac-path-hint">Production runtime metadata path: <code>assets/metadata/asset-metadata.json</code>. Keep <code>asset-metadata.sample.json</code> as example/dev data only.</p>
          <div class="ac-actions"><button class="p-btn" data-action="applyPreview" ${warnings.length&&!state.exportWarnings?'disabled':''}>Apply to Game Preview</button><button class="p-btn" data-action="copySelected" ${warnings.length&&!state.exportWarnings?'disabled':''}>Copy selected JSON</button><button class="p-btn" data-action="downloadSelected" ${warnings.length&&!state.exportWarnings?'disabled':''}>Download selected</button><button class="p-btn" data-action="copyAll">Copy all JSON</button><button class="p-btn" data-action="downloadAll">Download all</button><label class="p-btn">Import JSON<input type="file" accept="application/json" data-action="import" hidden></label></div>
          ${state.previewStatus ? `<div class="ac-preview-status">${escHtml(state.previewStatus)}</div>` : ''}<textarea class="ac-json" readonly>${escHtml(state.lastJson)}</textarea>
        </div></div>`;
      bind();
    }
    function editorHtml() { const it = selectedItem(); if (!it) return '<h4>Numeric editor</h4><p class="lab-empty">Select a checklist item or marker.</p>'; const opts = (state.selectedType === 'rect' ? RECT_KINDS : POINT_KINDS).map(k=>`<option ${it.kind===k?'selected':''}>${k}</option>`).join(''); return `<h4>Numeric editor · ${state.selectedType}</h4><label>id<input data-edit="id" value="${escHtml(it.id)}"></label><label>kind<select data-edit="kind">${opts}</select></label><div class="ac-row"><label>x<input type="number" step="0.0001" data-edit="x" value="${it.x}"></label><label>y<input type="number" step="0.0001" data-edit="y" value="${it.y}"></label></div>${state.selectedType==='rect'?`<div class="ac-row"><label>w<input type="number" step="0.0001" data-edit="w" value="${it.w}"></label><label>h<input type="number" step="0.0001" data-edit="h" value="${it.h}"></label></div>`:`<label>radius<input type="number" step="0.0001" data-edit="radius" value="${it.radius ?? ''}"></label>`}<label>label<input data-edit="label" value="${escHtml(it.label||'')}"></label><label>notes<textarea data-edit="notes">${escHtml(it.notes||'')}</textarea></label>`; }
    function bind() {
      root.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', () => { const a=asset(), f=el.dataset.field; if(f==='id')a.id=el.value; if(f==='kind'){a.kind=el.value; a.layer = ({hangar:'structures', runway:'routes', plane:'entities', apron:'apron', hud:'hud', background:'background', sky:'background'})[a.kind] || a.layer;} if(f==='src')a.src=el.value; if(f==='logicalW')a.logicalSize.w=+el.value; if(f==='logicalH')a.logicalSize.h=+el.value; if(f==='allowedRotations')a.allowedRotations=el.value.split(',').map(s=>+s.trim()).filter(Number.isFinite); if(f==='defaultRotation')a.defaultRotation=+el.value; if(f==='rotationOffset')a.rotationOffset=+el.value; if(f==='layer')a.layer=el.value; if(f==='tags')a.tags=el.value.split(',').map(s=>s.trim()).filter(Boolean); if(f==='notes')a.notes=el.value; if(f==='exportWarnings')state.exportWarnings=el.checked; render(); }));
      root.querySelectorAll('[data-select-type]').forEach(b => b.addEventListener('click', () => { state.selectedType=b.dataset.selectType; state.selectedKind=b.dataset.kind; const it=state.selectedType==='rect'?findRect(asset(),null,state.selectedKind):findPoint(asset(),null,state.selectedKind); state.selectedId=it?.id || uid(state.selectedKind); render(); }));
      root.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('input', () => { const it=selectedItem(); if(!it)return; const f=el.dataset.edit; if(['x','y','w','h','radius'].includes(f)) it[f]=f==='radius'&&el.value===''?undefined:round(el.value); else it[f]=el.value; if(f==='kind') state.selectedKind=el.value; if(f==='id') state.selectedId=el.value; if(it.kind==='anchor') asset().anchor={x:it.x,y:it.y}; render(); }));
      const img = root.querySelector('.ac-canvas-img'); if (img) img.addEventListener('load', () => { state.natural={w:img.naturalWidth,h:img.naturalHeight}; });
      const stage = root.querySelector('.ac-stage'); if (stage) { stage.addEventListener('pointermove', e => { const n=normFromEvent(e); if(!n)return; state.cursor=n; if(state.dragging==='point') upsertPoint(state.selectedKind,n); if(state.drawing) { const x=Math.min(state.drawing.x,n.x), y=Math.min(state.drawing.y,n.y); upsertRect(state.selectedKind,{x,y,w:round(Math.abs(n.x-state.drawing.x)),h:round(Math.abs(n.y-state.drawing.y))}); } render(); }); stage.addEventListener('pointerdown', e => { const hit=e.target.closest('[data-hit]'); const n=normFromEvent(e); if(!n)return; if(hit){ state.selectedType=hit.dataset.hit; state.selectedId=hit.dataset.id; const it=selectedItem(); state.selectedKind=it.kind; state.dragging=hit.dataset.hit==='point'?'point':null; } else if(state.selectedType==='rect') { state.drawing=n; upsertRect(state.selectedKind,{x:n.x,y:n.y,w:.001,h:.001}); } else { upsertPoint(state.selectedKind,n); state.dragging='point'; } render(); }); stage.addEventListener('pointerup',()=>{state.dragging=null;state.drawing=null;}); stage.addEventListener('pointerleave',()=>{state.dragging=null;state.drawing=null;}); }
      root.querySelectorAll('[data-action]').forEach(el => { if(el.dataset.action==='import') el.addEventListener('change', importJson); else el.addEventListener('click', actions); });
    }
    function jsonFor(all) { const file={ schemaVersion:1, assets:(all?state.assets:[asset()]).map(exportAsset) }; state.lastJson=JSON.stringify(file,null,2); return state.lastJson; }
    function download(name, text) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
    function previewFrame() { return (typeof gameFrame !== 'undefined' && gameFrame) || document.getElementById('game-frame') || document.querySelector('iframe'); }
    function previewAssetsApi() { const frame = previewFrame(); return { frame, api: frame?.contentWindow?.__ASSETS }; }
    function applyPreview(txt) { const { frame, api } = previewAssetsApi(); if (!frame) { state.previewStatus = 'Game preview iframe was not found.'; return; } if (!api || typeof api.loadMetadata !== 'function') { state.previewStatus = 'Game preview found, but __ASSETS.loadMetadata is not ready yet.'; return; } api.loadMetadata(JSON.parse(txt)); api.rendererMode = 'hybrid'; api.debugOverlay = true; state.previewStatus = 'Applied to game preview: __ASSETS.loadMetadata(), rendererMode=hybrid, debugOverlay=true.'; }
    function actions(e) { const a=e.currentTarget.dataset.action; const all=a.endsWith('All'); const txt=jsonFor(all || a === 'applyPreview'); if(a==='applyPreview') applyPreview(txt); if(a.startsWith('copy')) navigator.clipboard?.writeText(txt); if(a.startsWith('download')) download((asset().id||'asset-metadata') + (all?'-all':'') + '.json', txt); render(); }
    function importJson(e) { const f=e.target.files?.[0]; if(!f)return; f.text().then(t => { const parsed=JSON.parse(t); if(parsed.schemaVersion!==1 || !Array.isArray(parsed.assets)) throw new Error('Expected AssetMetadataFile'); state.assets=parsed.assets.map(a => ({ ...defaultAsset(), ...a, anchor:a.anchor||{x:.5,y:.5}, points:[...(a.points||[]).filter(p => p.kind !== 'anchor'), { id:'anchor', kind:'anchor', x:a.anchor?.x ?? .5, y:a.anchor?.y ?? .5 }], rects:a.rects||[] })); state.selectedAsset=0; state.selectedType='point'; state.selectedKind='anchor'; state.selectedId='anchor'; render(); }).catch(err => alert('Import failed: ' + err.message)); }
    window._assetCalibrationSync = render;
    render();
  })();

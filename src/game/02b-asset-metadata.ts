// ===== 02b-asset-metadata — runtime PNG metadata contract, validation, registry & helpers =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: AssetMetadataRegistry, ASSET_RENDERER, assetMetadataRegistry.
// Reads: 01 (ctx); 02 (SPRITES); 09 (hexa); 06 (debug, ui) at runtime.

type RendererMode = 'procedural' | 'png' | 'hybrid';
type AssetKind = 'apron' | 'hangar' | 'runway' | 'plane' | 'runwayConnector' | 'hud' | 'background' | 'sky';
type AssetPointKind = 'anchor' | 'entrance' | 'exit' | 'insideStop' | 'snap' | 'landingEntry' | 'touchdown' | 'runwayStop' | 'takeoffStart' | 'liftOff' | 'centerlineStart' | 'centerlineEnd' | 'apronConnection' | 'runwayConnection' | 'nose' | 'tail' | 'shadowOffset' | 'hudTextSlot' | 'hudIconSlot' | 'pauseButton';
type AssetRectKind = 'visualBounds' | 'collisionBounds' | 'hitArea' | 'contentSafeArea' | 'gameplayArea' | 'textSlot' | 'iconSlot' | 'decorativeOnly';
type AssetLayer = 'background' | 'apron' | 'structures' | 'entities' | 'routes' | 'vfx' | 'hud';
interface AssetVec2 { x: number; y: number; }
interface AssetSize { w: number; h: number; }
interface AssetPoint { id: string; kind: AssetPointKind; x: number; y: number; radius?: number; label?: string; notes?: string; }
interface AssetRect { id: string; kind: AssetRectKind; x: number; y: number; w: number; h: number; label?: string; notes?: string; }
interface AssetMetadata { id: string; kind: AssetKind; src: string; logicalSize: AssetSize; anchor: AssetVec2; rects: AssetRect[]; points: AssetPoint[]; allowedRotations?: number[]; defaultRotation?: number; rotationOffset?: number; layer?: AssetLayer; tags?: string[]; notes?: string; }
interface AssetMetadataFile { schemaVersion: 1; assets: AssetMetadata[]; }
interface AssetDrawRect { x: number; y: number; w: number; h: number; }
interface AssetValidationWarning { assetId?: string; message: string; }

const ASSET_RENDERER = { mode: 'procedural' as RendererMode, debugOverlay: false };
const ASSET_KINDS = new Set(['apron','hangar','runway','plane','runwayConnector','hud','background','sky']);
const ASSET_POINT_KINDS = new Set(['anchor','entrance','exit','insideStop','snap','landingEntry','touchdown','runwayStop','takeoffStart','liftOff','centerlineStart','centerlineEnd','apronConnection','runwayConnection','nose','tail','shadowOffset','hudTextSlot','hudIconSlot','pauseButton']);
const ASSET_RECT_KINDS = new Set(['visualBounds','collisionBounds','hitArea','contentSafeArea','gameplayArea','textSlot','iconSlot','decorativeOnly']);
const ASSET_LAYERS = new Set(['background','apron','structures','entities','routes','vfx','hud']);
const ASSET_REQUIREMENTS: Record<AssetKind, { rects: AssetRectKind[]; points: AssetPointKind[]; anyRect?: AssetRectKind[]; snap?: boolean }> = {
  hangar: { rects:['visualBounds','collisionBounds','hitArea'], points:['entrance','insideStop','exit'], snap:true },
  runway: { rects:['visualBounds','hitArea'], points:['centerlineStart','centerlineEnd','touchdown','runwayStop','takeoffStart','liftOff'], snap:true },
  plane: { rects:['visualBounds'], points:['nose'] },
  runwayConnector: { rects:['visualBounds'], points:['apronConnection','runwayConnection'] },
  apron: { rects:['visualBounds','gameplayArea'], points:[] },
  hud: { rects:['visualBounds'], points:[], anyRect:['textSlot','iconSlot'] },
  background: { rects:['visualBounds'], points:[] },
  sky: { rects:['visualBounds'], points:[] },
};

class AssetMetadataRegistry {
  private byId = new Map<string, AssetMetadata>();
  private byKind = new Map<AssetKind, AssetMetadata[]>();
  private imageCache = new Map<string, HTMLImageElement>();
  private warnings: AssetValidationWarning[] = [];

  load(file: unknown){
    this.byId.clear(); this.byKind.clear(); this.warnings = [];
    this.validateFile(file).forEach(a => {
      this.byId.set(a.id, a);
      const arr = this.byKind.get(a.kind) || [];
      arr.push(a); this.byKind.set(a.kind, arr);
      this.preload(a);
    });
    return this.getValidationWarnings();
  }
  async loadFromUrl(url: string){
    try{
      const r = await fetch(url, { cache:'no-store' });
      if(!r.ok){ this.warnings.push({ message:'asset metadata fetch failed: '+url+' ('+r.status+')' }); return this.getValidationWarnings(); }
      return this.load(await r.json());
    }catch(e){ this.warnings.push({ message:'asset metadata fetch failed: '+url }); return this.getValidationWarnings(); }
  }
  getAssetMetadata(assetId: string){ return this.byId.get(assetId); }
  getAssetsByKind(kind: AssetKind){ return (this.byKind.get(kind) || []).slice(); }
  getValidationWarnings(){ return this.warnings.slice(); }
  safeDefault(kind: AssetKind, id: string, src = ''): AssetMetadata { return { id, kind, src, logicalSize:{w:1,h:1}, anchor:{x:.5,y:.5}, rects:[{id:'visual',kind:'visualBounds',x:0,y:0,w:1,h:1}], points:[] }; }
  imageFor(asset: AssetMetadata){
    if(!asset.src || typeof Image === 'undefined') return null;
    let im = this.imageCache.get(asset.src);
    if(!im){ im = new Image(); im.decoding='async'; im.crossOrigin='anonymous'; im.src=asset.src; this.imageCache.set(asset.src, im); }
    return (im.complete && im.naturalWidth > 0) ? im : null;
  }
  drawPng(asset: AssetMetadata, cx: number, cy: number, scale = 1, rotationDeg = 0){
    const im = this.imageFor(asset); if(!im) return false;
    const w = asset.logicalSize.w * scale, h = asset.logicalSize.h * scale;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((rotationDeg + (asset.rotationOffset || 0)) * Math.PI / 180);
    ctx.drawImage(im, -asset.anchor.x*w, -asset.anchor.y*h, w, h); ctx.restore(); return true;
  }
  drawRectFor(asset: AssetMetadata, cx: number, cy: number, scale = 1): AssetDrawRect {
    const w = asset.logicalSize.w * scale, h = asset.logicalSize.h * scale;
    return { x: cx - asset.anchor.x*w, y: cy - asset.anchor.y*h, w, h };
  }
  assetPointToWorld(asset: AssetMetadata, pointIdOrKind: string, drawRect: AssetDrawRect, rotationDeg = 0){
    const p = (asset.points||[]).find(q => q.id === pointIdOrKind || q.kind === pointIdOrKind); if(!p) return null;
    return this.normalizedToWorld(asset, p.x, p.y, drawRect, rotationDeg);
  }
  assetRectToWorld(asset: AssetMetadata, rectIdOrKind: string, drawRect: AssetDrawRect, rotationDeg = 0){
    const r = (asset.rects||[]).find(q => q.id === rectIdOrKind || q.kind === rectIdOrKind); if(!r) return null;
    const pts = [[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(([x,y]) => this.normalizedToWorld(asset, x, y, drawRect, rotationDeg));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs)-Math.min(...xs), h: Math.max(...ys)-Math.min(...ys) };
  }
  drawDebugOverlay(asset: AssetMetadata, drawRect: AssetDrawRect, objectId?: string, rotationDeg = 0){
    if(!ASSET_RENDERER.debugOverlay) return;
    ctx.save(); ctx.font = `${10*(typeof ui==='number'?ui:1)}px ui-monospace,monospace`; ctx.textBaseline='top'; ctx.lineWidth=1.5;
    const colors: Record<string,string> = { visualBounds:'#3ad2ff', collisionBounds:'#ff3b6b', hitArea:'#ffd23b', gameplayArea:'#5de08a', textSlot:'#dff4ff', iconSlot:'#b98cff', decorativeOnly:'#5f7bb0' };
    (asset.rects||[]).forEach(r => { const wr=this.assetRectToWorld(asset, r.id, drawRect, rotationDeg); if(!wr) return; ctx.strokeStyle=colors[r.kind]||'#fff'; ctx.setLineDash(r.kind==='decorativeOnly'?[4,4]:[]); ctx.strokeRect(wr.x,wr.y,wr.w,wr.h); ctx.setLineDash([]); ctx.fillStyle=ctx.strokeStyle; ctx.fillText(r.kind, wr.x+2, wr.y+2); });
    const anc = this.normalizedToWorld(asset, asset.anchor.x, asset.anchor.y, drawRect, rotationDeg); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(anc.x,anc.y,3,0,7); ctx.fill(); ctx.fillText('anchor', anc.x+5, anc.y+3);
    (asset.points||[]).forEach(p => { const wp=this.assetPointToWorld(asset, p.id, drawRect, rotationDeg); if(!wp) return; const col=p.kind==='snap'?'#22e3c6':p.kind==='nose'?'#ff4f9d':'#ffd23b'; ctx.strokeStyle=col; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(wp.x,wp.y,3,0,7); ctx.fill(); if(p.radius){ ctx.beginPath(); ctx.arc(wp.x,wp.y,p.radius*Math.max(drawRect.w,drawRect.h),0,7); ctx.stroke(); } ctx.fillText(p.id || p.kind, wp.x+5, wp.y+3); });
    ctx.fillStyle='#fff'; ctx.fillText(asset.id + (objectId ? ' / '+objectId : ''), drawRect.x, drawRect.y-13); ctx.restore();
  }
  private normalizedToWorld(asset: AssetMetadata, nx: number, ny: number, drawRect: AssetDrawRect, rotationDeg = 0){
    const ax = drawRect.x + asset.anchor.x * drawRect.w, ay = drawRect.y + asset.anchor.y * drawRect.h;
    const px = drawRect.x + nx * drawRect.w, py = drawRect.y + ny * drawRect.h;
    const a = (rotationDeg + (asset.rotationOffset || 0)) * Math.PI / 180, dx = px-ax, dy = py-ay;
    if(!a) return { x:px, y:py };
    return { x: ax + dx*Math.cos(a) - dy*Math.sin(a), y: ay + dx*Math.sin(a) + dy*Math.cos(a) };
  }
  private preload(asset: AssetMetadata){ this.imageFor(asset); }
  private warn(assetId: string|undefined, message: string){ this.warnings.push({ assetId, message }); }
  private validateFile(file: any): AssetMetadata[] {
    if(!file || typeof file !== 'object'){ this.warn(undefined, 'metadata file must be an object'); return []; }
    if(file.schemaVersion !== 1) this.warn(undefined, 'schemaVersion must be 1');
    if(!Array.isArray(file.assets)){ this.warn(undefined, 'assets must be an array'); return []; }
    const seen = new Set<string>(), out: AssetMetadata[] = [];
    file.assets.forEach((asset: any, idx: number) => {
      const label = asset && asset.id || `assets[${idx}]`;
      if(!asset || typeof asset !== 'object'){ this.warn(label, 'asset must be an object'); return; }
      if(!asset.id || typeof asset.id !== 'string') this.warn(label, 'missing asset id');
      if(asset.id && seen.has(asset.id)) this.warn(asset.id, 'duplicate asset id');
      if(asset.id) seen.add(asset.id);
      if(!asset.src || typeof asset.src !== 'string') this.warn(label, 'missing src');
      if(!ASSET_KINDS.has(asset.kind)) this.warn(label, 'invalid kind: '+asset.kind);
      if(asset.layer && !ASSET_LAYERS.has(asset.layer)) this.warn(label, 'invalid layer: '+asset.layer);
      const ls = asset.logicalSize;
      if(!ls || !(ls.w > 0) || !(ls.h > 0)) this.warn(label, 'logicalSize missing or <= 0');
      const an = asset.anchor;
      if(!an || !this.unit(an.x) || !this.unit(an.y)) this.warn(label, 'anchor outside 0..1');
      if(!Array.isArray(asset.rects)) { this.warn(label, 'rects must be an array'); asset.rects = []; }
      if(!Array.isArray(asset.points)) { this.warn(label, 'points must be an array'); asset.points = []; }
      asset.rects.forEach((r: any) => { if(!ASSET_RECT_KINDS.has(r.kind)) this.warn(label, 'invalid rect kind: '+r.kind); if(!this.unit(r.x) || !this.unit(r.y) || !this.unit(r.x+r.w) || !this.unit(r.y+r.h)) this.warn(label, `rect outside 0..1: ${r.id||r.kind}`); if(!(r.w > 0) || !(r.h > 0)) this.warn(label, `rect width/height <= 0: ${r.id||r.kind}`); });
      asset.points.forEach((p: any) => { if(!ASSET_POINT_KINDS.has(p.kind)) this.warn(label, 'invalid point kind: '+p.kind); if(!this.unit(p.x) || !this.unit(p.y)) this.warn(label, `point outside 0..1: ${p.id||p.kind}`); if(p.kind === 'snap' && !(p.radius > 0)) this.warn(label, `snap radius <= 0: ${p.id||p.kind}`); });
      ['allowedRotations','defaultRotation','rotationOffset'].forEach(k => { const v = asset[k]; const vals = Array.isArray(v) ? v : (v == null ? [] : [v]); vals.forEach((n: any) => { if(typeof n !== 'number' || !isFinite(n) || Math.abs(n) >= 360 || Math.abs(n % 1) > 0) this.warn(label, 'invalid rotation: '+k); }); });
      if(ASSET_KINDS.has(asset.kind)) this.validateRequirements(asset as AssetMetadata, label);
      out.push(asset as AssetMetadata);
    });
    return out;
  }
  private validateRequirements(asset: AssetMetadata, label: string){
    const req = ASSET_REQUIREMENTS[asset.kind]; if(!req) return;
    req.rects.forEach(k => { if(!asset.rects.some(r => r.kind === k)) this.warn(label, 'missing required rect: '+k); });
    req.points.forEach(k => { if(!asset.points.some(p => p.kind === k)) this.warn(label, 'missing required point: '+k); });
    if(req.snap && !asset.points.some(p => p.kind === 'snap')) this.warn(label, 'missing required snap point');
    if(req.anyRect && !asset.rects.some(r => req.anyRect!.includes(r.kind))) this.warn(label, 'missing required rect: one of '+req.anyRect.join(', '));
  }
  private unit(n: any){ return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1; }
}
const assetMetadataRegistry = new AssetMetadataRegistry();

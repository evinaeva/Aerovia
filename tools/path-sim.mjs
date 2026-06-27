// path-sim.mjs — autonomous harness for the plane path-following physics.
// Verbatim copy of steer/turnRate from src/game/08b-gameplay-step.ts so we can
// "draw a circle and watch the plane drive it" without the browser, and compare
// candidate path-followers head-to-head.
//
//   node tools/path-sim.mjs            # compare algos on all cases, write SVGs
//
// Metric = cross-track error: distance from each trajectory sample to the
// nearest point on the drawn polyline. Max + mean = "how far it drives off line".

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '_pathsim');
mkdirSync(OUT, { recursive: true });

// ---- game constants ----
const K = { TURN: 0.5, ARRIVE: 2, SPEED_TAXI: 56, SPEED_AIR: 55 };
let ui = 1.0;
let TURN = K.TURN; // overridable per algo

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const turnRate = () => TURN * (1.5 / Math.max(0.7, Math.min(1.5, ui)));

// verbatim steer (08b)
function steer(pl, tx, ty, spd, dt) {
  const desired = Math.atan2(ty - pl.y, tx - pl.x);
  let diff = desired - pl.ang;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const max = turnRate() * dt;
  pl.ang += Math.max(-max, Math.min(max, diff));
  pl.x += Math.cos(pl.ang) * spd * dt;
  pl.y += Math.sin(pl.ang) * spd * dt;
}

// ===== ALGO 1: CURRENT (08b verbatim) =====
function f_current(pl, spd, dt) {
  if (!pl.path.length) return;
  const wp = pl.path[0];
  steer(pl, wp.x, wp.y, spd, dt);
  const turnR = spd / turnRate();
  const isLast = pl.path.length === 1;
  const capture = (pl.autoPath || isLast) ? K.ARRIVE : Math.max(K.ARRIVE, turnR * 0.6);
  const d = dist(pl.x, pl.y, wp.x, wp.y);
  const toX = wp.x - pl.x, toY = wp.y - pl.y;
  const behind = (toX * Math.cos(pl.ang) + toY * Math.sin(pl.ang)) < 0;
  if (d < capture || (behind && d < turnR * 1.5)) pl.path.shift();
}

// ===== ALGO 2: parametric capture (same model, capture = capFn(turnR)) =====
function makeCap(capFn) {
  return function (pl, spd, dt) {
    if (!pl.path.length) return;
    const wp = pl.path[0];
    steer(pl, wp.x, wp.y, spd, dt);
    const turnR = spd / turnRate();
    const isLast = pl.path.length === 1;
    const capture = (pl.autoPath || isLast) ? K.ARRIVE : Math.max(K.ARRIVE, capFn(turnR));
    const d = dist(pl.x, pl.y, wp.x, wp.y);
    const toX = wp.x - pl.x, toY = wp.y - pl.y;
    const behind = (toX * Math.cos(pl.ang) + toY * Math.sin(pl.ang)) < 0;
    if (d < capture || (behind && d < turnR * 1.5)) pl.path.shift();
  };
}

// ===== ALGO 3: ADAPTIVE capture by upcoming path curvature =====
// Estimate the path's radius of curvature ~lookK·turnR ahead, compare to turnR.
// Rpath >= turnR  => plane can track it  => small capture (follow the line).
// Rpath <  turnR (sharper than it can turn) => grow capture => smooth pre-cut,
// no overshoot. base floor smooths finger jitter on gentle arcs.
function makeAdaptive({ lookK = 1.0, thr = 1.25, gain = 1.0, topK = 0.7, base = 20, floorCapK = Infinity } = {}) {
  return function (pl, spd, dt) {
    if (!pl.path.length) return;
    const wp = pl.path[0];
    steer(pl, wp.x, wp.y, spd, dt);
    const turnR = spd / turnRate();
    const isLast = pl.path.length === 1;
    let capture;
    if (pl.autoPath || isLast) {
      capture = K.ARRIVE;
    } else {
      const look = turnR * lookK;
      let acc = 0, k = 0;
      while (k < pl.path.length - 1 && acc < look) { acc += dist(pl.path[k].x, pl.path[k].y, pl.path[k + 1].x, pl.path[k + 1].y); k++; }
      const inA = Math.atan2(wp.y - pl.y, wp.x - pl.x);
      const f0 = pl.path[Math.max(0, k - 1)], f1 = pl.path[k];
      const outA = Math.atan2(f1.y - f0.y, f1.x - f0.x);
      let th = outA - inA; while (th > Math.PI) th -= 2 * Math.PI; while (th < -Math.PI) th += 2 * Math.PI;
      const Rpath = Math.abs(th) > 0.05 ? acc / Math.abs(th) : 1e9;
      const tightness = turnR / Math.max(8, Rpath);
      const over = Math.max(0, tightness - thr);
      // floor never exceeds the old turnR-scaled capture: at very low speed (fog/weather
      // taxi) turnR is tiny, the plane can track tightly, so the floor must shrink too.
      const floor = Math.min(base * ui, turnR * floorCapK);
      capture = Math.max(floor, Math.min(turnR * topK, floor + over * gain * turnR));
    }
    const d = dist(pl.x, pl.y, wp.x, wp.y);
    const toX = wp.x - pl.x, toY = wp.y - pl.y;
    const behind = (toX * Math.cos(pl.ang) + toY * Math.sin(pl.ang)) < 0;
    if (d < capture || (behind && d < turnR * 1.5)) pl.path.shift();
  };
}

// ---- seeded PRNG (deterministic jitter to mimic a shaky finger) ----
function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function jitter(pts, amp, seed = 1) {
  if (!amp) return pts;
  const rnd = mulberry32(seed);
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return { ...p };       // keep endpoints
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty) || 1; // perpendicular to local tangent
    const off = (rnd() * 2 - 1) * amp;
    return { x: p.x + (-ty / L) * off, y: p.y + (tx / L) * off };
  });
}

// ---- path generators (mimic finger: ~12px screen step) ----
function circlePath(cx, cy, r, turns = 1, step = 12) {
  const pts = [], total = 2 * Math.PI * r * turns, n = Math.max(8, Math.round(total / step));
  for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI * turns; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}
// inward spiral: radius shrinks r0 -> r1 over `turns` — sweeps gentle->tight curvature
function spiralPath(cx, cy, r0, r1, turns = 1.5, step = 12) {
  const pts = []; const n = Math.max(16, Math.round(Math.PI * (r0 + r1) * turns / step));
  for (let i = 0; i <= n; i++) { const u = i / n, a = u * 2 * Math.PI * turns, r = r0 + (r1 - r0) * u; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}
// S-curve: two opposite half-circles (tests reversing curvature sign)
function scurvePath(cx, cy, r, step = 12) {
  const a = circlePath(cx, cy - r, r, 0.5, step).map(p => p);            // upper bend
  const b = circlePath(cx + 2 * r, cy + r, r, 0.5, step);
  // stitch: first half then mirror the second going the other way
  const top = []; const n = Math.max(8, Math.round(Math.PI * r / step));
  for (let i = 0; i <= n; i++) { const t = Math.PI - (i / n) * Math.PI; top.push({ x: cx + r * Math.cos(t), y: cy - r + r * Math.sin(t) }); }
  const bot = [];
  for (let i = 0; i <= n; i++) { const t = Math.PI + (i / n) * Math.PI; bot.push({ x: cx + 2 * r - r * Math.cos(t), y: cy + r + r * Math.sin(t) }); }
  return top.concat(bot.slice(1));
}
function rectPath(x, y, w, h, step = 12) {
  const corners = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }], pts = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i], b = corners[i + 1], len = dist(a.x, a.y, b.x, b.y), n = Math.max(1, Math.round(len / step));
    for (let j = 0; j < n; j++) pts.push({ x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n });
  }
  pts.push(corners[corners.length - 1]); return pts;
}
// L-shaped 90° turn at corner (cx,cy): horizontal approach from the left, bend
// rounded with radius rr (rr=0 => sharp), vertical exit downward. Arc centre
// (cx-rr, cy+rr), tangent to both legs.
function Lpath(cx, cy, rr, leg = 120, step = 12) {
  const pts = [];
  for (let x = cx - leg; x < cx - rr; x += step) pts.push({ x, y: cy });           // horizontal in
  if (rr > 0) { const n = Math.max(2, Math.round((Math.PI / 2 * rr) / step)); for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push({ x: cx - rr + rr * Math.cos(a), y: cy + rr + rr * Math.sin(a) }); } }
  else pts.push({ x: cx, y: cy });
  for (let y = cy + rr; y <= cy + leg; y += step) pts.push({ x: cx, y });           // vertical out
  return pts;
}

// ---- metrics ----
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return dist(px, py, ax + dx * t, ay + dy * t);
}
function crossTrack(p, poly) { let m = Infinity; for (let i = 0; i < poly.length - 1; i++) { const d = distToSeg(p.x, p.y, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y); if (d < m) m = d; } return m; }

function run(drawn, follow, { spd = K.SPEED_TAXI, dt = 1 / 60, maxSteps = 8000 } = {}) {
  const ahead = drawn[Math.min(4, drawn.length - 1)];
  const pl = { x: drawn[0].x, y: drawn[0].y, ang: Math.atan2(ahead.y - drawn[0].y, ahead.x - drawn[0].x), path: drawn.map(p => ({ x: p.x, y: p.y })), autoPath: false };
  const traj = [{ x: pl.x, y: pl.y }];
  let steps = 0, stuck = 0, prevDir = 0, wig = 0;
  while (pl.path.length && steps < maxSteps) {
    const px = pl.x, py = pl.y, a0 = pl.ang;
    follow(pl, spd, dt);
    traj.push({ x: pl.x, y: pl.y });
    // wiggle: count left/right steering reversals (high = the plane fishtails)
    let da = pl.ang - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const dir = Math.abs(da) > 1e-4 ? Math.sign(da) : 0;
    if (dir && prevDir && dir !== prevDir) wig++;
    if (dir) prevDir = dir;
    if (dist(px, py, pl.x, pl.y) < spd * dt * 0.05) { if (++stuck > 120) break; } else stuck = 0;
    steps++;
  }
  let maxE = 0, sumE = 0;
  for (const p of traj) { const e = crossTrack(p, drawn); maxE = Math.max(maxE, e); sumE += e; }
  return { traj, maxE, meanE: sumE / traj.length, steps, finished: pl.path.length === 0, wiggle: steps ? wig / steps * 100 : 0 };
}

function svg(drawn, traj, title) {
  const all = drawn.concat(traj), xs = all.map(p => p.x), ys = all.map(p => p.y), pad = 24;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
  const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + (p.x - minX).toFixed(1) + ',' + (p.y - minY).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" xmlns="http://www.w3.org/2000/svg">
<rect width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#0a0e14"/>
<path d="${path(drawn)}" fill="none" stroke="#26d6ff" stroke-width="2" stroke-dasharray="5 4" opacity="0.9"/>
<path d="${path(traj)}" fill="none" stroke="#ff9b3d" stroke-width="2.2"/>
<circle cx="${(traj[0].x - minX).toFixed(1)}" cy="${(traj[0].y - minY).toFixed(1)}" r="4" fill="#7CFFB2"/>
<text x="8" y="16" fill="#9fb3c8" font-family="monospace" font-size="13">${title}</text></svg>`;
}

const cases = [
  { name: 'circle_r80_smooth   ', ui: 1.0, drawn: () => circlePath(200, 200, 80) },
  { name: 'circle_r80_jitter4  ', ui: 1.0, drawn: () => jitter(circlePath(200, 200, 80), 4, 7) },
  { name: 'circle_r120_jitter5 ', ui: 1.0, drawn: () => jitter(circlePath(220, 220, 120), 5, 3) },
  { name: 'circle_r80_jit4_ui07', ui: 0.7, drawn: () => jitter(circlePath(200, 200, 80), 4, 9) },
  { name: 'circle_r120_jit_ui15', ui: 1.5, drawn: () => jitter(circlePath(220, 220, 120), 5, 5) },
  { name: 'corner_sharp        ', ui: 1.0, drawn: () => Lpath(180, 120, 0) },
  { name: 'corner_round30      ', ui: 1.0, drawn: () => Lpath(180, 120, 30) },
  { name: 'corner_round60      ', ui: 1.0, drawn: () => Lpath(180, 120, 60) },
  { name: 'rect_180x120        ', ui: 1.0, drawn: () => rectPath(80, 80, 180, 120) },
  { name: 'spiral_130to35      ', ui: 1.0, drawn: () => spiralPath(220, 220, 130, 35, 1.6) },
  { name: 'scurve_r70_jit      ', ui: 1.0, drawn: () => jitter(scurvePath(120, 160, 70), 3, 4) },
];

// follower variants (turnRate untouched).  label -> follow fn
const algos = [
  ['current (turnR*0.6) ', makeCap((tR) => tR * 0.6)],
  ['fixed   (22*ui)     ', makeCap(() => 22 * ui)],
  ['adaptive (chosen)   ', makeAdaptive({ lookK: 0.7, thr: 1.2, gain: 2.0, topK: 0.78 })],
];

const writeSvgFor = new Set(['current (turnR*0.6) ', 'adaptive (chosen)   ']);
for (const c of cases) {
  console.log('\n=== ' + c.name.trim() + ' ===   (maxErr/meanErr px, wiggle=reversals per 100 frames)');
  console.log('  algo                  maxErr  meanErr  wiggle  done');
  for (const [label, follow] of algos) {
    ui = c.ui; TURN = K.TURN;
    const r = run(c.drawn(), follow);
    console.log('  ' + label + '  ' + r.maxE.toFixed(1).padStart(5) + '   ' + r.meanE.toFixed(1).padStart(6) + '   ' + r.wiggle.toFixed(1).padStart(5) + '   ' + (r.finished ? 'yes' : 'NO(' + r.steps + ')'));
    if (writeSvgFor.has(label)) {
      ui = c.ui; TURN = K.TURN;
      const r2 = run(c.drawn(), follow);
      writeFileSync(join(OUT, c.name.trim() + '__' + label.trim().replace(/[^\w]+/g, '_') + '.svg'), svg(c.drawn(), r2.traj, c.name.trim() + ' / ' + label.trim() + ' maxErr=' + r2.maxE.toFixed(0)));
    }
  }
}
console.log('\nSVGs in tools/_pathsim/');

// ---- comparison gallery: drawn path (dashed) vs current (orange) vs chosen (green) ----
const chosen = makeAdaptive({ lookK: 0.7, thr: 1.2, gain: 2.0, topK: 0.78 });
const gallery = [
  { name: 'Круг (плавный)', ui: 1.0, drawn: () => circlePath(200, 200, 80) },
  { name: 'Круг на большом экране', ui: 1.5, drawn: () => jitter(circlePath(220, 220, 120), 5, 5) },
  { name: 'Острый угол 90°', ui: 1.0, drawn: () => Lpath(180, 120, 0) },
  { name: 'Спираль (радиус падает)', ui: 1.0, drawn: () => spiralPath(220, 220, 130, 45, 1.4) },
];
const BOX = 250, COLS = 2, GAP = 14;
function panel(c, ox, oy) {
  ui = c.ui; TURN = K.TURN;
  const drawn = c.drawn();
  const cur = run(drawn, makeCap((tR) => tR * 0.6));
  ui = c.ui; TURN = K.TURN;
  const adp = run(drawn, chosen);
  const all = drawn.concat(cur.traj, adp.traj);
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), spanX = Math.max(...xs) - minX || 1, spanY = Math.max(...ys) - minY || 1;
  const s = (BOX - 56) / Math.max(spanX, spanY);
  const tx = x => (ox + 12 + (x - minX) * s).toFixed(1), ty = y => (oy + 40 + (y - minY) * s).toFixed(1);
  const P = pts => { const step = Math.max(1, Math.floor(pts.length / 90)); const q = pts.filter((_, i) => i % step === 0 || i === pts.length - 1); return q.map((p, i) => (i ? 'L' : 'M') + tx(p.x) + ',' + ty(p.y)).join(' '); };
  return `<g>
<rect x="${ox}" y="${oy}" width="${BOX}" height="${BOX}" rx="10" fill="rgba(127,127,127,0.10)" stroke="rgba(127,127,127,0.30)"/>
<text x="${ox + 14}" y="${oy + 22}" fill="#888780" font-family="var(--font-sans),sans-serif" font-size="13" font-weight="500">${c.name}</text>
<path d="${P(drawn)}" fill="none" stroke="#888780" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
<path d="${P(cur.traj)}" fill="none" stroke="#D85A30" stroke-width="2.2"/>
<path d="${P(adp.traj)}" fill="none" stroke="#1D9E75" stroke-width="2.2"/>
<text x="${ox + 14}" y="${oy + BOX - 13}" fill="#D85A30" font-family="var(--font-sans),sans-serif" font-size="12" font-weight="500">сейчас ${cur.maxE.toFixed(0)} px</text>
<text x="${ox + BOX - 14}" y="${oy + BOX - 13}" text-anchor="end" fill="#1D9E75" font-family="var(--font-sans),sans-serif" font-size="12" font-weight="500">после ${adp.maxE.toFixed(0)} px</text>
</g>`;
}
const rows = Math.ceil(gallery.length / COLS);
const Wg = COLS * BOX + (COLS - 1) * GAP + 24, Hg = rows * BOX + (rows - 1) * GAP + 60;
let body = '';
gallery.forEach((c, i) => { const r = Math.floor(i / COLS), col = i % COLS; body += panel(c, 12 + col * (BOX + GAP), 48 + r * (BOX + GAP)); });
const gsvg = `<svg viewBox="0 0 ${Wg} ${Hg}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Сравнение траектории самолёта до и после правки на круге, угле и спирали">
<text x="12" y="20" fill="#888780" font-family="var(--font-sans),sans-serif" font-size="13">Серая — нарисованный путь · красная — как едет сейчас · зелёная — после правки. Число = макс. отклонение от линии.</text>
${body}</svg>`;
writeFileSync(join(OUT, '_gallery.svg'), gsvg);
console.log('gallery -> tools/_pathsim/_gallery.svg');

// ---- slow-speed (fog/weather taxi) regression: floor must shrink with turnR ----
console.log('\n=== slow-speed regression (circle r80, ui=1.0) — capture must not skip the >12px node spacing ===');
console.log('  speed              algo                       turnR  maxErr  meanErr');
for (const spd of [56, 5.6]) {
  const variants = [
    ['OLD turnR*0.6        ', makeCap((tR) => tR * 0.6)],
    ['adaptive floor=20*ui ', makeAdaptive({ lookK: 0.7, thr: 1.2, gain: 2.0, topK: 0.78, base: 20 })],
    ['adaptive floor≤0.6tR ', makeAdaptive({ lookK: 0.7, thr: 1.2, gain: 2.0, topK: 0.78, base: 20, floorCapK: 0.6 })],
  ];
  for (const [label, follow] of variants) {
    ui = 1.0; TURN = K.TURN;
    const turnR = spd / turnRate();
    const r = run(circlePath(200, 200, 80), follow, { spd });
    console.log('  ' + (spd === 56 ? 'normal (56)  ' : 'weather (5.6)') + '  ' + label + '  ' + turnR.toFixed(0).padStart(4) + '  ' + r.maxE.toFixed(1).padStart(5) + '   ' + r.meanE.toFixed(1).padStart(5));
  }
}

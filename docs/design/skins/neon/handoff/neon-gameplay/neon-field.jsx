/* PlaneFlow — NEON re-skin · field layer
   neon-field.jsx — glossy night air-traffic-control field that matches
   ref-01-target-neon.png, painted on the LOCKED layout (bays top/left/bottom,
   runways on the RIGHT, planes arriving from the RIGHT — never moved).
   Everything here is engine-skinnable art: radar board, glossy service bays,
   runway strips, plane sprites, the drawn route + finger.
   Exported to window for neon-hud.jsx. */

/* ---- game tokens (the values that drop into SKIN_DEFS / NEON_TOKENS) ---- */
const N = {
  ink: "#070c1c", tarmac: "#0c1430", tarmac2: "#0f1a3c", water: "#081024", core: "#16245e",
  paper: "#dff4ff", body: "#bcd6f0", muted: "#5f7bb0",
  phosphor: "#3ad2ff",            // accent · routes · radar
  amber: "#ffb13b",               // REPAIR
  teal: "#22e3c6",                // FUEL
  rose: "#ff4f9d",                // BOARDING
  ice: "#5fd2ff",                 // DE-ICE
  gold: "#ffd23b",                // VIP · coins · stars · depart
  purple: "#b98cff",              // priority livery
  green: "#5de08a",               // primary (rhymes with menu --m-primary)
  life: "#ff3b6b",                // lives
  locked: "#5f7bb0",
};
/* glow rgba per accent (baked bloom) */
const GLOW = {
  phosphor: "58,210,255", amber: "255,177,59", teal: "34,227,198", rose: "255,79,157",
  ice: "95,210,255", gold: "255,210,59", purple: "185,140,255", green: "93,224,138", life: "255,59,107",
};
const rgba = (key, a) => `rgba(${GLOW[key]},${a})`;

/* per-service descriptor — shape + colour both carry meaning (colour-blind safe) */
const SVC = {
  repair:  { color: "amber",  label: "REPAIR" },
  fuel:    { color: "teal",   label: "FUEL" },
  board:   { color: "rose",   label: "BOARDING" },
  deice:   { color: "ice",    label: "DE-ICE" },
  vip:     { color: "gold",   label: "VIP LOUNGE" },
};

/* ---------------------------------------------------------------
   ICONS — single-weight neon glyphs (engine overlays these on bays)
   --------------------------------------------------------------- */
const _I = (p) => ({ width: 26, height: 26, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p });
const NIcon = {
  repair: (p) => <svg {..._I(p)}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5 5a1.6 1.6 0 0 0 0 2.3l.7.7a1.6 1.6 0 0 0 2.3 0l5-5a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z"/></svg>,
  fuel:   (p) => <svg {..._I(p)}><rect x="4" y="4" width="9" height="16" rx="1.6"/><path d="M4 10h9"/><path d="M13 8h3.2a1.8 1.8 0 0 1 1.8 1.8V16a1.6 1.6 0 0 0 3.2 0V8.5L18.5 6"/></svg>,
  board:  (p) => <svg {..._I(p)}><circle cx="9" cy="7" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="8.5" r="2.3"/><path d="M15 20a4.2 4.2 0 0 1 6.5-2.4"/></svg>,
  deice:  (p) => <svg {..._I(p)}><path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path d="M12 6.4 14.4 4M12 6.4 9.6 4M12 17.6l2.4 2.4M12 17.6 9.6 20M4.7 9.7l3.3-.1M4.7 14.3l3.3.1M19.3 9.7l-3.3-.1M19.3 14.3l-3.3.1"/></svg>,
  vip:    (p) => <svg {..._I(p)}><circle cx="9" cy="8" r="3"/><path d="M3.4 19a5.6 5.6 0 0 1 11.2 0"/><path d="m17.5 4 1.1 2.3 2.4.3-1.8 1.7.5 2.5-2.2-1.2-2.2 1.2.5-2.5-1.8-1.7 2.4-.3Z"/></svg>,
  lock:   (p) => <svg {..._I(p)}><rect x="4.5" y="10" width="15" height="10" rx="2.4"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>,
  heart:  (p) => <svg {..._I(p)} fill="currentColor" stroke="none"><path d="M12 20.5 4.3 13a4.7 4.7 0 0 1 6.6-6.7l1.1 1 1.1-1A4.7 4.7 0 0 1 19.7 13L12 20.5Z"/></svg>,
  clock:  (p) => <svg {..._I(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7.2v5l3.4 2"/></svg>,
  coin:   (p) => <svg {..._I(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7.4v9.2M9.6 9.4a2.6 2.6 0 0 1 4.2.5M14.4 14.6a2.6 2.6 0 0 1-4.2-.5"/></svg>,
  goal:   (p) => <svg {..._I(p)}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>,
  pause:  (p) => <svg {..._I(p)} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>,
  star:   (p) => <svg {..._I(p)} fill="currentColor" stroke="none"><path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.5l1.1-6L3.4 9.3l6-.8L12 3Z"/></svg>,
  gear:   (p) => <svg {..._I(p)}><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>,
  takeoff:(p) => <svg {..._I(p)}><path d="M3 19h18"/><path d="M5 15.5 19.5 11a1.6 1.6 0 0 0-.7-3.1l-2.6.5-4.1-4.3-2 .6 2.3 4.6-3.4.7-1.8-1.7-1.6.5 1.3 3.6Z"/></svg>,
  hand:   (p) => <svg {..._I(p)}><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a5.5 5.5 0 0 1-5.5 5.5H11a4 4 0 0 1-3-1.4L4.5 17a1.6 1.6 0 0 1 2.3-2.2L9 16.5"/></svg>,
  plane:  (p) => <svg {..._I(p)} fill="currentColor" stroke="none"><path d="M21 15.5 13.5 13V6.5a1.5 1.5 0 0 0-3 0V13L3 15.5V18l7.5-2v3l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l8 2v-2.5Z"/></svg>,
};

/* ---------------------------------------------------------------
   APRON — the bounded play surface. NOTE: the position/size here is an
   ILLUSTRATIVE mockup value, NOT a spec — field-element placement is not a
   requirement (see HANDOFF.md "Layout"); only the HUD and the plane-needs
   info bar are fixed. Planes are confined inside its border; the way out is
   via the RUNWAYS into the open SKY. Three exchangeable treatments (1-3).
   --------------------------------------------------------------- */
const APRON = { x: 56, y: 168, w: 992, h: 658 };   // illustrative only — not a required position/size

function _Beacon({ left, top, color = "phosphor", d = 0 }) {
  return <span style={{ position: "absolute", left, top, width: 10, height: 10, borderRadius: "50%",
    background: N[color], boxShadow: `0 0 14px ${N[color]}`, animation: `nx-pulse 3.2s ease-in-out ${d}s infinite` }}></span>;
}
function edgeLights(A, R, B, c) {
  const out = [], n = 9;
  for (let i = 0; i < n; i++) {
    const x = A.x + 30 + (i * (A.w - 60)) / (n - 1);
    out.push(<span key={"t" + i} style={{ position: "absolute", left: x, top: A.y - 2, width: 4, height: 4, borderRadius: "50%", background: c, boxShadow: `0 0 7px ${c}` }}></span>);
    out.push(<span key={"b" + i} style={{ position: "absolute", left: x, top: B - 2, width: 4, height: 4, borderRadius: "50%", background: c, boxShadow: `0 0 7px ${c}` }}></span>);
  }
  return out;
}
function notchTicks(A, R, B, c) {
  const out = [], n = 14;
  for (let i = 0; i <= n; i++) {
    const x = A.x + (i * A.w) / n;
    out.push(<span key={"nt" + i} style={{ position: "absolute", left: x, top: A.y - 5, width: 2, height: 11, background: c, boxShadow: `0 0 6px ${c}` }}></span>);
    out.push(<span key={"nb" + i} style={{ position: "absolute", left: x, top: B - 6, width: 2, height: 11, background: c, boxShadow: `0 0 6px ${c}` }}></span>);
  }
  return out;
}

function ApronBorder({ A, R, B, variant }) {
  const g = variant === 2 ? "teal" : "phosphor";
  const c = N[g];
  const t = variant === 3 ? 5 : 2.5;
  const line = { background: c, boxShadow: `0 0 14px ${rgba(g, .5)}` };
  return (
    <>
      <div style={{ position: "absolute", left: A.x, top: A.y, width: A.w, height: t, ...line }}></div>
      <div style={{ position: "absolute", left: A.x, top: B - t, width: A.w, height: t, ...line }}></div>
      <div style={{ position: "absolute", left: A.x, top: A.y, width: t, height: A.h, ...line }}></div>
      {/* right side: short stubs top & bottom — middle stays OPEN onto the runways */}
      <div style={{ position: "absolute", left: R - t, top: A.y, width: t, height: 54, ...line }}></div>
      <div style={{ position: "absolute", left: R - t, top: B - 54, width: t, height: 54, ...line }}></div>

      {variant === 1 && edgeLights(A, R, B, c)}
      {variant === 2 && (
        <div style={{ position: "absolute", left: A.x + 12, top: A.y + 12, width: A.w - 24, height: A.h - 24, borderRadius: 4,
          border: `2px dashed ${rgba("gold", .3)}`, borderRight: "none" }}></div>
      )}
      {variant === 3 && notchTicks(A, R, B, c)}
    </>
  );
}

function Apron({ variant = 1 }) {
  const A = APRON, R = A.x + A.w, B = A.y + A.h;
  const skyBg = variant === 2 ? "linear-gradient(180deg,#091228 0%,#0a1430 58%,#06101f 100%)"
    : variant === 3 ? "#060b18" : "#070c1c";
  const surface = variant === 2 ? "linear-gradient(180deg,#0e1a3c,#0b1430)" : "#0c1430";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: skyBg }}>
      {/* ===== EXTERIOR / SKY DECOR ===== */}
      {variant === 1 && <>
        {/* starfield in the sky */}
        {[[1120, 60], [1210, 130], [1320, 70], [1410, 150], [1500, 90], [1180, 220], [1300, 250], [1460, 240], [1540, 180], [1240, 40], [1380, 200], [1520, 300]].map(([l, t], i) => (
          <span key={"st" + i} style={{ position: "absolute", left: l, top: t, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, borderRadius: "50%",
            background: "#cfeaff", opacity: .5, boxShadow: "0 0 5px #cfeaff", animation: `nx-pulse ${4 + (i % 4)}s ease-in-out ${i * 0.4}s infinite` }}></span>
        ))}
        {/* control tower silhouette */}
        <div style={{ position: "absolute", left: R + 300, top: 96, width: 46, height: 120 }}>
          <div style={{ position: "absolute", left: 17, top: 40, width: 12, height: 80, background: "#0b1832", border: `1px solid ${rgba("phosphor", .3)}` }}></div>
          <div style={{ position: "absolute", left: 4, top: 22, width: 38, height: 22, borderRadius: 5, background: "#0e1f44", border: `1.5px solid ${N.phosphor}`, boxShadow: `0 0 12px ${rgba("phosphor", .5)}` }}></div>
          <span style={{ position: "absolute", left: 21, top: 6, width: 4, height: 16, background: N.rose, boxShadow: `0 0 10px ${N.rose}`, animation: "nx-pulse 1.6s ease-in-out infinite" }}></span>
        </div>
        {/* distant skyline + city glow, bottom-right */}
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 470, height: 230,
          background: `radial-gradient(60% 100% at 88% 100%, ${rgba("phosphor", .13)}, transparent 70%)` }}></div>
        {[[1130, 40], [1165, 64], [1205, 30], [1240, 78], [1285, 52], [1330, 70], [1375, 38], [1420, 86], [1470, 56], [1520, 74], [1560, 44]].map(([l, hh], i) => (
          <div key={"bld" + i} style={{ position: "absolute", left: l, bottom: 0, width: 26, height: hh, background: "linear-gradient(180deg,#0c1a38,#091228)", borderTop: `2px solid ${rgba("phosphor", .35)}` }}>
            <span style={{ position: "absolute", left: 6, top: 8, width: 3, height: 3, background: rgba("gold", .8), boxShadow: `0 0 5px ${N.gold}` }}></span>
          </div>
        ))}
        {/* perimeter service vehicles in the bottom margin */}
        {[A.x + 120, A.x + 360, A.x + 620].map((l, i) => (
          <span key={"veh" + i} style={{ position: "absolute", left: l, top: B + 28, width: 7, height: 7, borderRadius: 2, background: N.gold, boxShadow: `0 0 8px ${N.gold}`, animation: `nx-pulse ${3 + i}s ease-in-out ${i * 0.6}s infinite` }}></span>
        ))}
        <_Beacon left={R + 26} top={A.y + 8} d={0} />
        <_Beacon left={R + 26} top={B - 18} color="rose" d={1.2} />
        {/* extra hangar/warehouse silhouettes near the city */}
        {[[R + 250, 30], [R + 360, 24]].map(([l, hh], i) => (
          <div key={"wh" + i} style={{ position: "absolute", left: l, bottom: 0, width: 70, height: hh + 28, background: "linear-gradient(180deg,#0b1832,#091228)", borderTop: `2px solid ${rgba("phosphor", .3)}`, borderRadius: "6px 6px 0 0" }}></div>
        ))}
      </>}
      {variant === 2 && <>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ position: "absolute", left: R + 28, right: 22, top: 150 + i * 96, height: 2,
            background: `linear-gradient(90deg, transparent, ${rgba("teal", .26)}, transparent)`,
            animation: `nx-breath ${5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}></div>
        ))}
        {/* control tower silhouette outside, top-right */}
        <div style={{ position: "absolute", left: R + 64, top: 14, width: 56, height: 90 }}>
          <div style={{ position: "absolute", left: 21, top: 32, width: 14, height: 56, background: "#0c1a38", border: `1px solid ${rgba("teal", .4)}` }}></div>
          <div style={{ position: "absolute", left: 8, top: 14, width: 40, height: 23, borderRadius: 6, background: "#10224a", border: `1.5px solid ${N.teal}`, boxShadow: `0 0 12px ${rgba("teal", .5)}` }}></div>
          <span style={{ position: "absolute", left: 27, top: 0, width: 4, height: 15, background: N.teal, boxShadow: `0 0 10px ${N.teal}` }}></span>
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, width: 380, bottom: 0, background: `linear-gradient(90deg, transparent, ${rgba("teal", .06)})` }}></div>
      </>}
      {variant === 3 && <>
        <div style={{ position: "absolute", left: R, right: 0, top: 0, bottom: 0, opacity: .5,
          backgroundImage: `linear-gradient(${rgba("phosphor", .06)} 1px, transparent 1px), linear-gradient(90deg, ${rgba("phosphor", .06)} 1px, transparent 1px)`,
          backgroundSize: "40px 40px" }}></div>
        <div style={{ position: "absolute", left: R + 250, top: 56, width: 62, height: 62, borderRadius: "50%",
          border: `2px solid ${rgba("phosphor", .5)}`, transform: "rotate(-25deg)", boxShadow: `0 0 14px ${rgba("phosphor", .3)}` }}></div>
        <div style={{ position: "absolute", left: R + 150, top: 120, bottom: 120, width: 2, background: rgba("phosphor", .35) }}></div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: R + 40 + i * 16, top: 440, width: 14, height: 14,
            borderLeft: `3px solid ${rgba("phosphor", .5 - i * 0.12)}`, borderBottom: `3px solid ${rgba("phosphor", .5 - i * 0.12)}`, transform: "rotate(45deg)" }}></div>
        ))}
        {[[R + 320, 200], [R + 200, 520], [R + 120, 300], [R + 360, 560]].map(([l, top], i) => (
          <span key={i} style={{ position: "absolute", left: l, top, width: 6, height: 6, borderRadius: "50%", background: N.phosphor, boxShadow: `0 0 10px ${N.phosphor}`, animation: `nx-pulse 4s ease-in-out ${i * 0.5}s infinite` }}></span>
        ))}
      </>}

      {/* ===== APRON SURFACE ===== */}
      <div style={{ position: "absolute", left: A.x, top: A.y, width: A.w, height: A.h, background: surface, overflow: "hidden" }}>
        {variant === 1 && <>
          <div style={{ position: "absolute", inset: 0, opacity: .6,
            backgroundImage: `linear-gradient(${rgba("phosphor", .045)} 1px, transparent 1px), linear-gradient(90deg, ${rgba("phosphor", .045)} 1px, transparent 1px)`,
            backgroundSize: "58px 58px" }}></div>
          {[120, 230, 340].map((r, i) => (
            <div key={i} style={{ position: "absolute", left: "42%", top: "50%", width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r,
              borderRadius: "50%", border: `1px solid ${rgba("phosphor", .08)}` }}></div>
          ))}
        </>}
        {variant === 2 && (
          <div style={{ position: "absolute", left: 40, right: 40, top: "50%", height: 3, transform: "translateY(-50%)",
            backgroundImage: `repeating-linear-gradient(90deg, ${rgba("gold", .3)} 0 26px, transparent 26px 52px)` }}></div>
        )}
        {variant === 3 && <>
          <div style={{ position: "absolute", inset: 0, opacity: .5,
            backgroundImage: `repeating-linear-gradient(0deg, ${rgba("phosphor", .05)} 0 1px, transparent 1px 5px)` }}></div>
          <div style={{ position: "absolute", inset: 0, opacity: .5,
            backgroundImage: `radial-gradient(${rgba("phosphor", .08)} 1.5px, transparent 1.6px)`, backgroundSize: "46px 46px" }}></div>
        </>}
      </div>

      {/* ===== BORDER (top/left/bottom solid; right open onto runways) ===== */}
      <ApronBorder A={A} R={R} B={B} variant={variant} />
    </div>
  );
}

/* ---------------------------------------------------------------
   SERVICE BAY — the hero asset. Glossy dimensional panel, neon rim
   with real bloom, top sheen, inner shadow (matches ref-01). The
   icon / label / cost shown here is what the engine overlays live.
   --------------------------------------------------------------- */
function Bay({ x, y, w = 150, h = 88, service, cost, locked, dim }) {
  const meta = SVC[service] || SVC.repair;
  const c = locked ? N.locked : N[meta.color];
  const gk = locked ? null : meta.color;
  const Ico = locked ? NIcon.lock : NIcon[service];
  return (
    <div className="nx-bay" style={{ position: "absolute", left: x, top: y, width: w, height: h,
      "--c": c, "--g": locked ? "rgba(95,123,176,.28)" : rgba(gk, .5), opacity: dim ? .9 : 1 }}>
      <div className="nx-bay__in">
        {/* icon chip */}
        <div className="nx-chip" style={{ "--c": c, "--g": locked ? "rgba(95,123,176,.3)" : rgba(gk, .55), color: c }}>
          <Ico width={locked ? 22 : 24} height={locked ? 22 : 24} />
        </div>
        {locked ? (
          <div className="nx-cost">
            <span style={{ color: N.gold, display: "inline-flex" }}><NIcon.coin width={14} height={14} /></span>
            <span style={{ color: N.body }}>{cost}</span>
          </div>
        ) : (
          <div className="nx-bay__txt">
            <div className="nx-bay__lbl" style={{ color: N.paper }}>{meta.label}</div>
            <div className="nx-bay__cost" style={{ color: c }}>{cost}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   RUNWAY — dark rounded strip, colour-coded neon edge lights,
   dashed centreline, runway number. On the RIGHT (locked).
   --------------------------------------------------------------- */
function Runway({ x, y, w = 348, h = 62, num, tone }) {
  const c = N[tone];
  const lamps = 9;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      <div className="nx-rwy" style={{ "--c": c, "--g": rgba(tone, .4), width: "100%", height: "100%" }}>
        {/* number */}
        <div className="nx-rwy__num" style={{ color: c, textShadow: `0 0 12px ${rgba(tone,.7)}` }}>{num}</div>
        {/* dashed centreline */}
        <div style={{ position: "absolute", left: 40, right: 16, top: "50%", height: 3, transform: "translateY(-50%)",
          backgroundImage: `repeating-linear-gradient(90deg, ${rgba(tone,.85)} 0 22px, transparent 22px 42px)` }}></div>
        {/* edge lights */}
        {Array.from({ length: lamps }).map((_, i) => {
          const left = 36 + (i * (w - 56)) / (lamps - 1);
          return (
            <React.Fragment key={i}>
              <span className="nx-lamp" style={{ left, top: 7, background: c, boxShadow: `0 0 8px ${c}` }}></span>
              <span className="nx-lamp" style={{ left, bottom: 7, background: c, boxShadow: `0 0 8px ${c}` }}></span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PLANE — glossy light body, colour-coded nose/livery, neon outline
   + soft glow. Small (≥10 fit the field with room to manoeuvre).
   rot: 0 = nose UP. Arrives from the RIGHT.
   --------------------------------------------------------------- */
function Plane({ x, y, size = 44, tone = "phosphor", rot = 0, anim, sel }) {
  const c = N[tone];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, transform: `rotate(${rot}deg)`,
      animation: anim ? `${anim} 6s ease-in-out infinite` : "none" }}>
      {sel && <div className="nx-ring" style={{ "--c": N.phosphor, "--g": rgba("phosphor", .6) }}></div>}
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ overflow: "visible", filter: `drop-shadow(0 0 7px ${rgba(tone,.6)})` }}>
        <defs>
          <linearGradient id={`pg-${tone}-${x}-${y}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#cfe6f5"/>
          </linearGradient>
        </defs>
        {/* body */}
        <path d="M32 4c3 0 5 4 5.4 10l.3 12 16 11v6l-16-5 .1 9 5 4v4l-9-2.4-9 2.4v-4l5-4 .1-9-16 5v-6l16-11 .3-12C27 8 29 4 32 4Z"
          fill={`url(#pg-${tone}-${x}-${y})`} stroke={c} strokeWidth="2.4" strokeLinejoin="round"/>
        {/* nose livery */}
        <path d="M32 4c3 0 5 4 5.4 10H26.6C27 8 29 4 32 4Z" fill={c}/>
        {/* cockpit */}
        <circle cx="32" cy="15" r="2.4" fill="#0a1430" opacity=".55"/>
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   ROUTE — glowing cyan path with a soft halo; finger cursor at the
   live end. SVG over the field (1600x900 viewBox).
   --------------------------------------------------------------- */
function Route({ d, end }) {
  return (
    <>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <path d={d} fill="none" stroke={rgba("phosphor", .9)} strokeWidth="6" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 9px ${N.phosphor})` }} />
        <path d={d} fill="none" stroke="#eaffff" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 26"
          style={{ animation: "nx-flow 1.1s linear infinite" }} />
      </svg>
      {/* tap pulse + finger */}
      <div style={{ position: "absolute", left: end[0], top: end[1], width: 0, height: 0 }}>
        <div className="nx-tap" style={{ "--c": N.phosphor }}></div>
        <div style={{ position: "absolute", left: 6, top: 6, color: "#f3d9c0", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))", animation: "nx-finger 2.6s ease-in-out infinite" }}>
          <svg width="58" height="64" viewBox="0 0 58 64" fill="none">
            <path d="M20 26V12a6 6 0 0 1 12 0v18m0-6a5 5 0 0 1 10 0v6m0-3a5 5 0 0 1 9 0v12c0 9-6 16-16 16h-3c-5 0-9-2-12-6l-7-9a5 5 0 0 1 7.5-6.6L20 38"
              fill="#ffe4cf" stroke="#caa488" strokeWidth="2.4" strokeLinejoin="round"/>
            <rect x="14" y="54" width="34" height="9" rx="3" fill="#2a4a86"/>
          </svg>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   UPGRADE DOTS — capacity pips. Filled = bought (glowing), empty = available.
   --------------------------------------------------------------- */
function UpgradeDots({ total, filled, big }) {
  const d = big ? 10 : 9;
  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "3px 8px", borderRadius: 999,
      background: "rgba(8,14,30,.72)", border: "1px solid rgba(58,210,255,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < filled;
        return <span key={i} style={{ width: d, height: d, borderRadius: "50%",
          background: on ? N.green : "rgba(7,12,28,.6)",
          border: `1.6px solid ${on ? N.green : "rgba(150,180,220,.5)"}`,
          boxShadow: on ? `0 0 7px ${rgba("green", .7)}` : "none" }}></span>;
      })}
    </div>
  );
}
const UpArrow = (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>;

/* ---------------------------------------------------------------
   BAY2 — the full service-bay state machine (3 services: fuel / repair /
   people). Locked or bought; bought bays open to a TOP-DOWN view that
   shows the plane inside. Carries upgrade-capacity dots + affordability.
   Pass x/y for absolute placement on the field, omit for inline (gallery).
   props: service · locked · affordable · plane(tone|true|null) · price
          · dotsTotal · dotsFilled · w · h
   --------------------------------------------------------------- */
/* open-side helpers: which wall is missing + which way the plane faces */
const _sideKey = (s) => ({ top: "borderTop", right: "borderRight", bottom: "borderBottom", left: "borderLeft" }[s]);
const _openOf = { top: "bottom", bottom: "top", left: "right", right: "left" };
const _planeRot = { top: 0, bottom: 180, left: 270, right: 90 };
const _radiusFor = { bottom: "13px 13px 0 0", top: "0 0 13px 13px", right: "13px 0 0 13px", left: "0 13px 13px 0" };

/* lead-in chevrons (no positioning) pointing OUT through the opening */
function Chevrons({ openSide, c }) {
  const rot = { top: -90, bottom: 90, left: 180, right: 0 }[openSide];
  const col = openSide === "left" || openSide === "right";
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", flexDirection: col ? "column" : "row" }}>
      {[0, 1].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: `rotate(${rot}deg)`, opacity: .55 + i * 0.3, filter: `drop-shadow(0 0 4px ${c})` }}><path d="M9 6l6 6-6 6"/></svg>
      ))}
    </div>
  );
}
function LeadIn({ openSide, c }) {
  const place = {
    bottom: { left: "50%", bottom: 3, transform: "translateX(-50%)" },
    top:    { left: "50%", top: 3, transform: "translateX(-50%)" },
    left:   { left: 3, top: "50%", transform: "translateY(-50%)" },
    right:  { right: 3, top: "50%", transform: "translateY(-50%)" },
  }[openSide];
  return <div style={{ position: "absolute", ...place }}><Chevrons openSide={openSide} c={c} /></div>;
}

/* back-wall overlay: BIG opaque service badge + capacity dots (in the wall)
   + upgrade chip unless MAXED (at max the buy icon disappears). The badge
   sits in the back-wall corner = the `edge` side, LEFT. */
function BayOverlay({ Ico, c, gk, affordable, dotsTotal, dotsFilled, edge }) {
  const maxed = dotsFilled >= dotsTotal;
  const horiz = edge === "top" || edge === "bottom";
  return (
    <>
      <div style={{ position: "absolute", width: 40, height: 40, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 6,
        background: "#0c1736", border: `2px solid ${c}`, boxShadow: `0 0 12px ${rgba(gk, .55)}, inset 0 1px 0 rgba(255,255,255,.18)`, color: c,
        ...(horiz ? { [edge]: 7, left: 7 } : { [edge]: 7, top: 7 }) }}>
        <Ico width={24} height={24} />
      </div>
      {!maxed && (
        <div style={{ position: "absolute", width: 30, height: 30, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 6,
          color: affordable ? N.green : N.muted, background: affordable ? rgba("green", .18) : "#0c1736",
          border: `1.5px solid ${affordable ? N.green : "rgba(95,123,176,.4)"}`, boxShadow: affordable ? `0 0 11px ${rgba("green", .5)}` : "none",
          ...(horiz ? { [edge]: 7, right: 7 } : { [edge]: 7, bottom: 7 }) }}>
          <UpArrow s={18} />
        </div>
      )}
      <div style={{ position: "absolute", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6,
        ...(horiz ? { [edge]: 9, left: 54, right: 54 } : { [edge]: 9, top: 54, bottom: 54 }) }}>
        <UpgradeDots total={dotsTotal} filled={dotsFilled} color={c} vertical={!horiz} big />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   BAY2 — service bay (fuel / repair / people). Combined GLASS + HANGAR
   look: extruded glossy walls with neon rim + sheen, recessed glossy floor.
   A bought bay drops the wall facing the apron (mirrored per `edge`) so the
   plane is seen taxiing in, nosed toward the exit. Icons live on the BACK
   wall (the `edge` side). pscale controls plane size (ground scale).
   props: service · edge(top|bottom|left|right) · locked · affordable
          · plane(tone|true|null) · price · dotsTotal · dotsFilled · pscale
   --------------------------------------------------------------- */
function Bay2({ x, y, w = 168, h = 126, service = "fuel", edge = "top",
  locked = false, affordable = false, plane = null, price = "5,000", dotsTotal = 3, dotsFilled = 0, pscale = 44 }) {
  const meta = SVC[service] || SVC.fuel;
  const c = N[meta.color], gk = meta.color;
  const Ico = NIcon[service];
  const pos = x === undefined ? { position: "relative" } : { position: "absolute", left: x, top: y };
  const openSide = _openOf[edge];

  /* ---- LOCKED (closed, all walls) ---- */
  if (locked) {
    const oc = affordable ? N.green : N.locked;
    const og = affordable ? rgba("green", .5) : "rgba(95,123,176,.22)";
    return (
      <div style={{ ...pos, width: w, height: h, borderRadius: 12,
        background: "linear-gradient(168deg, #101a36, #0a1430 70%, #070e22)",
        border: `2px ${affordable ? "dashed" : "solid"} ${oc}`,
        boxShadow: `0 0 ${affordable ? 18 : 7}px ${og}, inset 0 0 26px rgba(2,6,20,.6), inset 0 1px 0 rgba(255,255,255,.07)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: affordable ? 1 : .92 }}>
        <div style={{ color: oc, filter: affordable ? `drop-shadow(0 0 9px ${oc})` : "none" }}><NIcon.lock width={42} height={42} /></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999,
          background: affordable ? rgba("green", .16) : "rgba(95,123,176,.12)",
          border: `1.5px solid ${affordable ? N.green : "rgba(95,123,176,.34)"}`,
          boxShadow: affordable ? `0 0 13px ${rgba("green", .42)}` : "none" }}>
          <span style={{ color: affordable ? N.gold : N.muted, display: "inline-flex" }}><NIcon.coin width={20} height={20} /></span>
          <span style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 20, color: affordable ? "#d6ffe6" : N.muted }}>{price}</span>
        </div>
      </div>
    );
  }

  /* ---- OPEN (bought) — glass-hangar, top-down ---- */
  const horiz = edge === "top" || edge === "bottom";
  const wt = 13;
  const wallBg = `linear-gradient(${horiz ? "180deg" : "90deg"}, #22355f, #16254c 55%, #0d1b3c)`;
  const back = { top: { left: 0, top: 0, width: "100%", height: wt }, bottom: { left: 0, bottom: 0, width: "100%", height: wt },
    left: { left: 0, top: 0, width: wt, height: "100%" }, right: { right: 0, top: 0, width: wt, height: "100%" } }[edge];
  const sideWalls = horiz
    ? [{ left: 0, top: 0, width: wt, height: "100%" }, { right: 0, top: 0, width: wt, height: "100%" }]
    : [{ left: 0, top: 0, width: "100%", height: wt }, { left: 0, bottom: 0, width: "100%", height: wt }];
  const planeEl = plane && (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 2 }}>
      <Plane x={-pscale / 2} y={-pscale / 2} size={pscale} tone={typeof plane === "string" ? plane : gk} rot={_planeRot[openSide]} />
    </div>
  );
  return (
    <div style={{ ...pos, width: w, height: h, borderRadius: _radiusFor[openSide],
      background: `radial-gradient(120% 100% at 50% 40%, ${rgba(gk, .12)}, #0a1430 74%)`,
      boxShadow: `0 0 16px ${rgba(gk, .4)}, 0 10px 22px rgba(2,6,20,.55)` }}>
      {/* recessed glossy floor */}
      <div style={{ position: "absolute", inset: wt, borderRadius: 6, overflow: "hidden", boxShadow: "inset 0 6px 16px rgba(2,6,20,.5)" }}>
        <div style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 2, transform: "translateX(-50%)",
          backgroundImage: `repeating-linear-gradient(180deg, ${rgba(gk, .35)} 0 8px, transparent 8px 16px)` }}></div>
      </div>
      {planeEl}
      {/* back wall (roof-edge highlight) — glass gradient + neon rim + sheen */}
      <div style={{ position: "absolute", ...back, background: wallBg, borderRadius: 4,
        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.32), inset 0 0 10px ${rgba(gk, .3)}, 0 0 13px ${rgba(gk, .5)}` }}></div>
      {/* two side walls */}
      {sideWalls.map((s, i) => (
        <div key={i} style={{ position: "absolute", ...s, background: wallBg,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.2), 0 0 9px ${rgba(gk, .34)}` }}></div>
      ))}
      <LeadIn openSide={openSide} c={c} />
      <BayOverlay Ico={Ico} c={c} gk={gk} affordable={affordable} dotsTotal={dotsTotal} dotsFilled={dotsFilled} edge={edge} />
    </div>
  );
}

/* ---------------------------------------------------------------
   LONG HANGAR — the bays read as ONE continuous hangar with several
   drive-in stalls separated by WALLS. Each stall is sized so a plane can
   rotate around its axis after service (dashed turn-circle shown) and back
   out. Between stalls sit small SERVICE ROOMS (staff modules). Five
   exchangeable render styles (HSTYLE 1-5). Horizontal (edge top | bottom).
   --------------------------------------------------------------- */
const HSTYLE = {
  1: { name: "Sawtooth", radius: 8, glow: "phosphor", roof: "sawtooth",
       floor: `radial-gradient(120% 90% at 50% 45%, ${rgba("phosphor", .06)}, #0a1430 80%)`,
       wall: { background: "linear-gradient(180deg,#22355f,#16254c 55%,#0d1b3c)", boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.3), 0 0 12px ${rgba("phosphor", .45)}` },
       divider: "wall" },
  2: { name: "Gantry", radius: 6, glow: "amber", roof: "gantry",
       floor: "linear-gradient(180deg,#1b1e30,#0e1020)",
       wall: { backgroundImage: "repeating-linear-gradient(90deg,#2b2e46 0 6px,#1f2338 6px 12px)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), 0 0 10px ${rgba("amber", .35)}` },
       divider: "room" },
  3: { name: "Quonset", radius: 8, glow: "teal", roof: "ribs",
       floor: `radial-gradient(120% 90% at 50% 45%, ${rgba("teal", .07)}, #0a1430 80%)`,
       wall: { background: "linear-gradient(180deg,#1c3550,#0c1b2e)", boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.26), 0 0 12px ${rgba("teal", .45)}` },
       divider: "wall" },
  4: { name: "Pier", radius: 6, glow: "ice", roof: "mullion", bridge: true,
       floor: "linear-gradient(180deg,#101d3a,#0b1530)",
       wall: { background: "linear-gradient(180deg,#24406b,#0d1b38)", boxShadow: `inset 0 2px 0 rgba(255,255,255,.32), 0 0 13px ${rgba("ice", .5)}` },
       divider: "wall" },
  5: { name: "Container", radius: 4, glow: "phosphor", roof: "none", header: true,
       floor: "#0a1228",
       wall: { background: "linear-gradient(180deg,#1c2d52,#101e3e)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 10px ${rgba("phosphor", .35)}` },
       divider: "wall" },
};

function ServiceDivider({ style, at, wt, isTop }) {
  const sd = HSTYLE[style];
  if (sd.divider === "room") {
    const rw = 32, rh = 30;
    return (
      <>
        <div style={{ position: "absolute", left: at - 3, width: 6, ...(isTop ? { top: 0, bottom: 6 } : { bottom: 0, top: 6 }), ...sd.wall }}></div>
        <div style={{ position: "absolute", left: at - rw / 2, width: rw, ...(isTop ? { top: 0 } : { bottom: 0 }), height: rh, borderRadius: 4, zIndex: 7,
          background: "#0e1d3e", border: `1.5px solid ${rgba(sd.glow, .6)}`, boxShadow: `0 0 8px ${rgba(sd.glow, .4)}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <span style={{ width: 9, height: 7, borderRadius: 2, background: rgba(sd.glow, .55), boxShadow: `0 0 6px ${rgba(sd.glow, .6)}` }}></span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: N.gold, boxShadow: `0 0 5px ${N.gold}` }}></span>
        </div>
      </>
    );
  }
  if (sd.divider === "pod") return <div style={{ position: "absolute", left: at - 8, width: 16, ...(isTop ? { top: wt, bottom: wt } : { bottom: wt, top: wt }), borderRadius: 6, ...sd.wall }}></div>;
  if (sd.divider === "wire") return <div style={{ position: "absolute", left: at - 1, width: 2, ...(isTop ? { top: 0, bottom: 6 } : { bottom: 0, top: 6 }), background: rgba("phosphor", .5), boxShadow: `0 0 8px ${rgba("phosphor", .4)}` }}></div>;
  return <div style={{ position: "absolute", left: at - 8, width: 16, ...(isTop ? { top: 0, bottom: 6 } : { bottom: 0, top: 6 }), ...sd.wall }}></div>;
}

function LongHangar({ x, y, w, h, edge = "top", style = 1, stalls, pscale = 44 }) {
  const openSide = _openOf[edge];
  const n = stalls.length, cellW = w / n, wt = 16, isTop = edge === "top";
  const sd = HSTYLE[style];
  const pos = x === undefined ? { position: "relative" } : { position: "absolute", left: x, top: y };
  const back = isTop ? { left: 0, top: 0, width: "100%", height: wt } : { left: 0, bottom: 0, width: "100%", height: wt };
  return (
    <div style={{ ...pos, width: w, height: h, borderRadius: sd.radius, overflow: "hidden",
      background: sd.floor, boxShadow: `0 0 18px ${rgba(sd.glow, .3)}, 0 12px 26px rgba(2,6,20,.5)` }}>
      {sd.underlay && sd.underlay()}
      <div style={{ position: "absolute", ...back, ...sd.wall }}></div>
      {/* roof / back-wall treatment per style */}
      {sd.roof === "sawtooth" && <div style={{ position: "absolute", left: 0, width: "100%", ...(isTop ? { top: 0 } : { bottom: 0 }), height: wt, backgroundImage: `repeating-linear-gradient(135deg, ${rgba(sd.glow, .5)} 0 5px, transparent 5px 13px)` }}></div>}
      {sd.roof === "gantry" && [0, 1].map((k) => <div key={"g" + k} style={{ position: "absolute", left: wt, right: wt, ...(isTop ? { top: wt + 8 + k * 11 } : { bottom: wt + 8 + k * 11 }), height: 2, background: rgba(sd.glow, .4), boxShadow: `0 0 6px ${rgba(sd.glow, .4)}` }}></div>)}
      {sd.roof === "ribs" && <div style={{ position: "absolute", inset: wt, opacity: .4, backgroundImage: `repeating-linear-gradient(90deg, ${rgba(sd.glow, .4)} 0 2px, transparent 2px 28px)` }}></div>}
      {sd.roof === "mullion" && <div style={{ position: "absolute", left: 0, width: "100%", ...(isTop ? { top: 0 } : { bottom: 0 }), height: wt, backgroundImage: `repeating-linear-gradient(90deg, ${rgba(sd.glow, .4)} 0 1.5px, transparent 1.5px 22px)` }}></div>}
      <div style={{ position: "absolute", left: 0, top: 0, width: wt, height: "100%", ...sd.wall }}></div>
      <div style={{ position: "absolute", right: 0, top: 0, width: wt, height: "100%", ...sd.wall }}></div>
      {Array.from({ length: n - 1 }).map((_, i) => <ServiceDivider key={"d" + i} style={style} at={(i + 1) * cellW} wt={wt} isTop={isTop} />)}
      {stalls.map((s, i) => {
        const meta = SVC[s.service] || SVC.fuel; const c = N[meta.color], gk = meta.color; const Ico = NIcon[s.service];
        const cx = i * cellW + cellW / 2;
        const maxed = (s.dotsFilled || 0) >= (s.dotsTotal || 3);
        return (
          <React.Fragment key={i}>
            {/* stand floor marking — lead-in line + stop bar (no circle) */}
            <div style={{ position: "absolute", left: cx - 1, ...(isTop ? { top: wt } : { bottom: wt }), width: 2, height: h - 2 * wt, background: rgba(gk, .24) }}></div>
            <div style={{ position: "absolute", left: cx - 16, ...(isTop ? { top: Math.round(h * 0.54) } : { bottom: Math.round(h * 0.54) }), width: 32, height: 2, background: rgba(gk, .24) }}></div>
            {sd.header && <div style={{ position: "absolute", left: i * cellW + wt, width: cellW - 2 * wt, ...(isTop ? { top: 0 } : { bottom: 0 }), height: wt, background: rgba(gk, .5), boxShadow: `0 0 8px ${rgba(gk, .5)}`, zIndex: 1 }}></div>}
            {sd.bridge && !s.locked && <div style={{ position: "absolute", left: cx - 8, ...(isTop ? { top: wt } : { bottom: wt }), width: 16, height: 20, background: "linear-gradient(180deg,#24406b,#0d1b38)", border: `1px solid ${rgba(gk, .5)}`, borderRadius: 3, zIndex: 1 }}></div>}
            {s.locked ? (
              <div style={{ position: "absolute", left: cx, top: h / 2, transform: "translate(-50%,-50%)", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "9px 12px", borderRadius: 12, background: "#0a1326", border: `1.5px solid ${s.affordable ? rgba("green", .45) : "rgba(95,123,176,.32)"}`, boxShadow: "0 6px 16px rgba(2,6,20,.7)", color: s.affordable ? N.green : N.locked }}>
                <NIcon.lock width={32} height={32} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "#0c1736", border: `1.5px solid ${s.affordable ? N.green : "rgba(95,123,176,.4)"}` }}>
                  <span style={{ color: s.affordable ? N.gold : N.muted, display: "inline-flex" }}><NIcon.coin width={17} height={17} /></span>
                  <span style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 17, color: s.affordable ? "#d6ffe6" : N.muted }}>{s.price}</span>
                </div>
              </div>
            ) : (
              s.plane && <div style={{ position: "absolute", left: cx, top: h / 2, transform: "translate(-50%,-50%)", zIndex: 2 }}>
                <Plane x={-pscale / 2} y={-pscale / 2} size={pscale} tone={typeof s.plane === "string" ? s.plane : gk} rot={_planeRot[openSide]} /></div>
            )}
            {/* BIG opaque service badge — back-wall LEFT corner (+20%) */}
            <div style={{ position: "absolute", left: i * cellW + 8, ...(isTop ? { top: 5 } : { bottom: 5 }), width: 44, height: 44, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 8,
              background: "#0c1736", border: `2px solid ${c}`, boxShadow: `0 0 12px ${rgba(gk, .55)}, inset 0 1px 0 rgba(255,255,255,.18)`, color: c }}><Ico width={27} height={27} /></div>
            {/* upgrade chip — back-wall RIGHT corner (gone when maxed) */}
            {!s.locked && !maxed && <div style={{ position: "absolute", left: i * cellW + cellW - 34, ...(isTop ? { top: 7 } : { bottom: 7 }), width: 26, height: 26, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 8,
              color: s.affordable ? N.green : N.muted, background: s.affordable ? rgba("green", .18) : "#0c1736", border: `1.5px solid ${s.affordable ? N.green : "rgba(95,123,176,.4)"}`, boxShadow: s.affordable ? `0 0 10px ${rgba("green", .5)}` : "none" }}><UpArrow s={15} /></div>}
            {/* upgrade dots — green=bought / empty=available, in a rounded plaque centred on the wall */}
            {!s.locked && <div style={{ position: "absolute", left: i * cellW + 56, width: cellW - 100, ...(isTop ? { top: 5 } : { bottom: 5 }), display: "flex", justifyContent: "center", zIndex: 8 }}>
              <UpgradeDots total={s.dotsTotal || 3} filled={s.dotsFilled || 0} big /></div>}
            {/* lead-in chevrons at the open side */}
            {!s.locked && <div style={{ position: "absolute", left: i * cellW, width: cellW, ...(openSide === "bottom" ? { bottom: 3 } : { top: 3 }), display: "flex", justifyContent: "center", zIndex: 3 }}>
              <Chevrons openSide={openSide} c={c} /></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, { N, GLOW, rgba, SVC, NIcon, Apron, APRON, Bay, Bay2, LongHangar, HSTYLE, UpgradeDots, LeadIn, Chevrons, Runway, Plane, Route });

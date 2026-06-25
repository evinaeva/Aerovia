/* PlaneFlow — NEON re-skin · HUD layer
   neon-hud.jsx — the FIXED HUD set only (lives · money · timer · level/goal ·
   pause · active-plane needs+patience card · action buttons). No invented
   panels. Plus the assembled GameWindow and the token/spec strip.
   Depends on neon-field.jsx. */

/* ---- a HUD stat: glossy icon chip + big neon numeral (no caption) ---- */
function Stat({ icon, value, tone }) {
  const c = N[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div className="nx-chip nx-chip--lg" style={{ "--c": c, "--g": rgba(tone, .55), color: c }}>{icon}</div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 30, color: N.paper, lineHeight: 1, textShadow: `0 0 12px ${rgba(tone,.45)}` }}>{value}</div>
    </div>
  );
}
const VSep = () => <span style={{ width: 1, height: 42, background: rgba("phosphor", .16) }}></span>;

function Hearts({ n = 3, max = 3 }) {
  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ display: "inline-flex", color: i < n ? N.life : rgba("life", .22),
          filter: i < n ? `drop-shadow(0 0 6px ${N.life})` : "none" }}><NIcon.heart width={26} height={26} /></span>
      ))}
    </div>
  );
}

/* ---- top HUD bar: hearts/credits/goal LEFT, match-duration (number only)
   + pause RIGHT. Pause inset from the corner so the phone's rounded
   bezel/case can't clip it. ---- */
function TopHUD() {
  return (
    <div className="nx-hudbar" style={{ position: "absolute", left: 18, right: 18, top: 16, height: 76 }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 26, padding: "0 30px 0 26px" }}>
        <Hearts n={3} />
        <VSep />
        <Stat icon={<NIcon.coin width={22} height={22} />} value="28,450" tone="gold" />
        <VSep />
        <Stat icon={<NIcon.goal width={22} height={22} />} value="12 / 16" tone="purple" />
        <div style={{ flex: 1 }}></div>
        {/* current match duration — number only */}
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 32, color: N.paper, lineHeight: 1, textShadow: `0 0 12px ${rgba("phosphor", .45)}` }}>02:35</div>
        <Fab icon={<NIcon.pause width={24} height={24} />} tone="phosphor" size={54} />
      </div>
    </div>
  );
}

/* round glossy action / control button (pause + service FABs) */
function Fab({ icon, tone = "phosphor", size = 58, active }) {
  const c = N[tone];
  return (
    <button className="nx-fab pf-btn" style={{ "--c": c, "--g": rgba(tone, active ? .7 : .45), width: size, height: size, color: c }}>
      {icon}
    </button>
  );
}

/* ---- active-plane card: TOP-LEFT, shown only on tap. Ordered service
   needs (small icons, in a row) ABOVE the patience countdown. 3 services. ---- */
function NeedPip({ service, state }) {
  const meta = SVC[service];
  const c = N[meta.color];
  const Ico = NIcon[service];
  const done = state === "done";
  return (
    <div title={meta.label} style={{ width: 32, height: 32, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: done ? N.muted : c, background: done ? "rgba(95,123,176,.12)" : rgba(meta.color, .14),
      border: `1.5px solid ${done ? "rgba(95,123,176,.3)" : c}`,
      boxShadow: done ? "none" : `0 0 10px ${rgba(meta.color, .4)}, inset 0 0 8px ${rgba(meta.color, .15)}`,
      opacity: done ? .5 : 1, position: "relative", flex: "0 0 auto" }}>
      <Ico width={17} height={17} />
      {done && <span style={{ position: "absolute", right: -3, bottom: -3, width: 13, height: 13, borderRadius: "50%", background: N.green,
        color: "#05140d", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>✓</span>}
    </div>
  );
}
const Chev = () => <span style={{ color: N.muted, opacity: .55, fontWeight: 800, fontSize: 12 }}>›</span>;

/* needs row (ordered) — shared by all info variants */
function NeedsRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <NeedPip service="repair" state="done" />
      <Chev />
      <NeedPip service="fuel" state="active" />
      <Chev />
      <NeedPip service="board" state="todo" />
    </div>
  );
}
function TimePill() {
  const tone = "gold", c = N[tone];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 13px", borderRadius: 11,
      background: rgba(tone, .12), border: `1.5px solid ${c}`, boxShadow: `0 0 12px ${rgba(tone, .35)}` }}>
      <span style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 20, color: c }}>0:18</span>
    </div>
  );
}

/* active-plane info block — TOP-LEFT on tap. 3 layout variants. */
function PlaneCard({ x, y, variant = 1 }) {
  if (variant === 2) {                       // inline bar
    return (
      <div className="nx-card" style={{ position: "absolute", left: x, top: y, "--c": N.phosphor, "--g": rgba("phosphor", .4) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NeedsRow />
          <div style={{ width: 1, alignSelf: "stretch", background: rgba("phosphor", .16) }}></div>
          <TimePill />
        </div>
      </div>
    );
  }
  if (variant === 3) {                       // detailed (chip + id + type)
    return (
      <div className="nx-card" style={{ position: "absolute", left: x, top: y, width: 248, "--c": N.phosphor, "--g": rgba("phosphor", .4) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="nx-chip" style={{ width: 34, height: 34, "--c": N.phosphor, "--g": rgba("phosphor", .5), color: N.phosphor }}><NIcon.plane width={19} height={19} /></div>
            <div style={{ lineHeight: 1.12 }}>
              <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 18, color: N.paper }}>AV&nbsp;204</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11.5, color: N.muted, marginTop: 2 }}>Jet&nbsp;·&nbsp;inbound</div>
            </div>
          </div>
          <TimePill />
        </div>
        <div style={{ height: 1, background: rgba("phosphor", .14), margin: "11px 0 10px" }}></div>
        <NeedsRow />
      </div>
    );
  }
  return (                                    // variant 1 — mini (needs over time)
    <div className="nx-card" style={{ position: "absolute", left: x, top: y, "--c": N.phosphor, "--g": rgba("phosphor", .4) }}>
      <NeedsRow />
      <div style={{ height: 1, background: rgba("phosphor", .14), margin: "10px 0 9px" }}></div>
      <TimePill />
    </div>
  );
}

/* ===============================================================
   GAME WINDOW — bounded APRON; the bays are TWO long hangars spanning the
   apron's left edge to the runway approach. Runways (3, shorter) bridge the
   apron edge to the SKY. Hangar render style + info block are switchable.
   plane scale: hangar == apron ground (P); airborne planes bigger (AIR).
   =============================================================== */
function GameWindow({ hangar = 1, info = 2 }) {
  const P = 44, AIR = 60;
  return (
    <div className="nx-frame">
      <Apron variant={1} />

      {/* TOP hangar — flush with apron top edge, opening DOWN, 5 one-plane stalls */}
      <LongHangar x={56} y={168} w={804} h={92} edge="top" style={hangar} pscale={P}
        stalls={[
          { service: "fuel", plane: "teal", dotsTotal: 4, dotsFilled: 2, affordable: true },
          { service: "repair", dotsTotal: 3, dotsFilled: 1 },
          { service: "board", locked: true, affordable: true, price: "5,000" },
          { service: "fuel", plane: "ice", dotsTotal: 2, dotsFilled: 2 },
          { service: "repair", dotsTotal: 3, dotsFilled: 0, affordable: true },
        ]} />
      {/* BOTTOM hangar — flush with apron bottom edge, opening UP (mirror) */}
      <LongHangar x={56} y={734} w={804} h={92} edge="bottom" style={hangar} pscale={P}
        stalls={[
          { service: "repair", plane: "amber", dotsTotal: 3, dotsFilled: 3 },
          { service: "board", plane: "rose", dotsTotal: 3, dotsFilled: 1 },
          { service: "fuel", locked: true, price: "5,000" },
          { service: "repair", dotsTotal: 4, dotsFilled: 0 },
          { service: "board", dotsTotal: 3, dotsFilled: 2, affordable: true },
        ]} />

      {/* 3 runways — vertically symmetric within the apron, gapped off the hangars */}
      <Runway x={1012} y={259} w={318} num="27" tone="phosphor" />
      <Runway x={1012} y={466} w={318} num="18" tone="rose" />
      <Runway x={1012} y={673} w={318} num="09" tone="green" />

      {/* approach lights stretching from each runway end into the sky */}
      {[290, 497, 704].map((cy, i) => (
        <React.Fragment key={i}>
          {[0, 1, 2, 3].map((k) => (
            <span key={k} style={{ position: "absolute", left: 1346 + k * 22, top: cy - 2, width: 5, height: 5, borderRadius: "50%",
              background: N.phosphor, boxShadow: `0 0 7px ${N.phosphor}`, opacity: .8 - k * 0.15, animation: `nx-pulse 2.4s ease-in-out ${k * 0.2}s infinite` }}></span>
          ))}
        </React.Fragment>
      ))}

      {/* arrival planes in the SKY — airborne = bigger */}
      <Plane x={1390} y={260} size={AIR} tone="phosphor" rot={90} anim="nx-bob1" />
      <Plane x={1390} y={467} size={AIR} tone="rose" rot={90} anim="nx-bob2" />
      <Plane x={1390} y={674} size={AIR} tone="green" rot={90} anim="nx-bob1" />

      {/* planes taxiing on the apron ground — same scale as the hangar */}
      <Plane x={640} y={420} size={P} tone="gold" rot={150} anim="nx-bob1" />
      <Plane x={820} y={540} size={P} tone="ice" rot={250} anim="nx-bob2" />
      <Plane x={950} y={470} size={P} tone="purple" rot={120} anim="nx-bob1" />

      {/* selected plane being vectored in (airborne, bigger) + drawn route */}
      <Route d="M 470 500 C 690 450, 880 360, 1020 296" end={[470, 500]} />
      <div style={{ position: "absolute", left: 470, top: 500 }}>
        <Plane x={-AIR / 2} y={-AIR / 2} size={AIR} tone="phosphor" sel />
      </div>

      {/* info bar — under the HUD, left edge aligned with the apron left edge */}
      <PlaneCard x={56} y={100} variant={info} />
      <TopHUD />
    </div>
  );
}

/* ===============================================================
   STATES GALLERY — every service-bay state, in the current render variant.
   =============================================================== */
function StateCell({ caption, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, flex: "0 0 auto" }}>
      <div style={{ width: 152, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, color: "#9fc0e0", textAlign: "center", maxWidth: 158, lineHeight: 1.3 }}>{caption}</div>
    </div>
  );
}
function StatesGallery({ style = 1 }) {
  const W = 168, H = 100;
  const cell = (caption, stall) => (
    <StateCell caption={caption}>
      <LongHangar x={undefined} y={undefined} w={W} h={H} edge="top" style={style} pscale={42} stalls={[stall]} />
    </StateCell>
  );
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: "max-content", padding: "2px 2px 4px" }}>
      {cell("Закрыт · денег не хватает", { service: "repair", locked: true, affordable: false, price: "5,000" })}
      {cell("Закрыт · можно открыть", { service: "repair", locked: true, affordable: true, price: "5,000" })}
      {cell("Открыт · пустой", { service: "fuel", dotsTotal: 3, dotsFilled: 1, affordable: false })}
      {cell("Открыт · с самолётом", { service: "fuel", plane: "teal", dotsTotal: 3, dotsFilled: 1, affordable: false })}
      {cell("Нет денег на апгрейд", { service: "board", dotsTotal: 3, dotsFilled: 1, affordable: false })}
      {cell("Есть деньги на апгрейд", { service: "board", dotsTotal: 3, dotsFilled: 1, affordable: true })}
      {cell("Апгрейды: ещё не куплены", { service: "repair", dotsTotal: 4, dotsFilled: 0, affordable: true })}
      {cell("Апгрейды: частично", { service: "repair", dotsTotal: 4, dotsFilled: 2, affordable: true })}
      {cell("Все апгрейды · иконка покупки пропала", { service: "repair", plane: "amber", dotsTotal: 4, dotsFilled: 4 })}
    </div>
  );
}

/* ===============================================================
   PLANE (BORT) STATES — a plane with its needs + patience over its head.
   =============================================================== */
function BortNeed({ service, state }) {
  const meta = SVC[service], c = N[meta.color], Ico = NIcon[service];
  const done = state === "done";
  return (
    <div style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", flex: "0 0 auto",
      color: done ? N.muted : c, background: done ? "rgba(95,123,176,.12)" : rgba(meta.color, .14), border: `1.5px solid ${done ? "rgba(95,123,176,.3)" : c}`,
      boxShadow: done ? "none" : `0 0 9px ${rgba(meta.color, .4)}`, opacity: done ? .55 : 1 }}>
      <Ico width={17} height={17} />
      {done && <span style={{ position: "absolute", right: -3, bottom: -3, width: 13, height: 13, borderRadius: "50%", background: N.green, color: "#05140d", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>✓</span>}
    </div>
  );
}
function BortCell({ caption, tone, need, ready }) {
  const meta = need ? SVC[need] : null;
  const nc = meta ? N[meta.color] : N.green;
  const Ico = need ? NIcon[need] : NIcon.takeoff;
  return (
    <StateCell caption={caption}>
      <div style={{ position: "relative", width: 66, height: 66 }}>
        <Plane x={11} y={14} size={44} tone={tone} rot={180} />
        {/* single current-need icon (or takeoff when ready), overlapping the plane */}
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", zIndex: 4,
          width: 30, height: 30, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: ready ? N.green : nc, background: "#0c1736", border: `2px solid ${ready ? N.green : nc}`,
          boxShadow: `0 0 11px ${ready ? rgba("green", .6) : rgba(meta.color, .55)}` }}>
          <Ico width={18} height={18} />
        </div>
      </div>
    </StateCell>
  );
}
function PlaneStates() {
  return (
    <div style={{ display: "flex", gap: 26, alignItems: "flex-start", minWidth: "max-content", padding: "2px 2px 4px" }}>
      <BortCell caption="Текущая нужда · ремонт" tone="phosphor" need="repair" />
      <BortCell caption="Текущая нужда · топливо" tone="teal" need="fuel" />
      <BortCell caption="Текущая нужда · посадка" tone="rose" need="board" />
      <BortCell caption="Обслужен · на взлёт" tone="green" ready />
    </div>
  );
}

Object.assign(window, { Stat, Hearts, TopHUD, Fab, PlaneCard, GameWindow, StatesGallery, PlaneStates });

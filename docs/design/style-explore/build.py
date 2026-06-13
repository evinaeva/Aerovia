# -*- coding: utf-8 -*-
"""
PlaneFlow — STYLE EXPLORATION mockups.

One LOCKED gameplay layout (the non-negotiable spec), rendered in 8 different
visual styles, to choose an art direction. The layout itself never changes:

  LOCKED (must not change between styles):
    * Strict top-down / bird's-eye, NO isometry. Landscape ~16:9.
    * Center of the screen = a large EMPTY field (the sacred drawing canvas).
      The HUD never overlaps it.
    * Planes ARRIVE FROM THE RIGHT (waiting in the air at the right edge).
    * RUNWAYS are on the RIGHT, horizontal strips.
    * SERVICE BAYS line the BOTTOM, LEFT and TOP edges (some open w/ icons,
      some locked w/ padlock + cost).
    * The player draws a route WITH A FINGER: a glowing line from a plane,
      finger cursor shown mid-draw.
    * Slim HUD on the TOP edge only: lives, timer, money, goal, pause.
    * HARD RULE: no tiny mobile UI — big, bold, readable icons & numbers.

Only the STYLE (palette, gradients, glow, ornament, linework) changes.

Output: style-1..8.png + styles-overview.png contact sheet.
Run:  python3 build.py
"""
import math, os, io
import cairosvg
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- inner screen geometry (landscape 16:9) ----
W, H = 960, 540
HUD = 60                      # slim top HUD bar height
PAD = 16                      # field safe padding

# layout zones (LOCKED)
RUN_X   = W - 248             # right runway zone starts here
LEFT_W  = 104                 # left bays column width
TOP_Y   = HUD + 12            # top bays row
ROW_H   = 92                  # bay row/col thickness
BOT_Y   = H - ROW_H - 12      # bottom bays row


# ============================================================ SVG primitives
def rr(x, y, w, h, r, fill, stroke=None, sw=2, op=1.0, dash=None, sop=1.0, flt=None):
    s = (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" '
         f'fill="{fill}" opacity="{op}"')
    if stroke: s += f' stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{sop}"'
    if dash:   s += f' stroke-dasharray="{dash}"'
    if flt:    s += f' filter="url(#{flt})"'
    return s + '/>'

def circle(cx, cy, r, fill, stroke=None, sw=2, op=1.0, sop=1.0, flt=None):
    s = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" opacity="{op}"'
    if stroke: s += f' stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{sop}"'
    if flt:    s += f' filter="url(#{flt})"'
    return s + '/>'

def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def txt(x, y, s, size=15, fill="#fff", anc="start", w="700", ls=0, op=1.0, font=None):
    f = font or "DejaVu Sans, sans-serif"
    s = _esc(s)
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{f}" font-size="{size}" '
            f'font-weight="{w}" letter-spacing="{ls}" fill="{fill}" text-anchor="{anc}" '
            f'opacity="{op}">{s}</text>')

def line(x1, y1, x2, y2, col, sw=3, op=1, dash=None, cap="round", flt=None):
    s = (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" '
         f'stroke-width="{sw}" opacity="{op}" stroke-linecap="{cap}"')
    if dash: s += f' stroke-dasharray="{dash}"'
    if flt:  s += f' filter="url(#{flt})"'
    return s + '/>'

def path(d, fill="none", stroke=None, sw=3, op=1.0, dash=None, cap="round", flt=None, join="round"):
    s = f'<path d="{d}" fill="{fill}" opacity="{op}"'
    if stroke: s += f' stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}" stroke-linejoin="{join}"'
    if dash:   s += f' stroke-dasharray="{dash}"'
    if flt:    s += f' filter="url(#{flt})"'
    return s + '/>'

def poly(pts, fill, stroke=None, sw=2, op=1.0, flt=None):
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    s = f'<polygon points="{p}" fill="{fill}" opacity="{op}"'
    if stroke: s += f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"'
    if flt:    s += f' filter="url(#{flt})"'
    return s + '/>'


# ============================================================ icon shapes
def plane_top(cx, cy, s, fill, stroke=None, sw=2, rot=0, op=1.0):
    """Top-down plane silhouette, pointing right at rot=0."""
    pts = [(cx + s, cy), (cx - s*0.55, cy - s*0.5), (cx - s*0.3, cy - s*0.12),
           (cx - s*1.0, cy - s*0.62), (cx - s*1.15, cy - s*0.42),
           (cx - s*0.55, cy), (cx - s*1.15, cy + s*0.42), (cx - s*1.0, cy + s*0.62),
           (cx - s*0.3, cy + s*0.12), (cx - s*0.55, cy + s*0.5)]
    if rot:
        a = math.radians(rot)
        pts = [(cx + (x-cx)*math.cos(a) - (y-cy)*math.sin(a),
                cy + (x-cx)*math.sin(a) + (y-cy)*math.cos(a)) for x, y in pts]
    return poly(pts, fill, stroke, sw, op)

def gear(cx, cy, r, fill, teeth=8):
    out = []
    for i in range(teeth):
        a = 2*math.pi*i/teeth
        out.append(line(cx + math.cos(a)*r*0.78, cy + math.sin(a)*r*0.78,
                        cx + math.cos(a)*r*1.18, cy + math.sin(a)*r*1.18, fill, sw=r*0.5, cap="butt"))
    out.append(circle(cx, cy, r*0.85, fill))
    out.append(circle(cx, cy, r*0.34, "#0000", stroke="#00000055", sw=r*0.34))
    return "".join(out)

def droplet(cx, cy, r, fill):
    d = (f"M {cx:.1f} {cy-r*1.25:.1f} "
         f"C {cx+r*1.05:.1f} {cy-r*0.15:.1f} {cx+r*0.9:.1f} {cy+r:.1f} {cx:.1f} {cy+r:.1f} "
         f"C {cx-r*0.9:.1f} {cy+r:.1f} {cx-r*1.05:.1f} {cy-r*0.15:.1f} {cx:.1f} {cy-r*1.25:.1f} Z")
    return path(d, fill=fill, sw=0)

def person(cx, cy, r, fill):
    return circle(cx, cy - r*0.7, r*0.5, fill) + \
        path(f"M {cx-r*0.7:.1f} {cy+r*0.9:.1f} C {cx-r*0.7:.1f} {cy-r*0.1:.1f} "
             f"{cx+r*0.7:.1f} {cy-r*0.1:.1f} {cx+r*0.7:.1f} {cy+r*0.9:.1f} Z", fill=fill, sw=0)

def padlock(cx, cy, r, body, shackle):
    out = [path(f"M {cx-r*0.62:.1f} {cy-r*0.1:.1f} V {cy-r*0.7:.1f} "
                f"A {r*0.62:.1f} {r*0.62:.1f} 0 0 1 {cx+r*0.62:.1f} {cy-r*0.7:.1f} V {cy-r*0.1:.1f}",
                stroke=shackle, sw=r*0.34)]
    out.append(rr(cx - r*0.95, cy - r*0.1, r*1.9, r*1.35, r*0.3, body))
    out.append(circle(cx, cy + r*0.5, r*0.22, "#00000066"))
    return "".join(out)

def heart(cx, cy, r, fill):
    d = (f"M {cx:.1f} {cy+r*0.85:.1f} C {cx-r*1.4:.1f} {cy-r*0.2:.1f} "
         f"{cx-r*0.7:.1f} {cy-r*1.1:.1f} {cx:.1f} {cy-r*0.35:.1f} "
         f"C {cx+r*0.7:.1f} {cy-r*1.1:.1f} {cx+r*1.4:.1f} {cy-r*0.2:.1f} {cx:.1f} {cy+r*0.85:.1f} Z")
    return path(d, fill=fill, sw=0)

def coin(cx, cy, r, fill, edge):
    return circle(cx, cy, r, fill, stroke=edge, sw=r*0.22) + \
        txt(cx, cy + r*0.5, "$", size=r*1.3, fill=edge, anc="middle", w="900")

def finger(cx, cy, scale, skin, nail):
    """Pointing-hand cursor, fingertip at (cx,cy)."""
    s = scale
    out = [path(f"M {cx:.1f} {cy:.1f} "
                f"C {cx-2*s:.1f} {cy+1*s:.1f} {cx-3*s:.1f} {cy+5*s:.1f} {cx-2.4*s:.1f} {cy+9*s:.1f} "
                f"C {cx-2*s:.1f} {cy+12*s:.1f} {cx+1*s:.1f} {cy+13*s:.1f} {cx+4*s:.1f} {cy+12.5*s:.1f} "
                f"C {cx+6.5*s:.1f} {cy+12*s:.1f} {cx+7*s:.1f} {cy+9*s:.1f} {cx+6.5*s:.1f} {cy+6*s:.1f} "
                f"C {cx+6*s:.1f} {cy+4*s:.1f} {cx+5*s:.1f} {cy+3*s:.1f} {cx+4*s:.1f} {cy+2.5*s:.1f} "
                f"L {cx+2.2*s:.1f} {cy+1.6*s:.1f} Z",
                fill=skin, stroke="#00000044", sw=1.5)]
    out.append(circle(cx, cy, 1.6*s, nail))
    return "".join(out)


# ============================================================ THEME
class T:
    def __init__(self, name, sub, **k):
        self.name = name; self.sub = sub
        self.__dict__.update(k)


THEMES = [
    T("1 · Extreme flat minimalism", "3 flat colors · no gradients · no glow · diagrammatic",
      bg="#f3f1ec", field="#e4e0d8", field_edge="none",
      bay="#ffffff", bay_edge="#1c1c22", bay_sw=3, locked="#d9d6cf",
      run="#1c1c22", run_dash="#f3f1ec", run_round=4,
      repair="#1c1c22", fuel="#1c1c22", board="#1c1c22",
      route="#e0483c", route_glow=None, route_dash="2 14", route_sw=6,
      ink="#1c1c22", hud_bg="#ffffff", hud_ink="#1c1c22", accent="#e0483c",
      heart_c="#e0483c", coin_c="#1c1c22", coin_e="#f3f1ec",
      radius=6, glow=False, ornate=0, plane_fill="#1c1c22", grad=False,
      title_bg="#1c1c22", title_fg="#f3f1ec"),

    T("2 · Clean modern mobile", "soft gradients · rounded · glossy · premium",
      bg="#eef3fb", field="#dde6f4", field_edge="#ffffff",
      bay="#ffffff", bay_edge="#cdd8ec", bay_sw=2, locked="#e3e9f4",
      run="#9fb2cf", run_dash="#ffffff", run_round=14,
      repair="#f59e3b", fuel="#2bb8c9", board="#ef6f8e",
      route="#3ad07a", route_glow="#3ad07a", route_dash="1 16", route_sw=7,
      ink="#27324a", hud_bg="#ffffffd9", hud_ink="#27324a", accent="#3ad07a",
      heart_c="#ef5a6a", coin_c="#f4c64e", coin_e="#a9791a",
      radius=18, glow=True, ornate=0, plane_fill="#5a73a6", grad=True,
      title_bg="#27324a", title_fg="#ffffff"),

    T("3 · Neon air-traffic control", "dark · glowing route lines · futuristic HUD",
      bg="#070b16", field="#0c1426", field_edge="#1de0ff",
      bay="#0e1b30", bay_edge="#1de0ff", bay_sw=2, locked="#0a1322",
      run="#13314f", run_dash="#1de0ff", run_round=6,
      repair="#ffae3b", fuel="#1de0ff", board="#ff4fa3",
      route="#39ff9d", route_glow="#39ff9d", route_dash="1 15", route_sw=6,
      ink="#bfe9ff", hud_bg="#0a1322cc", hud_ink="#bfe9ff", accent="#39ff9d",
      heart_c="#ff4f6d", coin_c="#ffd23b", coin_e="#070b16",
      radius=10, glow=True, ornate=0, plane_fill="#1de0ff", grad=False,
      title_bg="#0a1322", title_fg="#39ff9d"),

    T("4 · Bright playful cartoon", "saturated · chunky outlines · bouncy · casual",
      bg="#aee3ff", field="#7fd089", field_edge="#3a7d44",
      bay="#fff4d6", bay_edge="#3a2a17", bay_sw=4, locked="#e9cf9a",
      run="#6a6f78", run_dash="#fff4d6", run_round=14,
      repair="#ff7a1a", fuel="#16b6d8", board="#ff5ca0",
      route="#ff3b6b", route_glow=None, route_dash="2 16", route_sw=9,
      ink="#3a2a17", hud_bg="#fff4d6", hud_ink="#3a2a17", accent="#ff3b6b",
      heart_c="#ff3b5c", coin_c="#ffd23b", coin_e="#3a2a17",
      radius=20, glow=False, ornate=0, plane_fill="#ffffff", grad=False,
      title_bg="#3a2a17", title_fg="#fff4d6", outline="#3a2a17", outline_sw=4),

    T("5 · Tilt-shift miniature diorama", "soft realistic light · tactile · top-down",
      bg="#cdd3cf", field="#7c8b5e", field_edge="#5f6d46",
      bay="#cfc4ad", bay_edge="#8a7d62", bay_sw=2, locked="#b3a98f",
      run="#5b5e63", run_dash="#e8e2d2", run_round=8,
      repair="#e08a2b", fuel="#2f9bb0", board="#d96284",
      route="#ffd14a", route_glow="#ffd14a", route_dash="1 15", route_sw=7,
      ink="#33352f", hud_bg="#efeadcdd", hud_ink="#33352f", accent="#ffd14a",
      heart_c="#d8584f", coin_c="#f0c64e", coin_e="#6b5320",
      radius=12, glow=True, ornate=0, plane_fill="#f1ece0", grad=True, shadow=True,
      title_bg="#33352f", title_fg="#efeadc"),

    T("6 · Blueprint schematic", "thin precise linework · grid · monospace HUD",
      bg="#0a2a3a", field="#0c3346", field_edge="#7fdfff",
      bay="#0c3346", bay_edge="#9fe8ff", bay_sw=1.6, locked="#0a2636",
      run="#12435c", run_dash="#9fe8ff", run_round=2,
      repair="#9fe8ff", fuel="#9fe8ff", board="#9fe8ff",
      route="#7CFCB0", route_glow="#7CFCB0", route_dash="6 8", route_sw=3,
      ink="#cdeeff", hud_bg="#0a2636cc", hud_ink="#cdeeff", accent="#7CFCB0",
      heart_c="#9fe8ff", coin_c="#9fe8ff", coin_e="#0a2a3a",
      radius=3, glow=True, ornate=0, plane_fill="none", plane_stroke="#9fe8ff",
      grad=False, grid=True, mono=True,
      title_bg="#0a2636", title_fg="#7CFCB0"),

    T("7 · Ornate art-deco", "gold filigree · emerald & navy · geometric frames",
      bg="#0d1b1a", field="#10302b", field_edge="#d8b46a",
      bay="#13403a", bay_edge="#d8b46a", bay_sw=2, locked="#0f2a26",
      run="#1c4f47", run_dash="#d8b46a", run_round=4,
      repair="#e8c061", fuel="#67d2c4", board="#e58aa0",
      route="#f4d27a", route_glow="#f4d27a", route_dash="1 14", route_sw=6,
      ink="#ecdcae", hud_bg="#0d1b1acc", hud_ink="#ecdcae", accent="#d8b46a",
      heart_c="#e0606e", coin_c="#f4d27a", coin_e="#0d1b1a",
      radius=8, glow=True, ornate=1, plane_fill="#ecdcae", grad=True,
      title_bg="#0d1b1a", title_fg="#d8b46a"),

    T("8 · Baroque maximalist", "gilded ornate frames · jewel tones · lavish",
      bg="#1a0f1f", field="#2a163a", field_edge="#f0cf6e",
      bay="#3a1f4e", bay_edge="#f0cf6e", bay_sw=2.5, locked="#26122f",
      run="#43205c", run_dash="#f0cf6e", run_round=6,
      repair="#f5b94a", fuel="#4fd6c8", board="#ff6fa3",
      route="#ffd86b", route_glow="#ffd86b", route_dash="1 13", route_sw=7,
      ink="#f3e3c0", hud_bg="#1a0f1fd0", hud_ink="#f3e3c0", accent="#f0cf6e",
      heart_c="#ff5d77", coin_c="#ffd86b", coin_e="#1a0f1f",
      radius=12, glow=True, ornate=2, plane_fill="#f8ecc8", grad=True,
      title_bg="#1a0f1f", title_fg="#f0cf6e"),
]


# ============================================================ defs (gradients/filters)
def make_defs(t):
    d = ['<defs>']
    # soft glow filter
    d.append('<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">'
             '<feGaussianBlur stdDeviation="4" result="b"/>'
             '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    d.append('<filter id="softsh" x="-40%" y="-40%" width="180%" height="180%">'
             '<feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity="0.35"/></filter>')
    # field vertical gradient
    if t.grad:
        d.append(f'<linearGradient id="fieldG" x1="0" y1="0" x2="0" y2="1">'
                 f'<stop offset="0" stop-color="{_lighten(t.field,18)}"/>'
                 f'<stop offset="1" stop-color="{_darken(t.field,12)}"/></linearGradient>')
        d.append(f'<linearGradient id="bayG" x1="0" y1="0" x2="0" y2="1">'
                 f'<stop offset="0" stop-color="{_lighten(t.bay,12)}"/>'
                 f'<stop offset="1" stop-color="{_darken(t.bay,8)}"/></linearGradient>')
    # background radial for dark themes
    d.append(f'<radialGradient id="bgG" cx="0.5" cy="0.42" r="0.8">'
             f'<stop offset="0" stop-color="{_lighten(t.bg,10)}"/>'
             f'<stop offset="1" stop-color="{t.bg}"/></radialGradient>')
    d.append('</defs>')
    return "".join(d)


def _clamp(v): return max(0, min(255, int(v)))
def _hex(r, g, b): return f"#{_clamp(r):02x}{_clamp(g):02x}{_clamp(b):02x}"
def _rgb(h):
    h = h.lstrip('#'); return int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
def _lighten(h, p):
    r,g,b=_rgb(h); return _hex(r+(255-r)*p/100, g+(255-g)*p/100, b+(255-b)*p/100)
def _darken(h, p):
    r,g,b=_rgb(h); return _hex(r*(1-p/100), g*(1-p/100), b*(1-p/100))


# ============================================================ bays
def bay_icon(t, kind, cx, cy, r):
    if kind == "repair": return gear(cx, cy, r*0.62, t.repair)
    if kind == "fuel":   return droplet(cx, cy, r*0.7, t.fuel)
    if kind == "board":  return person(cx, cy, r*0.7, t.board)
    if kind == "lock":   return padlock(cx, cy, r*0.8, t.ink, t.accent)
    return ""

def draw_bay(t, x, y, w, h, kind, cost=None):
    out = []
    fill = "url(#bayG)" if (t.grad and kind != "lock") else (t.locked if kind == "lock" else t.bay)
    flt = "softsh" if getattr(t, "shadow", False) else None
    out.append(rr(x, y, w, h, t.radius, fill, stroke=t.bay_edge, sw=t.bay_sw, flt=flt))
    if getattr(t, "outline", None):  # cartoon thick outline
        out.append(rr(x, y, w, h, t.radius, "none", stroke=t.outline, sw=t.outline_sw))
    if t.ornate:  # inner ornament frame
        out.append(rr(x+5, y+5, w-10, h-10, max(2, t.radius-4), "none", stroke=t.bay_edge, sw=1, sop=0.7))
        if t.ornate == 2:
            for dx in (x+9, x+w-9):
                out.append(circle(dx, y+9, 2.2, t.bay_edge))
                out.append(circle(dx, y+h-9, 2.2, t.bay_edge))
    cx, cy = x + w/2, y + h/2 - (5 if (cost or kind == "lock") else 0)
    out.append(bay_icon(t, kind, cx, cy, min(w, h)*0.5))
    if kind == "lock" and cost:
        out.append(rr(x+w/2-30, y+h-22, 60, 18, 9, t.accent))
        out.append(txt(x+w/2, y+h-9, cost, size=12, fill=t.title_bg if t.name[0] in "124" else "#0a0a0a",
                       anc="middle", w="800"))
    return "".join(out)


# ============================================================ full scene
def scene(t):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
         f'viewBox="0 0 {W} {H}">']
    s.append(make_defs(t))
    # background
    s.append(rr(0, 0, W, H, 0, "url(#bgG)" ))
    s.append(rr(0, 0, W, H, 0, t.bg, op=0.0))  # keep bg color reference

    # -------- central sacred field
    fx, fy = LEFT_W + 6, HUD + ROW_H + 6
    fw, fh = RUN_X - fx - 8, BOT_Y - fy - 6
    s.append(rr(fx, fy, fw, fh, t.radius+4, "url(#fieldG)" if t.grad else t.field,
                stroke=t.field_edge if t.field_edge != "none" else None,
                sw=2, sop=0.6, flt="softsh" if getattr(t,"shadow",False) else None))
    if getattr(t, "grid", False):  # blueprint grid
        for gx in range(int(fx)+24, int(fx+fw), 32):
            s.append(line(gx, fy+6, gx, fy+fh-6, t.field_edge, sw=0.6, op=0.18, dash=None, cap="butt"))
        for gy in range(int(fy)+24, int(fy+fh), 32):
            s.append(line(fx+6, gy, fx+fw-6, gy, t.field_edge, sw=0.6, op=0.18, cap="butt"))
    # faint apron centroid marker (drawing canvas hint)
    s.append(rr(fx+fw*0.30, fy+fh*0.32, fw*0.40, fh*0.36, t.radius, "none",
                stroke=t.ink, sw=1.4, sop=0.18, dash="2 8"))

    # -------- RUNWAYS (right, horizontal)
    n_run = 4
    rgap = (H - HUD - 24) / n_run
    for i in range(n_run):
        ry = HUD + 14 + i*rgap
        rh = rgap - 16
        s.append(rr(RUN_X, ry, W - RUN_X - 12, rh, t.run_round, t.run))
        cy = ry + rh/2
        s.append(line(RUN_X+14, cy, W-26, cy, t.run_dash, sw=3, dash="16 12", op=0.85))
        # taxi connector into field
        s.append(line(RUN_X, cy, fx+fw, cy, t.run, sw=6, op=0.5))

    # -------- waiting planes (arrive from the RIGHT, in the air)
    waits = [(W-30, HUD+14+0.5*rgap), (W-30, HUD+14+2.5*rgap), (W-30, HUD+14+3.5*rgap)]
    for i, (px, py) in enumerate(waits):
        # patience ring on waiting planes (behind the plane)
        s.append(circle(px, py, 24, "none", stroke=t.accent, sw=3, sop=0.8, flt="glow" if t.glow else None))
        if t.plane_fill == "none":
            s.append('<g>' + _plane_outline(t, px, py, 17) + '</g>')
        else:
            s.append(plane_top(px, py, 17, t.plane_fill, stroke=getattr(t,"outline",None),
                               sw=getattr(t,"outline_sw",2), rot=180))

    # -------- SERVICE BAYS: bottom row, left column, top row
    bw = 84
    # top row
    tx = LEFT_W + 14
    top_kinds = [("repair", None), ("fuel", None), ("lock", "1 200"), ("board", None)]
    for k, cost in top_kinds:
        s.append(draw_bay(t, tx, TOP_Y, bw, ROW_H-10, k, cost))
        tx += bw + 14
    # bottom row
    bx = LEFT_W + 14
    bot_kinds = [("board", None), ("repair", None), ("fuel", None), ("lock", "2 500")]
    for k, cost in bot_kinds:
        s.append(draw_bay(t, bx, BOT_Y+4, bw, ROW_H-10, k, cost))
        bx += bw + 14
    # left column
    ly = HUD + ROW_H + 16
    lh = (BOT_Y - ly - 14) / 3
    left_kinds = ["fuel", "lock", "repair"]
    for i, k in enumerate(left_kinds):
        s.append(draw_bay(t, 12, ly + i*(lh+8), LEFT_W-22, lh, k, "900" if k == "lock" else None))

    # -------- ROUTE being drawn with a finger (from a right plane into a bottom bay)
    p0 = (W-40, HUD+14+2.5*rgap)          # source plane (right)
    p3 = (LEFT_W+14+bw*1.35, BOT_Y-26)    # live draw end, in open field above a bottom bay
    c1 = (RUN_X-40, p0[1]+30)
    c2 = (fx+fw*0.5, fy+fh*0.58)
    d = f"M {p0[0]} {p0[1]} C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p3[0]} {p3[1]}"
    if t.route_glow:
        s.append(path(d, stroke=t.route_glow, sw=t.route_sw+6, op=0.35, flt="glow"))
    s.append(path(d, stroke=t.route, sw=t.route_sw, dash=t.route_dash, cap="round", flt="glow" if t.glow else None))
    # selected plane (green ring) at source
    s.append(circle(p0[0], p0[1], 22, "none", stroke=t.accent, sw=4, flt="glow" if t.glow else None))
    # finger cursor at the live drawing end (large, clearly a touch)
    s.append(circle(p3[0], p3[1], 12, t.accent, op=0.25, flt="glow" if t.glow else None))
    s.append(finger(p3[0], p3[1], 4.6, "#f3cba0", "#ffffff"))

    # -------- slim HUD (top edge) — big readable
    s.append(rr(0, 0, W, HUD, 0, t.hud_bg))
    s.append(line(0, HUD, W, HUD, t.ink, sw=1, op=0.25))
    monofont = "DejaVu Sans Mono, monospace" if getattr(t,"mono",False) else None
    # left cluster: lives + money
    hx = 22
    for i in range(3):
        s.append(heart(hx + i*30, HUD/2, 11, t.heart_c if i < 2 else _darken(t.heart_c,55)))
    hx += 3*30 + 18
    s.append(coin(hx, HUD/2, 14, t.coin_c, t.coin_e))
    s.append(txt(hx+22, HUD/2+7, "20 000", size=22, fill=t.hud_ink, w="800", font=monofont))
    # center: level + goal progress
    s.append(txt(W/2, 22, "LEVEL 12 · GOAL", size=12, fill=t.hud_ink, anc="middle", w="700", ls=2, op=0.8))
    gw = 220
    s.append(rr(W/2-gw/2, 30, gw, 12, 6, t.ink, op=0.18))
    s.append(rr(W/2-gw/2, 30, gw*0.45, 12, 6, t.accent, flt="glow" if t.glow else None))
    s.append(txt(W/2+gw/2+10, 41, "8/14", size=15, fill=t.hud_ink, w="800", font=monofont))
    # right: timer + pause
    s.append(txt(W-150, HUD/2+7, "14:56", size=22, fill=t.hud_ink, anc="end", w="800", font=monofont))
    s.append(rr(W-118, HUD/2-16, 34, 34, 9, t.accent, flt="glow" if t.glow else None))
    s.append(rr(W-110, HUD/2-9, 6, 18, 2, t.title_bg if t.name[0] in "124" else "#0a0a0a"))
    s.append(rr(W-100, HUD/2-9, 6, 18, 2, t.title_bg if t.name[0] in "124" else "#0a0a0a"))

    s.append('</svg>')
    return "".join(s)


def _plane_outline(t, px, py, sz):
    # stroked plane for blueprint
    a = math.radians(180)
    pts = [(px + sz, py), (px - sz*0.55, py - sz*0.5), (px - sz*0.3, py - sz*0.12),
           (px - sz*1.0, py - sz*0.62), (px - sz*1.15, py - sz*0.42),
           (px - sz*0.55, py), (px - sz*1.15, py + sz*0.42), (px - sz*1.0, py + sz*0.62),
           (px - sz*0.3, py + sz*0.12), (px - sz*0.55, py + sz*0.5)]
    pts = [(px + (x-px)*math.cos(a) - (y-py)*math.sin(a),
            py + (x-px)*math.sin(a) + (y-py)*math.cos(a)) for x, y in pts]
    return poly(pts, "none", stroke=t.plane_stroke, sw=2)


# ============================================================ render
def render_card(t):
    """SVG with a title strip above the device frame."""
    TITLE = 70
    DEV = 18
    iw, ih = W + DEV*2, H + DEV*2
    cw, ch = iw, ih + TITLE
    inner = scene(t)
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{cw}" height="{ch}" viewBox="0 0 {cw} {ch}">']
    s.append(rr(0, 0, cw, ch, 0, t.title_bg))
    s.append(txt(28, 30, t.name, size=20, fill=t.title_fg, w="800"))
    s.append(txt(28, 52, t.sub, size=13, fill=t.title_fg, w="500", op=0.75))
    # device frame
    s.append(rr(8, TITLE+8, iw-16, ih-16, 26, _darken(t.bg,40)))
    s.append(f'<g transform="translate({DEV},{TITLE+DEV})">')
    s.append(inner.split('>',1)[1].rsplit('</svg>',1)[0])  # strip outer svg tag
    s.append('</g></svg>')
    return "".join(s)


def main():
    pngs = []
    for i, t in enumerate(THEMES, 1):
        svg = render_card(t)
        svg_path = os.path.join(HERE, f"style-{i}.svg")
        png_path = os.path.join(HERE, f"style-{i}.png")
        with open(svg_path, "w") as f:
            f.write(svg)
        cairosvg.svg2png(bytestring=svg.encode(), write_to=png_path, scale=1.4)
        pngs.append(png_path)
        print("rendered", os.path.basename(png_path))

    # contact sheet: 2 cols x 4 rows
    ims = [Image.open(p).convert("RGB") for p in pngs]
    cw = max(im.width for im in ims); chh = max(im.height for im in ims)
    GAP = 24; BG = (24, 22, 30)
    cols, rows = 2, 4
    sheet = Image.new("RGB", (cols*cw + (cols+1)*GAP, rows*chh + (rows+1)*GAP), BG)
    for idx, im in enumerate(ims):
        r, c = divmod(idx, cols)
        sheet.paste(im, (GAP + c*(cw+GAP), GAP + r*(chh+GAP)))
    sheet.save(os.path.join(HERE, "styles-overview.png"))
    print("rendered styles-overview.png")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
PlaneFlow — UI wireframes / mockups generator.

Renders a fresh, gameplay-driven UI proposal (NOT a snapshot of the current
index.html) as styled landscape mockups + a screen-flow map.

Design thesis (see ../../../docs/art-direction/wireframes.md):
  * Landscape, finger-drawn routing -> the center of the field is sacred.
  * The HUD hugs the top edge as one slim translucent bar.
  * Economy (open / upgrade boxes) is contextual, ON the boxes, not a panel.
  * Per-aircraft to-do list floats next to the tapped plane, never blocks the field.
  * Menus use the warm rounded-card language from the art bible; palette is unchanged.

Output: *.png in this folder + overview.png contact sheet.
Run:  python3 build.py
"""
import math, cairosvg
from PIL import Image
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- palette (from docs/art-direction/color_palette.md) ----
INK="#211d33"; NAVY="#16131f"; NAVY8="#242842"; RAISED="#2a2540"
PUR7="#3a3354"; WINDOW="#2a3050"
CREAM="#f4eede"; CREAM2="#e8e0cf"; CREAMSH="#cdbf9f"
MUTED="#a8aab5"; GRAY="#8a8c99"
GREEN="#5dca7a"; AMBER="#f2a93b"; RED="#e0584f"; BLUE="#4ab4d6"
PURPLE="#9a6fd4"; ROSE="#ef798a"; GOLD="#f4cf5e"; TEAL="#4ecdc4"
FONT="DejaVu Sans, sans-serif"

# ---- geometry ----
W, H = 920, 460          # inner screen (landscape)
BW = 26                  # device bezel
TITLE = 64               # title strip above the device

# ---------------------------------------------------------------- primitives
def rr(x,y,w,h,r,fill,stroke=None,sw=1.5,op=1.0,dash=None,sop=1.0):
    s=f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="{fill}" opacity="{op}"'
    if stroke: s+=f' stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{sop}"'
    if dash: s+=f' stroke-dasharray="{dash}"'
    return s+'/>'

def circle(cx,cy,r,fill,stroke=None,sw=1.5,op=1.0,sop=1.0):
    s=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" opacity="{op}"'
    if stroke: s+=f' stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{sop}"'
    return s+'/>'

def txt(x,y,s,size=14,fill=CREAM,anc="start",w="400",ls=0,op=1.0):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{w}" letter-spacing="{ls}" fill="{fill}" text-anchor="{anc}" opacity="{op}">{s}</text>')

def line(x1,y1,x2,y2,col,sw=2,op=1,dash=None,cap="round"):
    s=f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{sw}" opacity="{op}" stroke-linecap="{cap}"'
    if dash: s+=f' stroke-dasharray="{dash}"'
    return s+'/>'

def star_pts(cx,cy,r,inner=None):
    inner=inner or r*0.45; out=[]
    for i in range(10):
        a=-math.pi/2+i*math.pi/5; rr_=r if i%2==0 else inner
        out.append(f"{cx+rr_*math.cos(a):.1f},{cy+rr_*math.sin(a):.1f}")
    return " ".join(out)

def star(cx,cy,r,fill=GOLD,stroke=None):
    s=f'<polygon points="{star_pts(cx,cy,r)}" fill="{fill}"'
    if stroke: s+=f' stroke="{stroke}" stroke-width="1.2"'
    return s+'/>'

def heart(cx,cy,r,fill=ROSE):
    # r ~ half-width
    return (f'<path transform="translate({cx-r},{cy-r*0.9})scale({r/12})" '
            f'd="M12 21C12 21 3.5 14.2 3.5 8.6 A4.4 4.4 0 0 1 12 6 A4.4 4.4 0 0 1 20.5 8.6 C20.5 14.2 12 21 12 21Z" fill="{fill}"/>')

def coin(cx,cy,r):
    return (circle(cx,cy,r,GOLD,stroke="#d8a93b",sw=1.4)+
            txt(cx,cy+r*0.5,"$",size=r*1.4,fill="#8a6a16",anc="middle",w="700"))

# 24x24 stroke icons -> placed at (x,y) box of size s
def sicon(paths,x,y,s,col,sw=2.0,extra=""):
    body="".join(f'<path d="{d}"/>' for d in paths)
    return (f'<g transform="translate({x},{y})scale({s/24})" fill="none" stroke="{col}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{body}{extra}</g>')

WRENCH=['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']
FUEL=['M3 22h12','M4 9h10','M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18','M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5']
USERS=['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']
GEAR=['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-2.7 1.15V21a2 2 0 1 1-4 0v-.06A1.6 1.6 0 0 0 7.7 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .29-1.86 1.6 1.6 0 0 0-1.51-1V12a2 2 0 1 1 0-4h.06a1.6 1.6 0 0 0 1.15-2.7 1.6 1.6 0 0 0-.32-1.77l-.06-.06A2 2 0 1 1 5.5 1.84l.06.06a1.6 1.6 0 0 0 1.77.32H7.4A1.6 1.6 0 0 0 8.4 .6V.6a2 2 0 1 1 4 0v.06a1.6 1.6 0 0 0 2.7 1.15 1.6 1.6 0 0 0 .32-1.51l-.06-.06']
LOCK=['M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z','M8 11V7a4 4 0 0 1 8 0v4']
MEDAL=['M8 15a6 6 0 1 0 8 0','M9 9 7 2h10l-2 7']
BACK=['M19 12H5','M12 19l-7-7 7-7']
CHECK=['M20 6 9 17l-5-5']
PLANE_NOSE_UP=['M22 16.5 13.5 11.5V5.5a1.5 1.5 0 0 0-3 0v6L2 16.5v2l8.5-2.5V21L8 22.5V24l4-1 4 1v-1.5L13.5 21v-5z']
SNOW=['M12 2v20','M2 12h20','M5 5l14 14','M19 5 5 19']

# ---------------------------------------------------------------- plane sprite
def plane(cx,cy,s,body=CREAM,sh=CREAMSH,wing=CREAM2,rot=0,ring=None):
    # simplified cute top-down plane, drawn in a 64-box, nose up then rotated
    g=(f'<g transform="translate({cx},{cy})rotate({rot})scale({s/64})translate(-32,-32)">')
    g+='<ellipse cx="32" cy="52" rx="15" ry="4" fill="#000" opacity="0.18"/>'
    for d in ["M28.6 27 C22 29 14 33 8.3 36.8 C6.2 38.1 6.6 40.4 8.9 39.9 C16 38 23 36 28.6 34.4 Z",
              "M35.4 27 C42 29 50 33 55.7 36.8 C57.8 38.1 57.4 40.4 55.1 39.9 C48 38 41 36 35.4 34.4 Z",
              "M29.2 48.5 C26 50 22 52 20.4 53.6 C19.7 54.2 20.1 55.2 21 54.9 C24 54 27.4 52.6 29.6 51.6 Z",
              "M34.8 48.5 C38 50 42 52 43.6 53.6 C44.3 54.2 43.9 55.2 43 54.9 C40 54 36.6 52.6 34.4 51.6 Z"]:
        g+=f'<path d="{d}" fill="{wing}" stroke="{sh}" stroke-width="0.7"/>'
    g+=('<path d="M32 6.5 C34.2 6.5 35.5 9.5 35.9 13.5 C36.5 20 36.9 28 36.4 38 C36 46 34.4 53 32 56 '
        'C29.6 53 28 46 27.6 38 C27.1 28 27.5 20 28.1 13.5 C28.5 9.5 29.8 6.5 32 6.5 Z" '
        f'fill="{body}" stroke="{sh}" stroke-width="0.9"/>')
    g+=f'<path d="M28.9 13.5 C30 11 34 11 35.1 13.5 C35.6 16.2 34 18.4 32 18.4 C30 18.4 28.4 16.2 28.9 13.5 Z" fill="{WINDOW}"/>'
    g+='</g>'
    if ring:  # patience ring: (frac_red 0..1)
        g+=circle(cx,cy,s*0.46,"none",stroke=AMBER,sw=2.4,sop=0.35)
        # red arc proportional
        frac=ring; r=s*0.46
        a0=-math.pi/2; a1=a0+2*math.pi*frac
        x0=cx+r*math.cos(a0); y0=cy+r*math.sin(a0)
        x1=cx+r*math.cos(a1); y1=cy+r*math.sin(a1)
        large=1 if frac>0.5 else 0
        g+=f'<path d="M{x0:.1f} {y0:.1f} A{r:.1f} {r:.1f} 0 {large} 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{RED}" stroke-width="2.8" stroke-linecap="round"/>'
    return g

# ---------------------------------------------------------------- chips / cards
def chip(x,y,w,h,fill,label,col=CREAM,r=None,size=15,stroke=None):
    r=r if r is not None else h/2
    s=rr(x,y,w,h,r,fill,stroke=stroke,sw=1.4)
    s+=txt(x+w/2,y+h/2+size*0.35,label,size=size,fill=col,anc="middle",w="600")
    return s

def cost_chip(cx,cy,amount,affordable=True):
    w=58; h=24; x=cx-w/2; y=cy-h/2
    col=GOLD if affordable else GRAY
    s=rr(x,y,w,h,h/2,"#1c1830",stroke=col,sw=1.4,sop=0.9)
    s+=coin(x+13,y+h/2,7)
    s+=txt(x+24,y+h/2+5,str(amount),size=13,fill=col,anc="start",w="700")
    return s

# ---------------------------------------------------------------- device frame
def device(inner, title, sub):
    tw=W+2*BW; th=TITLE+2*BW+H
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{tw}" height="{th}" viewBox="0 0 {tw} {th}">'
    s+=f'<rect width="{tw}" height="{th}" fill="#0d0b14"/>'
    s+=txt(8,28,title,size=20,fill=CREAM,w="700",ls="0.5")
    s+=txt(8,50,sub,size=13,fill=MUTED)
    # bezel
    s+=rr(0,TITLE,tw,th-TITLE,30,"#000",op=1.0)
    s+=rr(4,TITLE+4,tw-8,th-TITLE-8,26,"#3a3550")
    s+=rr(BW-3,TITLE+BW-3,W+6,H+6,18,"#0a0810")
    s+=f'<clipPath id="scr"><rect x="{BW}" y="{TITLE+BW}" width="{W}" height="{H}" rx="14"/></clipPath>'
    s+=f'<g clip-path="url(#scr)"><g transform="translate({BW},{TITLE+BW})">'
    s+=inner
    s+='</g></g>'
    s+='</svg>'
    return s

def bg_menu():
    s=f'<defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{INK}"/><stop offset="1" stop-color="{NAVY}"/></linearGradient></defs>'
    s+=rr(0,0,W,H,0,"url(#mg)")
    # dotted runway lights bottom-left ambience
    for i in range(7):
        s+=circle(40+i*26,H-34,2.4,AMBER,op=0.5)
    return s

def annot(x,y,t,col=BLUE):
    return txt(x,y,t,size=12,fill=col,w="700",ls="0.3")

# ================================================================ SCREENS
def s_start():
    s=bg_menu()
    # left: brand panel ; right: action column (landscape uses width)
    s+=plane(150,150,120,rot=28)
    s+=plane(250,250,70,rot=-15,body=GOLD,sh="#d8a93b",wing="#eabf4e")
    s+=txt(60,300,"PLANEFLOW",size=58,fill=CREAM,w="800",ls="1")
    s+=txt(62,330,"route the planes · keep the flow",size=16,fill=MUTED)
    s+=txt(62,352,"проводи борты · держи поток",size=14,fill=GRAY)
    # right action column
    cx=680; cw=200
    s+=rr(cx-20,60,cw+40,H-120,28,RAISED,stroke=PUR7,sop=0.5)
    s+=chip(cx,96,cw,58,GREEN,"▶  PLAY",col="#10331c",size=20)
    s+=chip(cx,166,cw,46,TEAL,"☾  Zen",col="#0d2b2a",size=16)
    s+=chip(cx,222,cw,46,RAISED,"≡  Levels",col=CREAM,size=16,stroke=PUR7)
    s+=chip(cx,278,cw,46,RAISED,"🏅 Medals",col=CREAM,size=16,stroke=PUR7)
    s+=chip(cx,334,cw,46,RAISED,"⚙  Settings",col=CREAM,size=16,stroke=PUR7)
    s+=txt(cx+cw/2,420,"v0.20",size=12,fill=GRAY,anc="middle")
    # annotations
    s+=annot(60,40,"◀ brand + art (left half, no buttons)")
    s+=annot(560,40,"primary CTA biggest · thumb-reachable right rail ▶")
    return device(s,"01 · Start / Main menu","Landscape: brand+art left, one big PLAY, secondary actions stacked at the right thumb-rail.")

def s_levels():
    s=bg_menu()
    s+=txt(40,54,"FLIGHT MAP",size=26,fill=CREAM,w="800")
    s+=txt(40,78,"each level is a stop on the route",size=13,fill=MUTED)
    # star total chip top-right
    s+=rr(W-150,30,120,40,20,RAISED,stroke=PUR7,sop=.5)
    s+=star(W-128,50,11); s+=txt(W-108,56,"38 / 60",size=16,fill=GOLD,w="700")
    # winding route line connecting level nodes
    nodes=[(110,300,3,False),(230,210,2,False),(360,300,3,False),(490,200,1,False),
           (620,290,0,False),(750,200,None,True),(860,300,None,True)]
    # path
    d=f"M{nodes[0][0]} {nodes[0][1]}"
    for i in range(1,len(nodes)):
        px,py=nodes[i-1][0],nodes[i-1][1]; x,y=nodes[i][0],nodes[i][1]
        d+=f" Q{(px+x)/2} {min(py,y)-30} {x} {y}"
    s+=f'<path d="{d}" fill="none" stroke="{AMBER}" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" opacity="0.8"/>'
    for i,(x,y,st,locked) in enumerate(nodes):
        if locked:
            s+=circle(x,y,30,"#1c1830",stroke=GRAY,sw=2,sop=.6)
            s+=sicon(LOCK,x-11,y-11,22,GRAY,sw=2)
        else:
            s+=circle(x,y,30,RAISED,stroke=GREEN if i==4 else PUR7,sw=2.4,sop=.9 if i==4 else .5)
            s+=txt(x,y+6,str(i+1),size=20,fill=CREAM,anc="middle",w="700")
            for k in range(3):
                s+=star(x-16+k*16,y+44,7,fill=GOLD if k<st else "#3a3550")
    s+=chip(40,H-58,150,40,RAISED,"←  Back",col=CREAM,size=15,stroke=PUR7)
    s+=annot(560,420,"locked nodes = padlock · 1★ unlocks next ▶")
    return device(s,"02 · Level select — «Flight map»","On-theme: levels strung along a dashed route line (a flight plan). Stars under each stop; padlock = locked.")

def field(s):
    # shared in-game field backdrop (top-down)
    s+=rr(0,0,W,H,0,NAVY8)
    # grass / apron tint patches
    s+=rr(-10,300,W+20,170,0,"#20283a")
    # two runways (left/center), arrivals from right
    for ry in (120,250):
        s+=rr(70,ry,360,46,12,"#1b2032",stroke="#33405e",sw=1.4)
        s+=line(90,ry+23,410,ry+23,GOLD,2,op=.5,dash="14 16")
        for lx in range(95,415,40):
            s+=circle(lx,ry+4,1.8,AMBER,op=.7); s+=circle(lx,ry+42,1.8,AMBER,op=.7)
    # service boxes cluster (center-bottom)
    boxes=[(500,330,AMBER,WRENCH,"repair",None),
           (590,330,TEAL,FUEL,"fuel",None),
           (680,330,ROSE,USERS,"board",None),
           (770,330,GRAY,LOCK,"locked",3000)]
    for (bx,by,col,ic,nm,cost) in boxes:
        locked = nm=="locked"
        s+=rr(bx,by,74,74,16,"#1b2032" if locked else RAISED,stroke=col,sw=2,sop=.85)
        s+=sicon(ic,bx+22,by+18,30,col,sw=2.2)
        if cost: s+=cost_chip(bx+37,by+88,cost,affordable=True)
        else: s+=txt(bx+37,by+90,"Lv2",size=12,fill=MUTED,anc="middle")
    # de-icing box at right edge (always open)
    s+=rr(W-92,150,70,70,16,RAISED,stroke=BLUE,sw=2,sop=.8)
    s+=sicon(SNOW,W-78,164,30,BLUE,sw=2)
    return s

def s_hud():
    s=field("")
    # selected plane on runway -> green route to fuel box
    s+=f'<path d="M250 143 C360 150 430 250 627 360" fill="none" stroke="{GREEN}" stroke-width="6" opacity="0.35"/>'
    s+=f'<path d="M250 143 C360 150 430 250 627 360" fill="none" stroke="{GREEN}" stroke-width="3" opacity="0.95" stroke-dasharray="1 9" stroke-linecap="round"/>'
    s+=plane(250,143,52,rot=90,ring=None)
    s+=circle(250,143,26,"none",stroke=GREEN,sw=2.4)         # selected ring
    # plane waiting in air, right, patience running out
    s+=plane(W-150,300,50,rot=200,ring=0.7)
    # plane parked
    s+=plane(540,200,46,rot=120)
    # ---- HUD: ONE slim translucent top bar ----
    s+=rr(0,0,W,52,0,"#15121f",op=0.82)
    s+=line(0,52,W,52,PUR7,1,op=.4)
    # left cluster: lives + money + combo
    s+=heart(26,26,9); s+=heart(48,26,9); s+=heart(70,26,9,fill="#3a3550")
    s+=coin(112,26,11); s+=txt(128,31,"12 450",size=17,fill=CREAM,w="700")
    s+=rr(210,12,54,28,14,"#2a1f3a",stroke=PURPLE,sw=1.3,sop=.8)
    s+=txt(237,31,"×2",size=16,fill=PURPLE,anc="middle",w="800")
    # center: level + goal progress + timer
    s+=txt(W/2,20,"LEVEL 12 · accept 20 planes",size=13,fill=MUTED,anc="middle",w="600")
    s+=rr(W/2-130,28,260,12,6,"#241f33",stroke=PUR7,sop=.5)
    s+=rr(W/2-130,28,260*0.6,12,6,GREEN)
    s+=txt(W/2,38,"12 / 20",size=10,fill="#0d2415",anc="middle",w="700")
    # right: timer + pause (pause big, top-right)
    s+=txt(W-150,32,"02:45",size=18,fill=CREAM,anc="middle",w="700")
    s+=rr(W-96,10,86,34,17,RAISED,stroke=PUR7,sop=.6)
    s+=rr(W-72,18,6,18,2,CREAM); s+=rr(W-60,18,6,18,2,CREAM)
    s+=txt(W-36,31,"⏸",size=0,fill=CREAM)  # bars drawn above
    # contextual aircraft to-do, floating beside selected plane (not blocking field)
    tx,ty=286,96
    s+=line(262,138,tx+18,ty+44,PURPLE,1.4,op=.5,dash="3 4")
    s+=rr(tx,ty,150,52,14,"#15121f",stroke=PURPLE,sw=1.4,sop=.8,op=.96)
    s+=txt(tx+12,ty+18,"A320 → to-do",size=11,fill=MUTED,w="600")
    s+=circle(tx+22,ty+36,11,"#241f33",stroke=TEAL,sw=1.4); s+=sicon(FUEL,tx+15,ty+29,14,TEAL,1.8)
    s+=line(tx+34,ty+36,tx+46,ty+36,MUTED,1.4)
    s+=circle(tx+58,ty+36,11,"#241f33",stroke=GOLD,sw=1.4); s+=sicon(PLANE_NOSE_UP,tx+51,ty+29,14,GOLD,1.6)
    # annotations (placed in genuinely empty zones)
    s+=annot(40,438,"◀ centre kept clear — draw routes across the whole field",GREEN)
    s+=annot(446,120,"◀ to-do floats next to the tapped plane",PURPLE)
    s+=annot(640,250,"patience ring ▾",AMBER)
    s+=annot(498,438,"cost / upgrade chip on each box",GOLD)
    return device(s,"03 · In-game HUD  (the hero screen)","Field stays clear for drawing. One slim top bar (lives·money·combo | level+goal | timer·pause). Economy on the boxes; to-do floats by the plane.")

def s_aircraft():
    s=field("")
    s+=plane(300,200,60,rot=90)
    s+=circle(300,200,30,"none",stroke=GREEN,sw=2.6)
    # big expanded aircraft card (on tap-hold) anchored top-left, semi
    cx,cy=40,70; cw,ch=320,250
    s+=rr(cx,cy,cw,ch,20,"#15121f",stroke=PURPLE,sw=1.6,sop=.85,op=.97)
    s+=plane(cx+44,cy+50,52,rot=90)
    s+=txt(cx+86,cy+40,"A320  ·  passenger",size=16,fill=CREAM,w="700")
    s+=txt(cx+86,cy+60,"gate A3",size=12,fill=MUTED)
    # bars
    def bar(yy,lab,frac,col):
        out=txt(cx+24,yy+4,lab,size=12,fill=MUTED)
        out+=rr(cx+120,yy-9,160,13,6,"#241f33",stroke=PUR7,sop=.4)
        out+=rr(cx+120,yy-9,160*frac,13,6,col)
        out+=txt(cx+cw-16,yy+3,f"{int(frac*100)}%",size=11,fill=CREAM,anc="end",w="600")
        return out
    s+=bar(cy+108,"Passengers",156/189,ROSE)
    s+=bar(cy+136,"Fuel",0.74,TEAL)
    s+=bar(cy+164,"Condition",0.92,GREEN)
    # to-do queue row
    s+=txt(cx+24,cy+200,"TO-DO",size=11,fill=PURPLE,w="700",ls=".5")
    seq=[(WRENCH,AMBER),(FUEL,TEAL),(USERS,ROSE),(PLANE_NOSE_UP,GOLD)]
    bxx=cx+24
    for i,(ic,col) in enumerate(seq):
        s+=circle(bxx+14,cy+226,15,"#241f33",stroke=col,sw=1.6)
        s+=sicon(ic,bxx+5,cy+217,18,col,1.8)
        if i<3: s+=line(bxx+30,cy+226,bxx+44,cy+226,MUTED,1.5)
        bxx+=46
    s+=annot(380,90,"tap a plane ▶ contextual card",PURPLE)
    s+=annot(380,112,"strict order: repair→fuel→board→depart",MUTED)
    return device(s,"04 · Aircraft info / to-do","Tap a plane: a card shows type, fuel/board/condition bars and the ordered task queue. Drag to the next box to advance.")

def s_pause():
    s=field("")  # dimmed field behind
    s+=rr(0,0,W,H,0,"#0a0810",op=0.62)
    cw,ch=460,300; cx=(W-cw)/2; cy=(H-ch)/2
    s+=rr(cx,cy,cw,ch,24,RAISED,stroke=PUR7,sop=.6)
    s+=txt(cx+cw/2,cy+42,"‖  PAUSED",size=22,fill=CREAM,anc="middle",w="800",ls=".5")
    s+=txt(cx+cw/2,cy+70,"Level 12 · accept 20 planes",size=13,fill=MUTED,anc="middle")
    # goal recap rows
    rows=[("★  reach the goal","12 / 20",GREEN),
          ("★★  no half-pay departures","2 overdue",AMBER),
          ("★★★  no crashes","0 ✓",GREEN)]
    yy=cy+96
    for lab,val,col in rows:
        s+=rr(cx+28,yy,cw-56,30,10,"#1c1830",stroke=PUR7,sop=.3)
        s+=txt(cx+42,yy+20,lab,size=13,fill=CREAM)
        s+=txt(cx+cw-42,yy+20,val,size=12,fill=col,anc="end",w="700")
        yy+=38
    # button row at the bottom (thumb)
    bw=(cw-56-2*14)/3
    s+=chip(cx+28,cy+ch-58,bw,42,GREEN,"▶ Resume",col="#10331c",size=15)
    s+=chip(cx+28+bw+14,cy+ch-58,bw,42,TEAL,"↻ Restart",col="#0d2b2a",size=15)
    s+=chip(cx+28+2*(bw+14),cy+ch-58,bw,42,RAISED,"⌂ Menu",col=CREAM,size=15,stroke=PUR7)
    # settings gear top-right of card
    s+=circle(cx+cw-30,cy+30,16,"#1c1830",stroke=PUR7,sw=1.4)
    s+=sicon(GEAR,cx+cw-40,cy+20,20,MUTED,1.6)
    return device(s,"05 · Pause","Field dimmed, not hidden. Goal/star recap + thumb-row of Resume·Restart·Menu. Gear opens settings.")

def s_goals():
    s=bg_menu()
    cw,ch=480,300; cx=(W-cw)/2; cy=(H-ch)/2
    s+=rr(cx,cy,cw,ch,24,RAISED,stroke=PUR7,sop=.6)
    s+=txt(cx+cw/2,cy+44,"SHIFT GOALS",size=22,fill=CREAM,anc="middle",w="800",ls=".5")
    s+=txt(cx+cw/2,cy+68,"Level 12",size=14,fill=AMBER,anc="middle",w="600")
    rows=[("★","Accept 20 planes this shift",GOLD),
          ("★★","…and no half-pay (overdue) departures",GOLD),
          ("★★★","…and zero crashes",GOLD)]
    yy=cy+98
    for stars,lab,col in rows:
        s+=rr(cx+28,yy,cw-56,40,12,"#1c1830",stroke=PUR7,sop=.3)
        s+=txt(cx+48,yy+26,stars,size=16,fill=GOLD,w="700")
        s+=txt(cx+108,yy+26,lab,size=13,fill=CREAM)
        yy+=50
    s+=chip(cx+cw/2-90,cy+ch-56,180,42,GREEN,"✓  Got it",col="#10331c",size=16)
    return device(s,"06 · Shift goals (start of level)","Shown when a level begins. Three star tiers, big single CTA. Reopen from Pause.")

def s_over():
    s=bg_menu()
    s+=txt(W/2,70,"SHIFT COMPLETE",size=24,fill=CREAM,anc="middle",w="800",ls=".5")
    # 3 big stars, 2 earned
    s+=star(W/2-90,140,42,fill=GOLD,stroke="#d8a93b")
    s+=star(W/2,124,52,fill=GOLD,stroke="#d8a93b")
    s+=star(W/2+90,140,42,fill="#3a3550")
    # stats row
    stats=[("Planes","24",CREAM),("Money","18 600",GOLD),("Best combo","×2",PURPLE),("Overdue","2",AMBER)]
    bw=170; total=len(stats)*bw+ (len(stats)-1)*14; sx=(W-total)/2
    for lab,val,col in stats:
        s+=rr(sx,230,bw,70,16,RAISED,stroke=PUR7,sop=.4)
        s+=txt(sx+bw/2,262,val,size=22,fill=col,anc="middle",w="800")
        s+=txt(sx+bw/2,286,lab,size=12,fill=MUTED,anc="middle")
        sx+=bw+14
    # buttons
    s+=chip(W/2-250,H-72,150,46,RAISED,"≡ Levels",col=CREAM,size=15,stroke=PUR7)
    s+=chip(W/2-90,H-72,150,46,TEAL,"↻ Retry",col="#0d2b2a",size=15)
    s+=chip(W/2+70,H-72,180,46,GREEN,"⏭ Next level",col="#10331c",size=16)
    return device(s,"07 · End of shift","Stars animate in, key stats as chips, three clear exits (Levels · Retry · Next). Next is the primary.")

def s_settings():
    s=bg_menu()
    cw,ch=520,320; cx=(W-cw)/2; cy=(H-ch)/2
    s+=rr(cx,cy,cw,ch,24,RAISED,stroke=PUR7,sop=.6)
    s+=txt(cx+cw/2,cy+44,"⚙  SETTINGS",size=22,fill=CREAM,anc="middle",w="800")
    def toggle(yy,lab,on):
        out=txt(cx+36,yy+5,lab,size=15,fill=CREAM)
        tx=cx+cw-92
        out+=rr(tx,yy-12,56,28,14,GREEN if on else "#2a2540",stroke=PUR7,sop=.5)
        out+=circle(tx+(40 if on else 16),yy+2,11,CREAM)
        return out
    yy=cy+90
    for lab,on in [("Sound",True),("Vibration",True),("Infinite lives",False),("Infinite money",False)]:
        s+=toggle(yy,lab,on); s+=line(cx+36,yy+22,cx+cw-36,yy+22,PUR7,1,op=.3); yy+=46
    # language row
    s+=txt(cx+36,yy+5,"Language",size=15,fill=CREAM)
    s+=chip(cx+cw-150,yy-14,46,30,GREEN,"RU",col="#10331c",size=13)
    s+=chip(cx+cw-98,yy-14,46,30,"#2a2540","EN",col=CREAM,size=13,stroke=PUR7)
    # buttons
    s+=chip(cx+36,cy+ch-58,180,42,"#2a1f24","⟲ Reset progress",col=ROSE,size=14,stroke=ROSE)
    s+=chip(cx+cw-176,cy+ch-58,140,42,GREEN,"← Back",col="#10331c",size=15)
    return device(s,"08 · Settings","Big toggle switches (sound·vibro·assist cheats), language pills, destructive Reset set apart in rose.")

def s_medals():
    s=bg_menu()
    s+=txt(40,54,"MEDALS",size=26,fill=CREAM,w="800")
    s+=txt(40,78,"18 / 46 earned",size=13,fill=MUTED)
    cols=6; rows=3; gx=128; gy=96; cw=120; ch=104
    states=[True,True,False,True,True,False, True,False,True,True,False,True, False,True,True,False,True,False]
    i=0
    for r in range(rows):
        for c in range(cols):
            x=40+c*(gx); y=gy+r*(ch+14)
            earned=states[i]; i+=1
            s+=rr(x,y,cw,ch,16,RAISED if earned else "#1c1830",stroke=GOLD if earned else PUR7,sw=1.6,sop=.6 if earned else .3)
            s+=circle(x+cw/2,y+38,24,"#241f33",stroke=GOLD if earned else GRAY,sw=2)
            if earned: s+=sicon(MEDAL,x+cw/2-12,y+24,24,GOLD,2)
            else: s+=sicon(LOCK,x+cw/2-11,y+27,22,GRAY,2)
            s+=txt(x+cw/2,y+78,"Medal",size=11,fill=CREAM if earned else GRAY,anc="middle",w="600")
            s+=txt(x+cw/2,y+94,"earned" if earned else "locked",size=9,fill=MUTED,anc="middle")
    s+=chip(40,H-56,150,40,RAISED,"← Back",col=CREAM,size=15,stroke=PUR7)
    return device(s,"09 · Medals / Achievements","Grid of warm tiles; earned = gold medal, locked = padlock. Scrollable; tap for detail.")

# ================================================================ FLOW MAP
def s_flow():
    FW,FH=1180,640
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{FW}" height="{FH}" viewBox="0 0 {FW} {FH}">'
    s+=f'<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{INK}"/><stop offset="1" stop-color="{NAVY}"/></linearGradient></defs>'
    s+=rr(0,0,FW,FH,0,"url(#fg)")
    s+=txt(40,52,"PlaneFlow — Screen Flow",size=26,fill=CREAM,w="800",ls=".5")
    s+=txt(40,76,"how the screens connect",size=14,fill=MUTED)
    def node(x,y,w,h,t,col,sub=""):
        out=rr(x,y,w,h,16,RAISED,stroke=col,sw=2,sop=.8)
        out+=txt(x+w/2,y+(h/2+6 if not sub else h/2-2),t,size=16,fill=CREAM,anc="middle",w="700")
        if sub: out+=txt(x+w/2,y+h/2+16,sub,size=11,fill=MUTED,anc="middle")
        return out
    def arrow(x1,y1,x2,y2,col=GRAY,lab="",dash=None):
        out=line(x1,y1,x2,y2,col,2.2,op=.9,dash=dash)
        ang=math.atan2(y2-y1,x2-x1)
        ax,ay=x2,y2
        out+=f'<polygon points="{ax},{ay} {ax-10*math.cos(ang-0.4):.1f},{ay-10*math.sin(ang-0.4):.1f} {ax-10*math.cos(ang+0.4):.1f},{ay-10*math.sin(ang+0.4):.1f}" fill="{col}"/>'
        if lab: out+=txt((x1+x2)/2,(y1+y2)/2-8,lab,size=11,fill=col,anc="middle",w="600")
        return out
    def poly(pts,col,lab="",labxy=None,dash=None):
        d="M"+" L".join(f"{x:.0f} {y:.0f}" for x,y in pts)
        out=f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2.2" opacity="0.9" stroke-linecap="round" stroke-linejoin="round"'
        if dash: out+=f' stroke-dasharray="{dash}"'
        out+="/>"
        (x1,y1),(x2,y2)=pts[-2],pts[-1]; ang=math.atan2(y2-y1,x2-x1)
        out+=f'<polygon points="{x2},{y2} {x2-10*math.cos(ang-0.4):.1f},{y2-10*math.sin(ang-0.4):.1f} {x2-10*math.cos(ang+0.4):.1f},{y2-10*math.sin(ang+0.4):.1f}" fill="{col}"/>'
        if lab and labxy: out+=txt(labxy[0],labxy[1],lab,size=11,fill=col,anc="middle",w="600")
        return out
    # nodes
    s+=node(70,140,180,70,"Start / Menu",GREEN)
    s+=node(70,300,180,60,"Settings",MUTED)
    s+=node(70,400,180,56,"Reset confirm",ROSE)
    s+=node(70,500,180,56,"Medals",GOLD)
    s+=node(380,140,180,70,"Level select",AMBER,"«Flight map»")
    s+=node(380,320,180,64,"Shift goals",PURPLE,"start of level")
    s+=node(700,200,210,90,"IN-GAME (HUD)",GREEN,"routing · the core loop")
    s+=node(700,400,210,60,"Pause",BLUE)
    s+=node(1000,200,150,70,"Aircraft card",PURPLE,"tap a plane")
    s+=node(700,540,210,64,"End of shift",GOLD,"stars · stats")
    # arrows
    s+=arrow(250,170,380,170,GRAY,"Play / Levels")          # menu -> levels
    s+=arrow(160,210,160,300,GRAY)                           # menu -> settings
    s+=arrow(160,360,160,400,ROSE,"reset")                  # settings -> reset
    s+=poly([(70,186),(34,186),(34,528),(70,528)],GOLD)     # menu -> medals (left rail)
    s+=poly([(160,210),(160,250),(690,250),(700,250)],GREEN,"Zen (direct)",(420,242))  # menu -> in-game
    s+=arrow(470,210,470,320,AMBER,"tap level")             # levels -> goals
    s+=arrow(560,345,700,262,PURPLE,"Got it")               # goals -> in-game
    s+=arrow(795,290,795,400,BLUE,"")                        # in-game -> pause
    s+=txt(770,350,"pause",size=11,fill=BLUE,anc="end",w="600")
    s+=arrow(818,400,818,290,GRAY,"")                        # pause -> resume
    s+=txt(842,350,"resume",size=11,fill=GRAY,anc="start",w="600")
    s+=arrow(910,235,1000,235,PURPLE,"tap plane")           # in-game -> aircraft card
    s+=poly([(910,272),(960,272),(960,572),(910,572)],GOLD) # in-game -> end (right rail)
    s+=txt(968,420,"goal met /",size=11,fill=GOLD,anc="start",w="600")
    s+=txt(968,434,"out of lives",size=11,fill=GOLD,anc="start",w="600")
    s+=poly([(700,556),(660,556),(660,110),(470,110),(470,140)],GRAY,"Levels / Retry / Next",(560,100),dash="4 6")  # end -> levels
    s+='</svg>'
    return s

# ================================================================ RENDER
def render_svg(name,svg,fw=None,fh=None):
    open(os.path.join(HERE,name+".svg"),"w").write(svg)
    png=os.path.join(HERE,name+".png")
    if fw: cairosvg.svg2png(bytestring=svg.encode(),write_to=png,output_width=fw*2,output_height=fh*2)
    else:  cairosvg.svg2png(bytestring=svg.encode(),write_to=png,output_width=(W+2*BW)*2,output_height=(TITLE+2*BW+H)*2)
    print("rendered",name); return png

def render_all():
    SCREENS=[("00-flow",s_flow,1180,640),
             ("01-start",s_start,None,None),
             ("02-levels",s_levels,None,None),
             ("03-hud",s_hud,None,None),
             ("04-aircraft",s_aircraft,None,None),
             ("05-pause",s_pause,None,None),
             ("06-goals",s_goals,None,None),
             ("07-over",s_over,None,None),
             ("08-settings",s_settings,None,None),
             ("09-medals",s_medals,None,None)]
    paths=[]
    for name,fn,fw,fh in SCREENS:
        paths.append((name,render_svg(name,fn(),fw,fh)))
    # contact sheet (skip the flow map; just the 9 screens, 3x3)
    screens=[p for n,p in paths if n!="00-flow"]
    thumbs=[Image.open(p).convert("RGB") for p in screens]
    tw=thumbs[0].width//2; th=thumbs[0].height//2
    pad=24; cols=3; rows=3
    sheet=Image.new("RGB",(cols*tw+(cols+1)*pad, rows*th+(rows+1)*pad),(13,11,20))
    for i,im in enumerate(thumbs):
        im=im.resize((tw,th)); r,c=divmod(i,cols)
        sheet.paste(im,(pad+c*(tw+pad), pad+r*(th+pad)))
    sheet.save(os.path.join(HERE,"overview.png"))
    print("contact sheet -> overview.png")

if __name__=="__main__":
    render_all()
    print("DONE")

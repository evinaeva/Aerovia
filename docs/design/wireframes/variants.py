# -*- coding: utf-8 -*-
"""
PlaneFlow — redesign VARIANTS for screen 01 (Start) and screen 03 (HUD).

These are alternative directions to choose between before the rework of those two
screens (see docs/art-direction/wireframes.md). Reuses helpers from build.py.

Run:  python3 variants.py   ->  var-*.png  + variants-overview.png
"""
from build import *   # palette, primitives, plane(), field(), device(), chip(), etc.
from PIL import Image
import os

def perf(x,y0,y1):  # perforated tear line
    s=line(x,y0,x,y1,"#cdbf9f",2,op=.7,dash="3 6")
    return s

# ---------------------------------------------------------------- START variants
def start_A():
    """Boarding-pass ticket: brand + fake flight fields, tear-off PLAY stub."""
    s=bg_menu()
    cw,ch=720,290; cx=(W-cw)/2; cy=(H-ch)/2-10
    stub=210; mainw=cw-stub
    # ticket body (warm paper)
    s+=rr(cx,cy,cw,ch,22,CREAM)
    s+=rr(cx,cy,cw,ch,22,"none",stroke=CREAMSH,sw=1.5)
    # notches + perforation between main & stub
    dx=cx+mainw
    s+=circle(dx,cy,11,INK); s+=circle(dx,cy+ch,11,INK)
    s+=perf(dx,cy+14,cy+ch-14)
    # ---- main section ----
    s+=txt(cx+34,cy+58,"PLANEFLOW",size=42,fill=INK,w="800",ls=".5")
    s+=circle(cx+40,cy+86,5,GREEN); s+=txt(cx+54,cy+92,"boarding now — route the planes",size=14,fill="#5b5468")
    def fld(x,lab,val):
        out=txt(x,cy+150,lab,size=10,fill="#8a8398",w="700",ls=".15em")
        out+=txt(x,cy+176,val,size=20,fill=INK,w="700")
        return out
    s+=fld(cx+34,"FLIGHT","PF · 20")
    s+=fld(cx+170,"GATE","A-3")
    s+=fld(cx+270,"SEAT","∞")
    s+=fld(cx+360,"BOARDS","∞ : ∞")
    # secondary actions as little ticket stamps
    for i,(lab,col) in enumerate([("☾ Zen",TEAL),("≡ Levels",PURPLE),("🏅 Medals",GOLD),("⚙",GRAY)]):
        bx=cx+34+i*112
        s+=rr(bx,cy+ch-58,100 if i<3 else 46,38,12,"#efe7d4",stroke=col,sw=1.4)
        s+=txt(bx+(50 if i<3 else 23),cy+ch-34,lab,size=13,fill="#4a4458",anc="middle",w="700")
    # ---- tear-off stub: big PLAY ----
    s+=txt(dx+stub/2,cy+44,"BOARDING PASS",size=10,fill="#8a8398",anc="middle",w="700",ls=".2em")
    s+=chip(dx+24,cy+72,stub-48,70,GREEN,"▶  PLAY",col="#10331c",size=26)
    s+=txt(dx+stub/2,cy+176,"your shift starts here",size=11,fill="#8a8398",anc="middle")
    # barcode
    import random; random.seed(7); bxx=dx+24
    while bxx<dx+stub-24:
        wbar=random.choice([2,2,3,5]); s+=rr(bxx,cy+196,wbar,46,0,INK); bxx+=wbar+random.choice([2,3,4])
    s+=txt(cx+cw/2,cy+ch+34,"variant A — «Boarding pass»",size=13,fill=GOLD,anc="middle",w="700")
    return device(s,"01 · Start — variant A","Whole menu IS a boarding pass: brand + flight fields on the body, PLAY as the tear-off stub, secondary actions as stamps. Most on-theme.")

def start_B():
    """Living top-down airport as the hero; translucent right dock."""
    s=field("")               # reuse the real top-down field as a living backdrop
    # a couple of planes drifting + a faint route
    s+=f'<path d="M250 143 C360 150 430 250 560 300" fill="none" stroke="{GREEN}" stroke-width="3" opacity="0.5" stroke-dasharray="1 9" stroke-linecap="round"/>'
    s+=plane(250,143,52,rot=90); s+=plane(W-180,260,48,rot=210); s+=plane(150,300,44,rot=20,body=GOLD,sh="#d8a93b",wing="#eabf4e")
    # darken for legibility
    s+=rr(0,0,W,H,0,"#0c0a14",op=.34)
    # wordmark top-left
    s+=txt(40,70,"PLANEFLOW",size=46,fill=CREAM,w="800",ls=".5")
    s+=txt(42,96,"route the planes · keep the flow",size=14,fill=CREAM2,op=.85)
    # translucent right dock
    cx=666; cw=214
    s+=rr(cx-18,52,cw+36,H-104,26,"#15121f",stroke=PUR7,sop=.5,op=.78)
    s+=chip(cx,90,cw,60,GREEN,"▶  PLAY",col="#10331c",size=22)
    s+=chip(cx,164,cw,46,TEAL,"☾  Zen",col="#0d2b2a",size=16)
    s+=chip(cx,220,cw,46,"#211d33","≡  Levels",col=CREAM,size=16,stroke=PUR7)
    s+=chip(cx,276,cw,46,"#211d33","🏅 Medals",col=CREAM,size=16,stroke=PUR7)
    s+=chip(cx,332,cw,46,"#211d33","⚙  Settings",col=CREAM,size=16,stroke=PUR7)
    s+=txt(W/2,H+0,"",size=1,fill=CREAM)
    s+=txt(353,H-26,"variant B — «Living airport»",size=13,fill=GOLD,anc="middle",w="700")
    return device(s,"01 · Start — variant B","The actual airport runs behind the menu (planes taxi, routes glow). Wordmark top-left, translucent action dock on the right. Most immersive.")

def start_C():
    """Split-flap departures board; menu items are flights."""
    s=bg_menu()
    bx,by,bw,bh=70,70,W-140,H-150
    s+=rr(bx,by,bw,bh,18,"#15121f",stroke=PUR7,sop=.5)
    # header bar
    s+=rr(bx,by,bw,46,18,"#241f33")
    s+=rr(bx,by+30,bw,16,0,"#241f33")
    s+=txt(bx+24,by+30,"PLANEFLOW",size=22,fill=GOLD,w="800",ls=".3em")
    s+=txt(bx+bw-24,by+30,"DEPARTURES",size=14,fill=AMBER,anc="end",w="700",ls=".2em")
    # column heads
    cols=[(bx+24,"TIME"),(bx+150,"DESTINATION"),(bx+bw-220,"GATE"),(bx+bw-120,"STATUS")]
    for x,h in cols: s+=txt(x,by+72,h,size=10,fill=GRAY,w="700",ls=".15em")
    rows=[("NOW","▶  PLAY — your shift","1","BOARDING",GREEN),
          ("∞","☾  ZEN — endless sky","2","ON TIME",TEAL),
          ("--","≡  LEVELS — route map","3","SCHEDULED",CREAM),
          ("--","🏅 MEDALS — trophy hall","4","SCHEDULED",GOLD),
          ("--","⚙  SETTINGS — ops room","5","SCHEDULED",MUTED)]
    yy=by+90; rh=(bh-110)/len(rows)
    for tm,dest,gate,stat,col in rows:
        s+=rr(bx+16,yy,bw-32,rh-8,10,"#1c1830",stroke=PUR7,sop=.3)
        s+=txt(bx+24,yy+rh/2+2,tm,size=16,fill=AMBER,w="700")
        s+=txt(bx+150,yy+rh/2+2,dest,size=17,fill=CREAM,w="700")
        s+=txt(bx+bw-220,yy+rh/2+2,gate,size=16,fill=CREAM2,w="700")
        s+=chip(bx+bw-130,yy+rh/2-13,100,26,"#241f33",stat,col=col,size=11,stroke=col)
        yy+=rh
    s+=txt(W/2,H-26,"variant C — «Departures board»",size=13,fill=GOLD,anc="middle",w="700")
    return device(s,"01 · Start — variant C","An airport split-flap board: each menu item is a flight (PLAY = now boarding). Playful, text-forward, very thematic.")

# ---------------------------------------------------------------- HUD variants
def _field_with_action():
    s=field("")
    s+=f'<path d="M250 143 C360 150 430 250 627 360" fill="none" stroke="{GREEN}" stroke-width="6" opacity="0.32"/>'
    s+=f'<path d="M250 143 C360 150 430 250 627 360" fill="none" stroke="{GREEN}" stroke-width="3" opacity="0.95" stroke-dasharray="1 9" stroke-linecap="round"/>'
    s+=plane(250,143,52,rot=90); s+=circle(250,143,26,"none",stroke=GREEN,sw=2.4)
    s+=plane(W-150,300,50,rot=200,ring=0.7); s+=plane(540,200,46,rot=120)
    return s

def hud_B():
    """Corners / minimal — no full top bar, controls in the corners."""
    s=_field_with_action()
    # top-left status pill (lives + coin + combo) only
    s+=rr(14,12,250,38,19,"#15121f",stroke=PUR7,sop=.6,op=.9)
    s+=heart(36,31,8); s+=heart(56,31,8); s+=heart(76,31,8,fill="#3a3550")
    s+=coin(112,31,9); s+=txt(126,36,"12 450",size=15,fill=CREAM,w="700")
    s+=rr(210,20,44,22,11,"#2a1f3a",stroke=PURPLE,sw=1.2,sop=.8); s+=txt(232,36,"×2",size=13,fill=PURPLE,anc="middle",w="800")
    # top-center goal badge (compact ring)
    s+=circle(W/2,34,26,"#15121f",stroke=PUR7,sw=2,sop=.6)
    s+=f'<path d="M{W/2} 8 A26 26 0 1 1 {W/2-18:.0f} 52" fill="none" stroke="{GREEN}" stroke-width="4" stroke-linecap="round"/>'
    s+=txt(W/2,38,"12/20",size=12,fill=CREAM,anc="middle",w="700")
    s+=txt(W/2,72,"LEVEL 12",size=9,fill=MUTED,anc="middle",w="700",ls=".2em")
    # bottom-RIGHT round pause (thumb) + timer above it
    s+=txt(W-44,H-78,"02:45",size=15,fill=CREAM,anc="middle",w="700")
    s+=circle(W-44,H-44,26,RAISED,stroke=PUR7,sw=1.6,sop=.7)
    s+=rr(W-52,H-56,6,24,2,CREAM); s+=rr(W-40,H-56,6,24,2,CREAM)
    s+=annot(40,H-30,"◀ no top bar — maximum clear field; pause sits under the thumb",GREEN)
    return device(s,"03 · HUD — variant B","Minimal: a status pill top-left, a small goal ring top-centre, and a round pause in the bottom-right thumb zone. The most field-first option.")

def hud_C():
    """Tower console — a thin bottom strip holds run stats."""
    s=_field_with_action()
    # top-right small cluster: lives + pause
    s+=rr(W-150,12,138,34,17,"#15121f",stroke=PUR7,sop=.6,op=.9)
    s+=heart(W-130,29,7); s+=heart(W-112,29,7); s+=heart(W-94,29,7,fill="#3a3550")
    s+=rr(W-70,18,46,22,11,RAISED,stroke=PUR7,sop=.6)
    s+=rr(W-54,23,5,12,2,CREAM); s+=rr(W-44,23,5,12,2,CREAM)
    # bottom console strip
    bh=50
    s+=rr(0,H-bh,W,bh,0,"#15121f",op=.9); s+=line(0,H-bh,W,H-bh,PUR7,1,op=.5)
    s+=coin(36,H-bh/2,11); s+=txt(52,H-bh/2+6,"12 450",size=17,fill=CREAM,w="700")
    s+=rr(150,H-bh/2-13,54,26,13,"#2a1f3a",stroke=PURPLE,sw=1.2,sop=.8); s+=txt(177,H-bh/2+5,"×2",size=15,fill=PURPLE,anc="middle",w="800")
    # goal progress center
    s+=txt(W/2,H-bh/2-8,"LEVEL 12 · accept 20 planes",size=12,fill=MUTED,anc="middle",w="600")
    s+=rr(W/2-140,H-bh/2+2,280,12,6,"#241f33",stroke=PUR7,sop=.5); s+=rr(W/2-140,H-bh/2+2,280*.6,12,6,GREEN)
    # timer right of strip
    s+=txt(W-40,H-bh/2+6,"02:45",size=17,fill=CREAM,anc="end",w="700")
    s+=annot(40,40,"lives + pause top-right · everything else on the bottom console ▾",BLUE)
    return device(s,"03 · HUD — variant C","Tower-console feel: run stats (money·combo·goal·timer) live on a thin bottom strip; only lives+pause sit top-right. Field stays open in the middle.")

# ---------------------------------------------------------------- render
VARS=[("var-start-A",start_A),("var-start-B",start_B),("var-start-C",start_C),
      ("var-hud-B",hud_B),("var-hud-C",hud_C)]
paths=[render_svg(n,fn()) for n,fn in VARS]
# contact sheet 2 rows: starts (3) / huds (use slot) — simple 3-col grid
thumbs=[Image.open(p).convert("RGB") for p in paths]
tw=thumbs[0].width//2; th=thumbs[0].height//2; pad=22; cols=3
rows=(len(thumbs)+cols-1)//cols
sheet=Image.new("RGB",(cols*tw+(cols+1)*pad, rows*th+(rows+1)*pad),(13,11,20))
for i,im in enumerate(thumbs):
    im=im.resize((tw,th)); r,c=divmod(i,cols)
    sheet.paste(im,(pad+c*(tw+pad), pad+r*(th+pad)))
sheet.save(os.path.join(HERE,"variants-overview.png"))
print("variants-overview.png  DONE")

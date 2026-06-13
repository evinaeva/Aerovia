# -*- coding: utf-8 -*-
CREAM="#f4eede";CREAM2="#e8e0cf";CREAMSH="#cdbf9f"
GOLD="#f4cf5e";GOLDSH="#d8a93b";GOLD2="#eabf4e"
AMBER="#f2a93b";TEAL="#4ecdc4";ROSE="#ef798a"
RED="#e0584f";GREEN="#5dca7a";PURPLE="#9a6fd4";BLUE="#4ab4d6"
INK="#211d33";NAVY="#16131f";RAISED="#2a2540";WINDOW="#2a3050"
TEXT="#f4eede";MUTED="#a8aab5"

# ---- cute, slim top-down plane (nose up, viewBox 0 0 64 64) ----
FUS=("M32 6.5 C34.2 6.5 35.5 9.5 35.9 13.5 C36.5 20 36.9 28 36.4 38 "
     "C36.0 46 34.4 53 32 56 C29.6 53 28.0 46 27.6 38 "
     "C27.1 28 27.5 20 28.1 13.5 C28.5 9.5 29.8 6.5 32 6.5 Z")
WINGL=("M28.6 27 C22 29 14 33 8.3 36.8 C6.2 38.1 6.6 40.4 8.9 39.9 "
       "C16 38 23 36 28.6 34.4 Z")
WINGR=("M35.4 27 C42 29 50 33 55.7 36.8 C57.8 38.1 57.4 40.4 55.1 39.9 "
       "C48 38 41 36 35.4 34.4 Z")
TAILL="M29.2 48.5 C26 50 22 52 20.4 53.6 C19.7 54.2 20.1 55.2 21 54.9 C24 54 27.4 52.6 29.6 51.6 Z"
TAILR="M34.8 48.5 C38 50 42 52 43.6 53.6 C44.3 54.2 43.9 55.2 43 54.9 C40 54 36.6 52.6 34.4 51.6 Z"

def plane_body(body,bodysh,wing,beacon=None,deco="",eng=None):
    eng=eng or bodysh
    s='<ellipse cx="32" cy="53.5" rx="16" ry="4.2" fill="#000" opacity="0.16"/>'
    for d in (WINGL,WINGR,TAILL,TAILR):
        s+=f'<path d="{d}" fill="{wing}" stroke="{bodysh}" stroke-width="0.7"/>'
    # little engine pods under the wings
    for ex in (17.5,46.5):
        s+=f'<ellipse cx="{ex}" cy="35.5" rx="2.2" ry="3" fill="{eng}" stroke="{bodysh}" stroke-width="0.5"/>'
        s+=f'<ellipse cx="{ex}" cy="33.4" rx="1.4" ry="1.1" fill="{WINDOW}" opacity="0.55"/>'
    s+=f'<path d="{FUS}" fill="{body}" stroke="{bodysh}" stroke-width="0.9"/>'
    # glossy highlight on the left of the fuselage -> toy-like, cute
    s+='<path d="M29.6 12 C28.8 20 28.6 30 29 42" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity="0.25"/>'
    # friendly rounded cockpit visor + shine
    s+=f'<path d="M28.9 13.5 C30 11 34 11 35.1 13.5 C35.6 16.2 34 18.4 32 18.4 C30 18.4 28.4 16.2 28.9 13.5 Z" fill="{WINDOW}"/>'
    s+='<ellipse cx="30.6" cy="14.2" rx="1.1" ry="1.5" fill="#bfe9ff" opacity="0.5"/>'
    # a couple of cabin window dots, soft
    for yy in (26,30,34):
        s+=f'<circle cx="32" cy="{yy}" r="1.0" fill="{WINDOW}" opacity="0.45"/>'
    s+=deco
    if beacon: s+=f'<circle cx="32" cy="8.6" r="1.5" fill="{beacon}"/>'
    return s

def ring_selected():
    return (f'<circle cx="32" cy="32" r="30" fill="none" stroke="{GREEN}" stroke-width="2.4" opacity="0.95"/>'
            f'<circle cx="32" cy="32" r="30" fill="none" stroke="{GREEN}" stroke-width="6" opacity="0.18"/>')
def ring_patience():
    return (f'<circle cx="32" cy="32" r="29" fill="none" stroke="{AMBER}" stroke-width="2.2" opacity="0.30"/>'
            f'<path d="M32 3 A29 29 0 1 1 8.5 46" fill="none" stroke="{RED}" stroke-width="2.6" stroke-linecap="round" opacity="0.95"/>')
def overlay_emergency():
    return (f'<circle cx="32" cy="32" r="30" fill="none" stroke="{RED}" stroke-width="2.4" opacity="0.9"/>'
            f'<circle cx="32" cy="32" r="30" fill="none" stroke="{RED}" stroke-width="8" opacity="0.16"/>')
def deco_medevac():
    return (f'<circle cx="32" cy="33" r="5.6" fill="#ffffff" stroke="{CREAMSH}" stroke-width="0.6"/>'
            f'<rect x="30.8" y="30" width="2.4" height="6" rx="0.6" fill="{RED}"/>'
            f'<rect x="29" y="31.8" width="6" height="2.4" rx="0.6" fill="{RED}"/>')
def deco_vip():
    return f'<rect x="27.6" y="21" width="8.8" height="2.2" rx="1.1" fill="{PURPLE}" opacity="0.9"/>'

def icon(paths,color,extra=""):
    body="".join(f'<path d="{d}"/>' for d in paths)
    return (f'<g fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{body}{extra}</g>')
WRENCH=['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']
FUEL=['M3 22h12','M4 9h10','M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18','M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5']
USERS=['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']
DEPART=['M2 22h20','M6.4 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3 4.99-1.5a2.5 2.5 0 0 1 1.5 4.77z']
ICONS={'svc-repair':(WRENCH,AMBER,''),'svc-fuel':(FUEL,TEAL,''),'svc-board':(USERS,ROSE,'<circle cx="9" cy="7" r="4"/>'),'svc-depart':(DEPART,GOLD,'')}

def sym(i,vb,inner): return f'  <symbol id="{i}" viewBox="{vb}">\n    {inner}\n  </symbol>\n'
planes={
 'plane-normal':plane_body(CREAM,CREAMSH,CREAM2,eng=BLUE),
 'plane-vip':plane_body(GOLD,GOLDSH,GOLD2,deco=deco_vip(),eng=PURPLE),
 'plane-selected':ring_selected()+plane_body(CREAM,CREAMSH,CREAM2,eng=BLUE),
 'plane-patience':ring_patience()+plane_body(CREAM,CREAMSH,CREAM2,eng=BLUE),
 'plane-emergency':overlay_emergency()+plane_body(CREAM,CREAMSH,CREAM2,beacon=RED,eng=BLUE),
 'plane-medevac':plane_body(CREAM,CREAMSH,CREAM2,beacon=RED,deco=deco_medevac(),eng=BLUE),
}
sheet='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">\n<defs>\n'
for k,v in planes.items(): sheet+=sym(k,"0 0 64 64",v)
for k,(p,c,e) in ICONS.items(): sheet+=sym(k,"0 0 24 24",icon(p,c,e))
sheet+='</defs>\n</svg>\n'
open('planeflow-batch1.svg','w').write(sheet)

W,H=920,720
def use(i,x,y,s): return f'<use href="#{i}" x="{x}" y="{y}" width="{s}" height="{s}"/>'
def card(x,y,w,h): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{RAISED}" stroke="{PURPLE}" stroke-opacity="0.22"/>'
def lab(x,y,t,size=13,col=TEXT,anc="middle",ls="0"): return f'<text x="{x}" y="{y}" font-family="monospace" font-size="{size}" letter-spacing="{ls}" fill="{col}" text-anchor="{anc}">{t}</text>'
p=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
p+=f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{INK}"/><stop offset="1" stop-color="{NAVY}"/></linearGradient></defs>'
p+=f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
p+='<defs>'+''.join(sym(k,"0 0 64 64",v) for k,v in planes.items())+''.join(sym(k,"0 0 24 24",icon(pp,c,e)) for k,(pp,c,e) in ICONS.items())+'</defs>'
p+=lab(40,46,"PLANEFLOW · BATCH 1 · COZY (v2 — cute)",20,TEXT,"start","2")
p+=lab(40,66,"стройные милые самолётики + состояния + 4 иконки услуг",12,MUTED,"start")
p+=lab(40,104,"САМОЛЁТЫ",12,PURPLE,"start","3")
x=40
for pid,nm in [("plane-normal","обычный"),("plane-vip","VIP (золотой)")]:
    p+=card(x,116,150,150); p+=use(pid,x+30,129,90); p+=lab(x+75,254,nm,13); x+=170
p+=lab(40,308,"СОСТОЯНИЯ",12,PURPLE,"start","3")
x=40
for pid,nm in [("plane-selected","выбран"),("plane-patience","терпение на исходе"),("plane-emergency","emergency"),("plane-medevac","medevac")]:
    p+=card(x,320,150,150); p+=use(pid,x+30,333,90); p+=lab(x+75,458,nm,12); x+=170
p+=lab(40,512,"ИКОНКИ УСЛУГ",12,PURPLE,"start","3")
x=40
for sid,nm,col in [("svc-repair","ремонт",AMBER),("svc-fuel","топливо",TEAL),("svc-board","посадка",ROSE),("svc-depart","вылет",GOLD)]:
    p+=card(x,524,150,150)
    p+=f'<rect x="{x+45}" y="546" width="60" height="60" rx="16" fill="{NAVY}" stroke="{col}" stroke-opacity="0.5"/>'
    p+=use(sid,x+57,558,36); p+=lab(x+75,632,nm,12); x+=170
p+='</svg>\n'
open('preview.svg','w').write(p)
import cairosvg
cairosvg.svg2png(url='preview.svg',write_to='preview.png',output_width=W*2,output_height=H*2)
print("OK v2")

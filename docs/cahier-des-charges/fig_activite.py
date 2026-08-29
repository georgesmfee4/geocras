# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1080, 1420)

LANES = [("CLIENT", 40, 300), ("APPLICATION MOBILE", 340, 340), ("SERVEUR", 680, 360)]
TOP, BOT = 34, 1390
for name, x, w in LANES:
    s.rect(x, TOP, w, BOT - TOP, fill=BG, stroke=RULE, sw=1.3)
    s.rect(x, TOP, w, 34, fill=PANEL, stroke=RULE, sw=1.3)
    s.text(x + w / 2, TOP + 22, name, size=11, anchor="middle", weight="700", ls="1.4", fill=INK2)

CL, AP, SR = 190, 510, 860

def act(cx, cy, label, w=250, h=48, fill=BG, stroke=INK):
    lines = label if isinstance(label, list) else [label]
    h = max(h, 22 + len(lines) * 16)
    s.rect(cx - w / 2, cy - h / 2, w, h, fill=fill, stroke=stroke, sw=1.6, rx=h / 2)
    off = -((len(lines) - 1) * 16) / 2
    for i, l in enumerate(lines):
        s.text(cx, cy + off + i * 16 + 5, l, size=12, anchor="middle")
    return cy + h / 2

def dec(cx, cy, label, w=132, h=72):
    s.add(f'<polygon points="{cx},{cy-h/2} {cx+w/2},{cy} {cx},{cy+h/2} {cx-w/2},{cy}" '
          f'fill="{BG}" stroke="{INK}" stroke-width="1.6"/>')
    lines = label if isinstance(label, list) else [label]
    off = -((len(lines) - 1) * 13) / 2
    for i, l in enumerate(lines):
        s.text(cx, cy + off + i * 13 + 4, l, size=10.5, anchor="middle")
    return cy + h / 2

def flow(x1, y1, x2, y2, label=None, lx=None, ly=None, anchor="start"):
    if x1 == x2:
        s.line(x1, y1, x2, y2, sw=1.5, marker="arrow")
    else:
        s.path(f"M {x1} {y1} L {x1} {(y1+y2)/2} L {x2} {(y1+y2)/2} L {x2} {y2}",
               stroke=INK, sw=1.5, marker="arrow")
    if label:
        s.text(lx if lx is not None else (x1 + x2) / 2 + 8,
               ly if ly is not None else (y1 + y2) / 2 - 6, label,
               size=10.5, fill=RED_DK, anchor=anchor, weight="700")

def note(x, y, w, rows, tone=RULE, fill=PANEL):
    h = 16 + len(rows) * 14
    s.rect(x, y, w, h, fill=fill, stroke=tone, sw=1.1, rx=3)
    s.lines(x + 10, y + 20, rows, size=10, fill=INK2, lh=14)

# début
s.circle(CL, 96, 13, fill=INK, stroke=INK)
s.text(CL, 76, "panne au bord de la route", size=10.5, anchor="middle", fill=MUTED, italic=True)
flow(CL, 109, CL, 132)

y = act(CL, 156, "Appuyer sur SOS")
flow(CL, y, AP, 208)
y = act(AP, 232, ["Acquérir la position GPS", "filtre EMA, rejet des sauts"], w=290)
y = dec(AP, 316, ["position", "disponible ?"])

flow(AP, 280, AP, 280)
s.parts.pop()
s.line(AP, 256, AP, 280, sw=1.5, marker="arrow")

# branche non
s.path(f"M {AP-90} 316 L {AP-80} 316 L {AP-80} 386", stroke=INK, sw=1.5, marker="arrow")
s.text(AP - 96, 306, "non", size=10.5, fill=RED_DK, anchor="end", weight="700")
act(AP - 80, 410, ["Bandeau « reprise de la localisation »"], w=250, h=44)
s.path(f"M {AP-80} 432 L {AP-80} 470 L {AP} 470", stroke=INK, sw=1.5, marker="arrow")

s.text(AP + 10, 378, "oui", size=10.5, fill=RED_DK, weight="700")
s.line(AP, 352, AP, 470, sw=1.5)
s.line(AP, 470, AP, 494, sw=1.5, marker="arrow")

y = act(AP, 520, ["Choisir le type de véhicule", "voiture · moto · camion · autre"], w=300)
flow(AP, y, AP, 570)
y = act(AP, 596, ["Afficher les pannes du véhicule", "triées, la plus probable en tête"], w=300)
flow(AP, y, AP, 646)
y = dec(AP, 682, ["panne ou véhicule", "« autre » ?"], w=180, h=70)

s.path(f"M {AP+90} 682 L {AP+150} 682 L {AP+150} 742 L {AP} 742", stroke=INK, sw=1.5, marker="arrow")
s.text(AP + 96, 672, "oui", size=10.5, fill=RED_DK, weight="700")
note(AP + 168, 646, 300, [
    "Le libellé libre devient obligatoire : la règle",
    "vit dans le contrat zod partagé, donc le mobile",
    "désactive « Continuer » et le serveur refuse",
    "la demande — une seule règle, écrite une fois.",
])
s.text(AP + 10, 726, "non", size=10.5, fill=RED_DK, weight="700")
s.line(AP, 717, AP, 742, sw=1.5)

y = act(AP, 780, ["Renseigner urgence, description", "et photo (facultative)"], w=300)
flow(AP, y, SR, 838)

y = act(SR, 862, ["POST /requests", "valide, enregistre, journalise"], w=290, fill="#F1F8F3", stroke=GREEN)
flow(SR, y, SR, 912)
y = act(SR, 940, ["Rechercher les garages", "ST_DWithin puis ROW_NUMBER()"], w=290, fill="#F1F8F3", stroke=GREEN)
flow(SR, y, SR, 994)
y = dec(SR, 1030, ["au moins un", "résultat ?"], w=150, h=70)

s.path(f"M {SR-75} 1030 L {SR-150} 1030 L {SR-150} 1090", stroke=INK, sw=1.5, marker="arrow")
s.text(SR - 82, 1020, "non", size=10.5, fill=RED_DK, anchor="end", weight="700")
act(SR - 150, 1114, ["Élargir le rayon", "meta.widened = true"], w=200, h=52, fill=TINT, stroke=RED)
s.path(f"M {SR-150} 1140 L {SR-150} 1176 L {SR} 1176", stroke=INK, sw=1.5, marker="arrow")
s.text(SR + 10, 1078, "oui", size=10.5, fill=RED_DK, weight="700")
s.line(SR, 1065, SR, 1176, sw=1.5)
s.line(SR, 1176, SR, 1198, sw=1.5, marker="arrow")

y = act(SR, 1224, ["Renvoyer les garages classés 1..n", "rang calculé en SQL"], w=290, fill="#F1F8F3", stroke=GREEN)
s.path(f"M {SR-145} 1224 L {AP+152} 1224", stroke=INK, sw=1.5, marker="arrow")

y = act(AP, 1224, ["Afficher la carte", "et la liste numérotées"], w=280)
flow(AP, 1250, CL, 1298)
s.circle(CL, 1322, 13, fill=BG, stroke=INK, sw=1.8)
s.circle(CL, 1322, 8, fill=INK, stroke=INK)
s.text(CL, 1352, "le client choisit son garage", size=10.5, anchor="middle", fill=MUTED, italic=True)
s.text(CL, 1368, "et le suivi commence", size=10.5, anchor="middle", fill=MUTED, italic=True)

note(60, 900, 260, [
    "Le rang des marqueurs vient du serveur",
    "et n'est jamais recalculé sur le mobile :",
    "un classement recalculé localement",
    "diverge dès que le tri change.",
])

s.save("figures/07-activite-sos.svg")
print("ok")

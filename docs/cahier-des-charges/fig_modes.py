# -*- coding: utf-8 -*-
"""Les deux modes de service : un mode est une géométrie."""
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1360, 760)

def scene(x, y, w, h, title, sub, tone):
    s.rect(x, y, w, h, fill=PANEL, stroke=RULE, sw=1.2, rx=4)
    s.rect(x + 20, y + 24, 16, 2.6, fill=tone, stroke="none", sw=0)
    s.text(x + 46, y + 30, title, size=12, fill=INK2, weight="700", ls="1.6")
    s.text(x + 20, y + 58, sub, size=13, fill=INK)

def pin(cx, cy, label, sub, fill=RED, stroke=RED):
    w, h = 66, 84
    s.add(f'<polygon points="{cx-w/2},{cy-h} {cx+w/2},{cy-h} {cx+w/2},{cy-h*0.38} '
          f'{cx},{cy} {cx-w/2},{cy-h*0.38}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    s.text(cx, cy - h + 34, label, size=20, fill=BG if fill != BG else INK,
           anchor="middle", font=MONO, weight="600")
    s.text(cx, cy + 24, sub, size=12.5, fill=INK, anchor="middle", weight="700")

def phone(cx, cy, label):
    s.rect(cx - 26, cy - 44, 52, 88, fill=BG, stroke=INK, sw=2, rx=7)
    s.circle(cx, cy + 30, 4.5, fill=INK, stroke=INK)
    s.rect(cx - 16, cy - 32, 32, 50, fill=PANEL, stroke=RULE, sw=1)
    s.text(cx, cy + 66, label, size=12.5, anchor="middle", weight="700")

def trail(pts, tone):
    d = "M " + " L ".join(f"{x} {y}" for x, y in pts)
    s.path(d, stroke=tone, sw=3.2, dash="1 9")
    s.add(f'<path d="{d}" fill="none" stroke="{tone}" stroke-width="1.4" opacity="0.35"/>')
    for x, y in pts:
        s.circle(x, y, 4.2, fill=tone, stroke=tone)
    lx, ly = pts[-2]; ex, ey = pts[-1]
    s.line(lx, ly, ex, ey, stroke=tone, sw=2.6, marker="arrow" if tone == INK else "arrowred")

# ---------------------------------------------------------------- on_site
scene(30, 30, 640, 480, "MODE 1", "on_site — le garagiste vient", RED)
s.text(50, 124, "Le véhicule ne roule plus. Le garagiste sort son", size=12.5, fill=INK2)
s.text(50, 146, "véhicule et se rend sur le lieu de la panne.", size=12.5, fill=INK2)

phone(140, 300, "GARAGE")
pin(560, 340, "!", "lieu de la panne", fill=BG, stroke=INK)
trail([(180, 300), (250, 268), (330, 300), (410, 274), (490, 306), (540, 300)], RED)
s.text(350, 246, "trace lue : role = 'garage'", size=12, fill=RED_DK, anchor="middle", weight="700")
s.text(350, 392, "destination : origin de la demande", size=12, fill=MUTED, anchor="middle", italic=True)
s.text(50, 452, "« Je pars » appartient au GARAGISTE.", size=12.5, fill=INK, weight="700")
s.text(50, 474, "C'est lui qui ouvre la fenêtre de lecture de sa trace.", size=12, fill=INK2)

# -------------------------------------------------------------- at_garage
scene(690, 30, 640, 480, "MODE 2", "at_garage — je vais au garage", BLUE)
s.text(710, 124, "Le véhicule roule encore. Le client conduit", size=12.5, fill=INK2)
s.text(710, 146, "jusqu'à l'atelier.", size=12.5, fill=INK2)

phone(800, 300, "CLIENT")
s.chamfer(1180, 292, 96, 96, cut=20, fill=RED, stroke=RED, sw=2)
s.text(1228, 348, "⌂", size=44, fill=BG, anchor="middle")
s.text(1228, 424, "atelier du garage", size=12.5, anchor="middle", weight="700")
trail([(840, 300), (910, 272), (990, 302), (1070, 276), (1150, 308), (1174, 320)], BLUE)
s.text(1010, 246, "trace lue : role = 'client'", size=12, fill=BLUE, anchor="middle", weight="700")
s.text(1010, 392, "destination : location du garage", size=12, fill=MUTED, anchor="middle", italic=True)
s.text(710, 452, "« Je pars » appartient au CLIENT.", size=12.5, fill=INK, weight="700")
s.text(710, 474, "Le serveur refuse ce départ au garagiste.", size=12, fill=INK2)

# ------------------------------------------------------------ la fonction
s.rect(30, 542, 1300, 190, fill=BG, stroke=INK, sw=1.7)
s.rect(46, 566, 16, 2.6, fill=RED, stroke="none", sw=0)
s.text(72, 572, "LE SEUL ENDROIT OÙ LE MODE DEVIENT DE LA GÉOMÉTRIE", size=11.5,
       fill=INK2, weight="700", ls="1.6")
s.lines(46, 606, [
    "serviceGeometry(mode, { origin, garageLocation })",
    "  → { traveller: 'garage' | 'client',  destination: LatLng }",
], size=13, fill=INK, lh=20, font=MONO)

s.lines(46, 668, [
    "Tout ce qui a besoin de savoir quelle trace lire ou vers quoi mesurer passe par cette fonction : la preuve",
    "d'arrivée, le registre des commissions, l'itinéraire affiché. Un test de mode recopié dans trois modules finit",
    "toujours par en avoir un de retard.",
], size=12.5, fill=INK2, lh=22)
s.text(392, 712, "Et une preuve mesurée vers le mauvais point ne plante pas : elle rend « aucune preuve ».",
       size=12.5, fill=RED_DK, weight="700")

s.save("figures/09-modes-service.svg")
print("ok")

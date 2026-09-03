# -*- coding: utf-8 -*-
"""Page de garde, à fond perdu, dans la charte GeoCras.

Reprend les quatre partis pris de l'identité : l'angle coupé, le chiffre en
mono, le blanc chaud, le filet rouge. Le champ rouge et sa trame reprennent
l'écran de lancement de l'application.
"""
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

# A4 à 200 ppi
W, H = 1654, 2339
BEBAS = "'Bebas Neue', 'Oswald', sans-serif"
PLEX = "'IBM Plex Sans', sans-serif"
PLEXM = "'IBM Plex Mono', monospace"
CREAM = "#F6F4EF"
RED_F = "#E53935"

s = Svg(W, H, bg=CREAM)

# ---------------------------------------------------------------- champ rouge
FIELD_H = 1010
s.add(f'<rect x="0" y="0" width="{W}" height="{FIELD_H}" fill="{RED_F}"/>')

# Trame : la carte suggérée, comme sur l'écran de lancement.
for x in range(0, W, 118):
    s.add(f'<line x1="{x}" y1="0" x2="{x}" y2="{FIELD_H}" stroke="#FFFFFF" '
          f'stroke-width="1.2" opacity="0.10"/>')
for y in range(0, FIELD_H, 118):
    s.add(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="#FFFFFF" '
          f'stroke-width="1.2" opacity="0.10"/>')
# Deux axes plus marqués, comme deux voies.
s.add(f'<line x1="0" y1="472" x2="{W}" y2="472" stroke="#FFFFFF" stroke-width="9" opacity="0.13"/>')
s.add(f'<line x1="1062" y1="0" x2="1062" y2="{FIELD_H}" stroke="#FFFFFF" stroke-width="9" opacity="0.13"/>')

# Halo de position, repris de la carte.
s.add(f'<circle cx="1062" cy="472" r="150" fill="#FFFFFF" opacity="0.10"/>')
s.add(f'<circle cx="1062" cy="472" r="150" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.30"/>')

# ------------------------------------------------- tuile chamfrée du logo
TX, TY, TS, CUT = 190, 330, 268, 62
s.add(f'<polygon points="{TX},{TY} {TX+TS},{TY} {TX+TS},{TY+TS-CUT} {TX+TS-CUT},{TY+TS} {TX},{TY+TS}" '
      f'fill="#FFFFFF"/>')
cx, cy = TX + TS / 2 - 8, TY + TS / 2 - 8
s.add(f'<circle cx="{cx}" cy="{cy}" r="62" fill="none" stroke="{RED_F}" stroke-width="15"/>')
s.add(f'<circle cx="{cx}" cy="{cy}" r="20" fill="{RED_F}"/>')

# Marqueur en écusson, la forme des garages sur la carte.
mx, my, mw, mh = 1290, 300, 96, 124
s.add(f'<polygon points="{mx},{my} {mx+mw},{my} {mx+mw},{my+mh*0.62} {mx+mw/2},{my+mh} {mx},{my+mh*0.62}" '
      f'fill="#FFFFFF" opacity="0.92"/>')
s.text(mx + mw / 2, my + 68, "1", size=54, fill=RED_F, anchor="middle", font=PLEXM, weight="600")

# ------------------------------------------------------------ bas du champ
s.text(190, 700, "PROJET DE FIN D'ÉTUDES", size=30, fill="#FFFFFF",
       font=BEBAS, ls="6.5", weight="400")
s.add(f'<rect x="190" y="742" width="86" height="5" fill="#FFFFFF"/>')
s.text(190, 826, "Cahier des charges", size=52, fill="#FFFFFF", font=BEBAS, ls="2.4")
s.text(190, 890, "et dossier de conception", size=52, fill="#FFFFFF", font=BEBAS, ls="2.4")

# ---------------------------------------------------------------- wordmark
# `GEO` en 500, `CRAS` en 800 : la règle de la charte, pas Bebas ici.
WY = 1310
s.add(f'<text x="190" y="{WY}" font-family="{PLEX}" font-size="196" letter-spacing="21">'
      f'<tspan font-weight="500" fill="#1C1A17">GEO</tspan>'
      f'<tspan font-weight="800" fill="#1C1A17">CRAS</tspan></text>')
s.text(196, WY + 74, "Géolocalisation de garages et assistance à la conduite",
       size=40, fill="#6E6A62", font=PLEX, weight="400")

# filet rouge de séparation
s.add(f'<rect x="190" y="{WY + 152}" width="1274" height="5" fill="{RED_F}"/>')

# ------------------------------------------------------------ bloc métadonnées
MY = WY + 342
COLS = [
    ("DOCUMENT", ["Cahier des charges", "et dossier de conception"]),
    ("PÉRIMÈTRE", ["Application mobile", "Yaoundé, Cameroun"]),
]
for i, (label, rows) in enumerate(COLS):
    x = 190 + i * 640
    s.add(f'<rect x="{x}" y="{MY - 26}" width="26" height="4" fill="{RED_F}"/>')
    s.text(x + 42, MY - 20, label, size=23, fill="#8A8578", font=BEBAS, ls="3.4")
    for j, r in enumerate(rows):
        s.text(x, MY + 32 + j * 40, r, size=30, fill="#1C1A17", font=PLEX)

# ---- chiffres, en mono comme le veut la charte
NY = MY + 262
NUMS = [("77", "PAGES"), ("15", "FIGURES"), ("13", "CAS D'USAGE"), ("1.1", "VERSION")]
for i, (v, k) in enumerate(NUMS):
    x = 190 + i * 320
    s.text(x, NY, v, size=64, fill="#1C1A17", font=PLEXM, weight="600")
    s.text(x, NY + 40, k, size=22, fill="#8A8578", font=BEBAS, ls="3.2")

# ------------------------------------------------------------- pied de page
s.add(f'<rect x="190" y="{H - 250}" width="1274" height="2" fill="#E8E4DB"/>')
s.text(190, H - 190, "Septembre 2026", size=30, fill="#6E6A62", font=PLEX)
s.text(1464, H - 190, "Version 1.1", size=28, fill="#8A8578", font=PLEXM, anchor="end")

# L'angle coupé, en grand, au coin inférieur droit de la page.
s.add(f'<polygon points="{W},{H-150} {W},{H} {W-150},{H}" fill="{RED_F}"/>')

s.save("figures/00-couverture.svg")
print("ok")

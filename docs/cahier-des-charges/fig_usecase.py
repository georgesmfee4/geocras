# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1420, 1000)

def actor(x, y, label, sub=None):
    s.circle(x, y, 13, fill=BG, stroke=INK, sw=1.8)
    s.line(x, y + 13, x, y + 45, sw=1.8)
    s.line(x - 17, y + 24, x + 17, y + 24, sw=1.8)
    s.line(x, y + 45, x - 15, y + 70, sw=1.8)
    s.line(x, y + 45, x + 15, y + 70, sw=1.8)
    s.text(x, y + 90, label, size=13.5, anchor="middle", weight="700")
    if sub:
        s.text(x, y + 106, sub, size=10.5, fill=MUTED, anchor="middle")

def uc(cx, cy, label, rx=104, ry=25, stroke=INK):
    s.ellipse(cx, cy, rx, ry, fill=BG, stroke=stroke, sw=1.5)
    if isinstance(label, str):
        label = [label]
    off = -((len(label) - 1) * 13) / 2
    for i, l in enumerate(label):
        s.text(cx, cy + off + i * 13 + 4.5, l, size=12, anchor="middle")

def pack(x, y, w, h, title):
    s.rect(x, y, w, h, fill=PANEL, stroke=RULE, sw=1.1, rx=3)
    s.rect(x + 14, y + 16, 14, 2.2, fill=RED, stroke="none", sw=0)
    s.text(x + 36, y + 21, title, size=10.5, fill=INK2, weight="700", ls="1.4")

def link(x1, y1, x2, y2, dash=None, marker=None, stroke=INK2, sw=1.15):
    s.line(x1, y1, x2, y2, stroke=stroke, sw=sw, dash=dash, marker=marker)

L, C, R = 500, 710, 950          # colonnes : client · partagé · garagiste
CLIENT = (170, 440)              # ancre de l'acteur client
GARAGE = (1250, 380)
ADMIN  = (1250, 790)

# ---------- frontière ----------
s.rect(310, 24, 800, 952, fill=BG, stroke=INK, sw=2, rx=4)
s.text(710, 52, "GeoCras", size=17, anchor="middle", weight="700", ls="1")
s.line(310, 66, 1110, 66, stroke=RULE, sw=1.2)

# ---------- compte ----------
pack(334, 82, 752, 92, "COMPTE")
uc(L - 40, 134, ["Gérer ses véhicules"], rx=98, ry=22)
uc(C + 40, 134, ["S'inscrire, se connecter"], rx=112, ry=22)
uc(R + 20, 134, ["Inscrire son garage"], rx=96, ry=22)

# ---------- recherche ----------
pack(334, 190, 752, 172, "RECHERCHE DE GARAGES")
uc(L - 30, 248, ["Se localiser", "automatiquement"], rx=104)
uc(C + 90, 248, ["Rechercher les garages", "à proximité"], rx=112, stroke=RED)
uc(L - 30, 324, ["Trier et filtrer"], rx=94, ry=21)
uc(C + 90, 324, ["Consulter une fiche", "et ses avis"], rx=112, ry=21)

# ---------- assistance ----------
pack(334, 378, 752, 274, "DEMANDE D'ASSISTANCE")
uc(L - 40, 438, ["Déclarer une", "panne (SOS)"], rx=98, stroke=RED)
uc(R + 10, 438, ["Accepter ou refuser", "une demande"], rx=104)
uc(L - 40, 516, ["Choisir un garage"], rx=98, ry=21)
uc(R + 10, 516, ["Se déclarer en route"], rx=104, ry=21)
uc(C, 594, ["Suivre l'intervention en temps réel"], rx=150, ry=22, stroke=RED)

# ---------- clôture ----------
pack(334, 668, 752, 186, "CLÔTURE ET SUITES")
uc(C + 60, 730, ["Confirmer son arrivée"], rx=110, ry=22, stroke=RED)
uc(L - 40, 730, ["Publier un avis"], rx=94, ry=21)
uc(L - 40, 810, ["Consulter points, grade", "et historique"], rx=112, ry=21)

# ---------- conduite ----------
pack(334, 870, 470, 90, "MODE CONDUITE")
uc(L - 60, 918, ["Démarrer une session"], rx=100, ry=20)
uc(L + 160, 918, ["Consulter ses statistiques"], rx=112, ry=20)

pack(820, 870, 266, 90, "ADMINISTRATION")
uc(953, 918, ["Vérifier et certifier un garage"], rx=124, ry=20)

# ---------- acteurs ----------
actor(*CLIENT, "Client", "automobiliste")
actor(*GARAGE, "Garagiste", "propriétaire de garage")
actor(*ADMIN, "Administrateur", "vérification")

cx, cy = CLIENT[0] + 38, CLIENT[1] + 45
for tx, ty in [(368, 134), (386, 248), (376, 324), (368, 438), (368, 516),
               (560, 594), (366, 730), (366, 810), (360, 918)]:
    link(cx, cy, tx, ty)
link(cx, cy, 658, 148)
link(cx, cy, 660, 741)
link(cx, cy, 548, 918)

gx, gy = GARAGE[0] - 38, GARAGE[1] + 45
for tx, ty in [(1076, 134), (1074, 438), (1074, 516), (860, 594), (880, 730)]:
    link(gx, gy, tx, ty)
link(gx, gy, 862, 134)

ax, ay = ADMIN[0] - 38, ADMIN[1] + 45
link(ax, ay, 1077, 918)
link(ax, ay, 1078, 145)

# ---------- «include» / «extend» ----------
link(L - 30, 273, L - 30, 303, dash="5 4", marker="open", stroke=INK)
link(C + 90, 273, C + 90, 303, dash="5 4", marker="open", stroke=INK)

link(L - 40, 463, L - 40, 495, dash="5 4", marker="open", stroke=INK)
s.text(L - 30, 484, "«include»", size=10.5, fill=INK, italic=True)

link(L + 20, 537, C - 110, 578, dash="5 4", marker="open", stroke=INK)
s.text(L + 70, 566, "«include»", size=10.5, fill=INK, italic=True)

link(C + 60, 708, C + 30, 620, dash="5 4", marker="openred", stroke=RED, sw=1.3)
s.text(C + 76, 672, "«extend»  double confirmation", size=10.5, fill=RED_DK, italic=True)

link(L + 56, 730, C - 52, 730, dash="5 4", marker="openred", stroke=RED, sw=1.3)
s.text(L + 62, 722, "«extend»", size=10.5, fill=RED_DK, italic=True)

link(L + 74, 800, C - 40, 748, dash="5 4", marker="openred", stroke=RED, sw=1.3)
s.text(L + 82, 792, "«extend»  crédit de points", size=10.5, fill=RED_DK, italic=True)

s.save("figures/02-cas-utilisation.svg")
print("ok")

# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1440, 1200)

LANES = [
    ("Client",        110, "automobiliste"),
    ("App mobile",    330, "React Native"),
    ("API GeoCras",   580, "Express"),
    ("PostGIS",       800, "PostgreSQL"),
    ("Socket.io",     1000, "temps réel"),
    ("App garagiste", 1240, "React Native"),
]
TOP, BOT = 40, 1150

for name, x, sub in LANES:
    s.chamfer(x - 88, TOP, 176, 52, cut=10, fill=PANEL, stroke=INK, sw=1.7)
    s.text(x, TOP + 24, name, size=13, anchor="middle", weight="700")
    s.text(x, TOP + 40, sub, size=10, fill=MUTED, anchor="middle")
    s.line(x, TOP + 52, x, BOT, stroke=MUTED, sw=1.1, dash="6 5")

def act(x, y, h, w=11):
    s.rect(x - w / 2, y, w, h, fill=BG, stroke=INK, sw=1.4)

def msg(x1, x2, y, label, note=None, dash=None, back=False):
    s.line(x1, y, x2, y, stroke=INK, sw=1.5, dash=dash, marker="arrow")
    mid = (x1 + x2) / 2
    s.text(mid, y - 8, label, size=11.5, anchor="middle", font=MONO if label.startswith(("POST","GET","emit","on ")) else FONT)
    if note:
        s.text(mid, y + 14, note, size=10, fill=MUTED, anchor="middle", italic=True)

def selfmsg(x, y, label, note=None):
    s.path(f"M {x+6} {y} L {x+64} {y} L {x+64} {y+26} L {x+10} {y+26}",
           stroke=INK, sw=1.4, marker="arrow")
    s.text(x + 72, y + 6, label, size=11.5)
    if note:
        s.text(x + 72, y + 22, note, size=10, fill=MUTED, italic=True)

def frame(x, y, w, h, kind, cond):
    s.rect(x, y, w, h, fill="none", stroke=INK2, sw=1.2, dash="5 4")
    s.rect(x, y, 52, 19, fill=PANEL, stroke=INK2, sw=1.2)
    s.text(x + 26, y + 13.5, kind, size=10.5, anchor="middle", weight="700")
    s.text(x + 60, y + 13.5, cond, size=10.5, fill=INK2)

def phase(y, label):
    s.line(40, y, 1400, y, stroke=RULE, sw=1)
    s.rect(40, y - 9, 14, 2.2, fill=RED, stroke="none", sw=0)
    s.text(62, y - 4, label, size=10.5, fill=INK2, weight="700", ls="1.3")

C, M, A, P, S_, G = 110, 330, 580, 800, 1000, 1240

phase(112, "DÉCLARATION DE LA PANNE")
act(M, 126, 250); act(A, 168, 190); act(P, 196, 60)
msg(C, M, 140, "appuie sur SOS")
msg(M, M, 158, "")
s.parts.pop()
selfmsg(M, 158, "acquisition GPS", "filtre EMA, rejet des sauts")
msg(M, A, 210, "POST /requests", "véhicule, panne, urgence, position")
msg(A, P, 240, "ST_DWithin + ROW_NUMBER()", "rayon 10 km, tri demandé")
msg(P, A, 268, "garages classés 1..n", back=True, dash="6 4")
msg(A, M, 296, "201 · demande + candidats", "un seul aller-retour")

phase(340, "CHOIX DU GARAGE")
act(M, 350, 150); act(A, 384, 116); act(S_, 412, 70); act(G, 424, 44)
msg(M, C, 362, "liste et carte numérotées")
msg(C, M, 386, "choisit le garage n° 2")
msg(M, A, 412, "POST /requests/:id/select")
msg(A, S_, 438, "emit garage:jobs", "room du propriétaire")
msg(S_, G, 462, "nouvelle demande", dash="6 4")

phase(500, "ACCEPTATION ET MISE EN ROUTE")
act(G, 512, 152); act(A, 536, 148); act(S_, 646, 40); act(M, 660, 30)
msg(G, A, 526, "POST /requests/:id/accept")
frame(500, 548, 800, 62, "alt", "[le garage ne peut pas intervenir]")
msg(G, A, 588, "POST /requests/:id/decline")
s.text(900, 604, "la demande retourne en pending, sans perdre son journal",
       size=10, fill=MUTED, anchor="middle", italic=True)
msg(G, A, 634, "POST /requests/:id/en-route")
msg(A, S_, 656, "emit request:event")
msg(S_, M, 678, "garagiste en route", dash="6 4")

phase(714, "SUIVI EN TEMPS RÉEL")
act(G, 726, 180); act(S_, 726, 180); act(A, 726, 180); act(M, 726, 180)
frame(180, 736, 1120, 128, "loop", "[toutes les 4 s et au-delà de 15 m parcourus]")
msg(G, S_, 770, "emit request:position")
msg(S_, A, 794, "enregistre position_pings")
msg(A, S_, 818, "calcule les deux ETA", "le serveur, jamais le client")
msg(S_, M, 842, "emit request:tracking", "toClient · toGarage · emittedAt")

phase(896, "RECONNAISSANCE ET CLÔTURE")
act(M, 908, 206); act(A, 932, 182); act(P, 1030, 82); act(G, 908, 206)
s.text(60, 912, "distance entre les deux parties < 120 m", size=11, anchor="start", italic=True, fill=RED_DK)
msg(M, C, 940, "« vous le voyez ? »")
msg(C, M, 964, "confirme son arrivée")
msg(M, A, 988, "POST /requests/:id/arrive")
s.text(455, 1002, "awaiting_confirmation", size=10, fill=MUTED, anchor="middle", italic=True)
msg(G, A, 1026, "POST /requests/:id/arrive", "seconde confirmation")
msg(A, P, 1056, "UPDATE status = 'closed'")
s.text(560, 1074, "la contrainte closed_requires_both_arrivals valide la transition",
       size=10, fill=RED_DK, anchor="middle", italic=True)
msg(A, P, 1098, "INSERT loyalty_ledger (state = 'pending')")
s.text(560, 1116, "clé d'idempotence · 50 points · confirmés après 24 h",
       size=10, fill=MUTED, anchor="middle", italic=True)

s.save("figures/05-sequence-sos.svg")
print("ok")

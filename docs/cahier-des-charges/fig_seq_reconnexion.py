# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1240, 900)
LANES = [("App mobile", 180, "client"), ("Socket.io", 500, "serveur"),
         ("API GeoCras", 800, "Express"), ("PostgreSQL", 1080, "request_events")]
TOP, BOT = 36, 860

for name, x, sub in LANES:
    s.chamfer(x - 92, TOP, 184, 50, cut=10, fill=PANEL, stroke=INK, sw=1.7)
    s.text(x, TOP + 22, name, size=13, anchor="middle", weight="700")
    s.text(x, TOP + 38, sub, size=10, fill=MUTED, anchor="middle")
    s.line(x, TOP + 50, x, BOT, stroke=MUTED, sw=1.1, dash="6 5")

def act(x, y, h, w=11, fill=BG):
    s.rect(x - w / 2, y, w, h, fill=fill, stroke=INK, sw=1.4)

def msg(x1, x2, y, label, note=None, dash=None, stroke=INK):
    s.line(x1, y, x2, y, stroke=stroke, sw=1.5, dash=dash,
           marker="arrow" if stroke == INK else "arrowred")
    mid = (x1 + x2) / 2
    s.text(mid, y - 8, label, size=11.5, anchor="middle",
           font=MONO if label.split(" ")[0] in ("emit", "on", "GET", "POST") else FONT, fill=stroke)
    if note:
        s.text(mid, y + 14, note, size=10, fill=MUTED, anchor="middle", italic=True)

def frame(x, y, w, h, kind, cond, tone=INK2):
    s.rect(x, y, w, h, fill="none", stroke=tone, sw=1.2, dash="5 4")
    s.rect(x, y, 52, 19, fill=PANEL, stroke=tone, sw=1.2)
    s.text(x + 26, y + 13.5, kind, size=10.5, anchor="middle", weight="700")
    s.text(x + 60, y + 13.5, cond, size=10.5, fill=INK2)

M, S_, A, P = 180, 500, 800, 1080

act(M, 100, 720); act(S_, 100, 720); act(A, 100, 200)

msg(M, S_, 118, "emit request:join", "{ requestId, lastSeq: 0 }")
msg(S_, A, 148, "vérifie le JWT et l'appartenance")
msg(A, S_, 176, "autorisé", dash="6 4")
msg(S_, M, 204, "emit request:state", "status, lastSeq = 12")

s.line(60, 236, 1200, 236, stroke=RULE, sw=1)
s.rect(60, 227, 14, 2.2, fill=RED, stroke="none", sw=0)
s.text(82, 232, "LA CONNEXION TOMBE", size=10.5, fill=RED_DK, weight="700", ls="1.3")

# --- coupure
s.rect(60, 250, 1120, 66, fill="#FBF3F2", stroke=RED, sw=1.5, rx=4, dash="5 4")
s.text(80, 272, "réseau 2G, passage sous un pont : le socket est déclaré mort après le délai de garde.",
       size=11.5, fill=RED_DK, weight="700")
s.text(80, 296, "Le mobile bascule sur la route HTTP de repli toutes les 15 s et affiche le bandeau « connexion dégradée ».",
       size=10.5, fill=INK2)

frame(60, 332, 1120, 88, "loop", "[mode dégradé, toutes les 15 s]", tone=RED)
msg(M, A, 374, "GET /requests/:id", "état complet + lastSeq", stroke=RED)
s.text(620, 406, "la donnée reste juste, seulement moins fraîche",
       size=10, fill=MUTED, anchor="middle", italic=True)

s.line(60, 446, 1200, 446, stroke=RULE, sw=1)
s.rect(60, 437, 14, 2.2, fill=GREEN, stroke="none", sw=0)
s.text(82, 442, "LE RÉSEAU REVIENT", size=10.5, fill=GREEN, weight="700", ls="1.3")

# --- rattrapage
msg(M, S_, 476, "emit request:join", "{ requestId, lastSeq: 12 }")
msg(S_, A, 506, "rejoue ce qui manque")
msg(A, P, 534, "SELECT * FROM request_events")
s.text(940, 548, "WHERE request_id = $1 AND seq > 12", size=10, fill=MUTED, anchor="middle", italic=True, font=MONO)
act(P, 524, 52)
msg(P, A, 572, "événements 13 → 19", dash="6 4")
msg(A, S_, 600, "missedEvents[]")
msg(S_, M, 628, "emit request:state", "les 7 événements manqués, dans l'ordre des seq")

s.rect(60, 660, 820, 78, fill="#F1F8F3", stroke=GREEN, sw=1.5, rx=4)
s.text(78, 684, "L'écran se remet à jour sans que l'utilisateur ait rien à faire.",
       size=12, fill=INK, weight="700")
s.lines(78, 704, [
    "Aucun état n'est perdu : le journal des événements est en ajout seul, et le numéro de séquence",
    "porté par le client suffit à déterminer ce qu'il n'a pas vu. C'est la même route que celle du mode dégradé.",
], size=10.5, fill=INK2, lh=14)

# --- reprise du temps réel
frame(60, 762, 1120, 78, "loop", "[reprise nominale : 4 s et 15 m]")
msg(S_, M, 802, "emit request:tracking")
s.text(340, 826, "le compteur « MAJ 3s » repart de Date.now() − emittedAt",
       size=10, fill=MUTED, anchor="middle", italic=True)

s.save("figures/06-sequence-reconnexion.svg")
print("ok")

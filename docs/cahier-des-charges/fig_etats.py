# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1240, 900)

def state(x, y, w, h, name, note=None, stroke=INK, fill=BG):
    s.rect(x, y, w, h, fill=fill, stroke=stroke, sw=1.8, rx=9)
    if note:
        s.text(x + w / 2, y + 25, name, size=14, anchor="middle", weight="700")
        s.line(x + 10, y + 34, x + w - 10, y + 34, stroke=RULE, sw=1)
        for i, n in enumerate(note):
            s.text(x + w / 2, y + 50 + i * 14, n, size=10.5, fill=INK2, anchor="middle", font=MONO)
    else:
        s.text(x + w / 2, y + h / 2 + 5, name, size=14, anchor="middle", weight="700")

def trans(x1, y1, x2, y2, label=None, lx=None, ly=None, stroke=INK, dash=None, anchor="start"):
    s.line(x1, y1, x2, y2, stroke=stroke, sw=1.6, dash=dash, marker="arrow" if stroke == INK else "arrowred")
    if label:
        s.text(lx if lx is not None else (x1 + x2) / 2 + 8,
               ly if ly is not None else (y1 + y2) / 2 - 6,
               label, size=11.5, fill=stroke, anchor=anchor)

W, H = 214, 76
CX = 512

# état initial
s.circle(CX + 107, 44, 11, fill=INK, stroke=INK)
s.line(CX + 107, 55, CX + 107, 84, sw=1.6, marker="arrow")
s.text(CX + 118, 74, "POST /requests", size=11.5, font=MONO)

state(CX, 90, W, H, "pending", ["garage_id IS NULL"])
trans(CX + 107, 166, CX + 107, 208, "POST /requests/:id/select", CX + 118, 192)

state(CX, 214, W, H, "selected", ["selected_at"])
trans(CX + 107, 290, CX + 107, 332, "POST /requests/:id/accept", CX + 118, 316)

state(CX, 338, W, H, "accepted", ["accepted_at"])
trans(CX + 107, 414, CX + 107, 456, "POST /requests/:id/en-route", CX + 118, 440)

state(CX, 462, W, H, "en_route", ["en_route_at"])
trans(CX + 107, 538, CX + 107, 580, "une seule confirmation", CX + 118, 564, stroke=RED)

state(CX, 586, W, H, "awaiting_confirmation",
      ["garage_arrived_at", "OU client_arrived_at"], stroke=RED)
trans(CX + 107, 662, CX + 107, 712, "seconde confirmation", CX + 118, 692, stroke=RED)

state(CX, 718, W, H, "closed", ["closed_at · crédit"], stroke=GREEN, fill="#F1F8F3")

# état final
s.circle(CX + 107, 838, 13, fill=BG, stroke=INK, sw=1.8)
s.circle(CX + 107, 838, 8, fill=INK, stroke=INK)
s.line(CX + 107, 794, CX + 107, 823, sw=1.6, marker="arrow")

# ---- retour arrière : refus du garage
s.path(f"M {CX} 252 C {CX-120} 252 {CX-120} 128 {CX-2} 128", stroke=AMBER, sw=1.7, marker="arrow")
s.text(CX - 128, 186, "POST /requests/:id/decline", size=11.5, fill="#8A6410", anchor="end")
s.text(CX - 128, 202, "le garage refuse, la demande", size=10.5, fill=MUTED, anchor="end")
s.text(CX - 128, 216, "repart en recherche", size=10.5, fill=MUTED, anchor="end")

# ---- annulation depuis tout état non terminal
s.rect(60, 470, 196, 68, fill="#FBF3F2", stroke=RED, sw=1.8, rx=9)
s.text(158, 500, "cancelled", size=14, anchor="middle", weight="700", fill=RED_DK)
s.text(158, 520, "cancelled_at", size=10.5, fill=INK2, anchor="middle", font=MONO)

for y in (128, 252, 376, 500):
    s.path(f"M {CX-2} {y} C {CX-140} {y} 300 504 258 504", stroke=RED, sw=1.3,
           dash="6 4", marker="arrowred")
s.text(158, 556, "POST /requests/:id/cancel", size=11, fill=RED_DK, anchor="middle", font=MONO)
s.text(158, 574, "depuis tout état non terminal", size=10.5, fill=MUTED, anchor="middle")
s.circle(158, 620, 13, fill=BG, stroke=INK, sw=1.8)
s.circle(158, 620, 8, fill=INK, stroke=INK)
s.line(158, 582, 158, 605, sw=1.6, marker="arrow")

# ---- garde SQL
s.rect(800, 690, 400, 132, fill=PANEL, stroke=RULE, sw=1.2, rx=3)
s.rect(816, 708, 14, 2.2, fill=RED, stroke="none", sw=0)
s.text(838, 713, "GARDE EN BASE", size=10.5, fill=INK2, weight="700", ls="1.4")
s.lines(816, 738, [
    "CONSTRAINT closed_requires_both_arrivals",
    "CHECK (",
    "  status <> 'closed'",
    "  OR (garage_arrived_at IS NOT NULL",
    "      AND client_arrived_at IS NOT NULL))",
], size=10.5, fill=INK, lh=14, font=MONO)
s.line(800, 760, 738, 760, stroke=RED, sw=1.2, dash="4 3")

# ---- légende de l'unicité
s.rect(800, 90, 400, 92, fill=PANEL, stroke=RULE, sw=1.2, rx=3)
s.rect(816, 108, 14, 2.2, fill=RED, stroke="none", sw=0)
s.text(838, 113, "UNICITÉ", size=10.5, fill=INK2, weight="700", ls="1.4")
s.lines(816, 138, [
    "requests_one_active_per_client_idx :",
    "un client n'a qu'une demande vivante,",
    "c'est-à-dire hors closed et cancelled.",
], size=11, fill=INK2, lh=15)

s.save("figures/03-etats-transitions.svg")
print("ok")

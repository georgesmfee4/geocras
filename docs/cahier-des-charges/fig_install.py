# -*- coding: utf-8 -*-
"""Chaîne de dépendances et ordre d'installation obligatoire."""
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1320, 900)

def step(n, x, y, w, h, title, rows, accent=INK, fill=BG):
    s.chamfer(x, y, w, h, cut=13, fill=fill, stroke=accent, sw=1.8)
    s.circle(x + 30, y + 30, 19, fill=accent, stroke=accent)
    s.text(x + 30, y + 36, str(n), size=17, fill=BG, anchor="middle", font=MONO, weight="600")
    s.text(x + 62, y + 36, title, size=14.5, weight="700")
    s.lines(x + 20, y + 68, rows, size=11.5, fill=INK2, lh=16, font=MONO)

def arrow(x1, y1, x2, y2, label=None, tone=INK):
    s.line(x1, y1, x2, y2, stroke=tone, sw=1.8, marker="arrow" if tone == INK else "arrowred")
    if label:
        s.text((x1 + x2) / 2 + 10, (y1 + y2) / 2 + 4, label, size=11, fill=RED_DK, weight="700")

# ---------------------------------------------------------------- prérequis
s.rect(30, 30, 1260, 92, fill=PANEL, stroke=RULE, sw=1.2, rx=4)
s.rect(50, 54, 16, 2.6, fill=RED, stroke="none", sw=0)
s.text(76, 60, "PRÉREQUIS DU POSTE", size=11.5, fill=INK2, weight="700", ls="1.6")
s.lines(50, 88, [
    "Node.js 22 ou plus  ·  npm 10  ·  git  ·  un compte Neon (PostgreSQL)  ·  un compte MapTiler  ·  un compte Expo pour les builds",
], size=12, fill=INK, lh=16)

step(1, 30, 150, 400, 168, "npm install", [
    "à la racine, une seule fois",
    "",
    "npm workspaces relie les trois",
    "paquets entre eux par lien",
    "symbolique : @geocras/shared",
    "n'est pas téléchargé, il est lié.",
])

arrow(430, 234, 476, 234)

step(2, 476, 150, 400, 168, "Compiler shared", [
    "npm run build --workspace",
    "  @geocras/shared",
    "",
    "OBLIGATOIRE avant tout.",
    "api et mobile importent son",
    "dist/, pas ses sources.",
], accent=RED, fill=TINT)

arrow(876, 234, 922, 234)

step(3, 922, 150, 368, 168, "Base de données", [
    "CREATE EXTENSION postgis;",
    "cp .env.example .env",
    "npm run db:migrate",
    "npm run db:seed",
    "",
    "sur une branche dev, pas main.",
], accent=GREEN)

# ------------------------------------------------------------- second rang
step(4, 30, 356, 400, 172, "Secrets", [
    "node -e \"console.log(require",
    "  ('crypto').randomBytes(48)",
    "  .toString('base64url'))\"",
    "",
    "deux fois : ACCESS et REFRESH",
    "doivent DIFFÉRER.",
])

arrow(430, 442, 476, 442)

step(5, 476, 356, 400, 172, "Lancer le serveur", [
    "npm run api",
    "",
    "tsx watch : rechargement à",
    "chaud, pas de compilation",
    "préalable. Le port 3000 par",
    "défaut.",
])

arrow(876, 442, 922, 442)

step(6, 922, 356, 368, 172, "Lancer le mobile", [
    "cp .env.example .env",
    "  → clé MapTiler",
    "npm run mobile",
    "",
    "Metro sert le bundle ;",
    "l'IP est déduite de lui.",
])

# -------------------------------------------------------- build appareil
s.rect(30, 566, 1260, 190, fill=BG, stroke=RED, sw=1.8, rx=4)
s.rect(50, 592, 16, 2.6, fill=RED, stroke="none", sw=0)
s.text(76, 598, "L'ÉTAPE QU'ON NE PEUT PAS SAUTER", size=11.5, fill=RED_DK, weight="700", ls="1.6")
s.text(50, 630, "MapLibre est du code natif : il ne tourne pas dans Expo Go. Sans build de développement, l'onglet Carte reste vide.",
       size=12.5, fill=INK)
s.lines(50, 664, [
    "npm install -g eas-cli",
    "cd apps/mobile && eas login",
    "eas build --profile development --platform android",
], size=12.5, fill=INK, lh=20, font=MONO)
s.text(50, 736, "EAS compile chez Expo : aucune chaîne Android locale, aucun Mac requis. On installe l'APK, puis on relance npm run mobile.",
       size=11.5, fill=INK2, italic=True)

# ---------------------------------------------------------------- garde-fous
s.rect(30, 786, 1260, 90, fill=PANEL, stroke=RULE, sw=1.2, rx=4)
s.rect(50, 810, 16, 2.6, fill=AMBER, stroke="none", sw=0)
s.text(76, 816, "LES TROIS ERREURS QUI FONT PERDRE UNE SOIRÉE", size=11.5, fill=INK2, weight="700", ls="1.6")
s.lines(50, 846, [
    "1.  Oublier de compiler shared → « Cannot find module @geocras/shared ».      2.  Les deux secrets JWT identiques → le serveur refuse de démarrer.",
    "3.  Tester la carte dans Expo Go → écran gris, aucune erreur.",
], size=11.5, fill=INK, lh=17)

s.save("figures/10-installation.svg")
print("ok")

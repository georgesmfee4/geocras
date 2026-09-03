# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1180, 660)

def band(x, y, w, h, title, sub):
    s.rect(x, y, w, h, fill=PANEL, stroke=RULE, sw=1.2, rx=3)
    s.rect(x + 16, y + 15, 16, 2.4, fill=RED, stroke="none", sw=0)
    s.text(x + 40, y + 21, title, size=11.5, fill=INK2, weight="700", ls="1.6")
    s.text(x + w - 16, y + 21, sub, size=11, fill=MUTED, anchor="end")

def box(x, y, w, h, title, rows, accent=INK, fill=BG):
    s.chamfer(x, y, w, h, cut=12, fill=fill, stroke=accent, sw=1.7)
    s.text(x + 14, y + 24, title, size=14.5, fill=INK, weight="700")
    s.lines(x + 14, y + 44, rows, size=11.5, fill=INK2, lh=15)

# ---- Couche 1 : mobile
band(40, 34, 1100, 190, "COUCHE PRÉSENTATION", "React Native 0.81 · Expo SDK 54 · TypeScript")
box(64, 78, 236, 128, "Écrans", [
    "expo-router, 26 routes", "Carte, SOS, résultats", "suivi, fiche garage",
    "atelier, fidélité", "profil, paramètres"], accent=RED)
box(316, 78, 236, 128, "État applicatif", [
    "TanStack Query", "  cache serveur, retry", "Zustand",
    "  suivi, mode conduite", "Context : session, thème"])
box(568, 78, 236, 128, "Couche d'accès", [
    "src/api  client HTTP", "src/realtime  Socket.io", "src/location  GPS + EMA",
    "src/driving  AlertSource", "aucun fetch hors de src/api"])
box(820, 78, 296, 128, "Rendu cartographique", [
    "MapLibre GL Native", "style vectoriel maison", "marqueurs en écusson",
    "tracé d'itinéraire", "identique iOS / Android"], accent=BLUE)

# ---- Couche 2 : contrats
s.rect(40, 250, 1100, 74, fill=TINT, stroke=RED, sw=1.4, rx=3)
s.text(64, 278, "packages/shared", size=14.5, fill=RED_DK, weight="700", font=MONO)
s.text(64, 298, "contrats zod  ·  taxonomie des pannes  ·  barème et grades de fidélité  ·  géométrie et ETA  ·  contrat temps réel",
       size=12, fill=INK2)
s.text(1116, 288, "importé des deux côtés", size=11, fill=RED_DK, anchor="end", italic=True)

# ---- Couche 3 : serveur
band(40, 346, 1100, 186, "COUCHE MÉTIER", "Node.js 22 · Express 5 · Socket.io · Kysely")
box(64, 390, 320, 124, "Modules par domaine", [
    "auth   garages   requests", "loyalty   reviews   driving", "me   uploads   routing",
    "routes · service · repo"])
box(400, 390, 236, 124, "Middleware", [
    "authentification JWT", "validation zod", "traitement d'erreurs",
    "limitation de débit"])
box(652, 390, 236, 124, "Temps réel", [
    "room par demande", "ETA calculé serveur", "journal + rejeu",
    "file de travail garage"], accent=GREEN)
box(904, 390, 212, 124, "Migrations", [
    "SQL pur versionné", "0001 → 0007", "exécutées au", "démarrage"])

# ---- Couche 4 : données et services
band(40, 548, 540, 96, "COUCHE DONNÉES", "PostgreSQL 16")
box(64, 586, 236, 46, "PostgreSQL + PostGIS", ["14 tables · index GIST, GIN"], accent=GREEN)
box(316, 586, 240, 46, "Neon", ["hébergement serverless"], accent=GREEN)

band(600, 548, 540, 96, "SERVICES EXTERNES", "dépendances tierces")
box(624, 586, 156, 46, "MapTiler", ["tuiles vectorielles"], accent=MUTED)
box(796, 586, 156, 46, "Cloudinary", ["photos, upload signé"], accent=MUTED)
box(968, 586, 148, 46, "OSRM", ["itinéraires (prévu)"], accent=MUTED)

# ---- Flèches inter-couches
for x in (300, 590, 880):
    s.line(x, 224, x, 250, stroke=INK2, sw=1.4, marker="arrowmut")
    s.line(x, 324, x, 346, stroke=INK2, sw=1.4, marker="arrowmut")
s.line(300, 532, 300, 548, stroke=INK2, sw=1.4, marker="arrowmut")
s.line(880, 532, 880, 548, stroke=INK2, sw=1.4, marker="arrowmut")

s.text(316, 240, "HTTPS  REST + WebSocket", size=10.5, fill=MUTED)
s.text(316, 340, "types partagés", size=10.5, fill=MUTED)
s.text(316, 544, "SQL typé (Kysely)", size=10.5, fill=MUTED)
s.text(896, 544, "HTTPS", size=10.5, fill=MUTED)

s.save("figures/01-architecture.svg")
print("ok")

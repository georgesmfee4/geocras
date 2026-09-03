# -*- coding: utf-8 -*-
"""Le pipeline de la carte : du capteur GPS au marqueur peint."""
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1400, 664)
TOP, BOT = 24, 616

def band(x, w, label, tone):
    s.rect(x, TOP, w, BOT - TOP, fill=PANEL, stroke=RULE, sw=1.2, rx=4)
    s.rect(x + 18, TOP + 22, 16, 2.6, fill=tone, stroke="none", sw=0)
    s.text(x + 44, TOP + 29, label, size=13, fill=INK2, weight="700", ls="1.6")

def box(x, y, w, title, rows, accent=INK, fill=BG):
    """La hauteur se déduit du nombre de lignes : aucun débordement possible."""
    h = 52 + len(rows) * 17 + 12
    s.chamfer(x, y, w, h, cut=12, fill=fill, stroke=accent, sw=1.7)
    s.text(x + 16, y + 27, title, size=16, weight="700")
    s.lines(x + 16, y + 52, rows, size=12.5, fill=INK2, lh=17, font=MONO)
    return y + h

def down(x, y1, label=None, gap=28):
    y2 = y1 + gap
    s.line(x, y1, x, y2, stroke=INK, sw=1.7, marker="arrow")
    if label:
        s.text(x + 12, y1 + gap / 2 + 4, label, size=12, fill=MUTED, italic=True)
    return y2

# ============================ colonne 1 : appareil ============================
band(24, 440, "SUR L'APPAREIL", BLUE)
y = box(44, 66, 400, "expo-location", [
    "watchPositionAsync(High, 4 s, 10 m)",
    "→ lat, lng, accuracy, speed, heading",
], accent=BLUE)
y = down(244, y)
y = box(44, y, 400, "PositionFilter.accept()", [
    "1  accuracy > 200 m        → rejeté",
    "2  Δt ≤ 0 (point rejoué)   → rejeté",
    "3  isPlausibleMove()       → rejeté si",
    "     haversine / Δt > 150 km/h",
    "4  smoothSpeed()  EMA α = 0,3",
], accent=RED, fill=TINT)
y = down(244, y, "un point retenu")
y = box(44, y, 400, "useStableOrigin()", [
    "fige l'origine tant que l'écart reste",
    "sous le seuil : la liste ne tremble pas",
])
y = down(244, y)
END_DEVICE = box(44, y, 400, "useNearbyGarages()", [
    "TanStack Query · staleTime · retry",
])

# ============================ colonne 2 : serveur ============================
band(492, 440, "SUR LE SERVEUR", GREEN)
y = box(512, 66, 400, "GET /garages/nearby", [
    "lat, lng, radiusKm, sort, services,",
    "openNow, limit          (zod)",
], accent=GREEN)
y = down(712, y)
y = box(512, y, 400, "1. FILTRER  ST_DWithin", [
    "ST_DWithin(location, origin, rayon)",
    "",
    "consomme garages_location_idx (GIST)",
    "sans lui : parcours complet de table",
], accent=GREEN, fill="#F1F8F3")
y = down(712, y, "candidats")
y = box(512, y, 400, "2. NOTER  note bayésienne", [
    "n/(n+20) × note + 20/(n+20) × 3,8",
    "",
    "un 5,0 sur 2 avis ne devance pas",
    "un 4,6 sur 128",
], accent=GREEN)
y = down(712, y, "score_note")
END_SERVER = box(512, y, 400, "3. CLASSER  ROW_NUMBER()", [
    "trois clés, deux neutralisées par CASE",
], accent=GREEN)

# ============================ colonne 3 : rendu ============================
band(960, 416, "AU RENDU", RED)
y = box(980, 66, 376, "buildMapStyle(clé)", [
    "tuiles vectorielles OpenMapTiles v3",
    "nos couches, pas un style tiers",
], accent=RED)
y = down(1168, y)
y = box(980, y, 376, "Ordre des couches", [
    "fond → végétation → eau → bâti",
    "→ casing route → route → libellés",
    "",
    "aucune couche POI : les marqueurs",
    "restent les objets les plus visibles",
])
y = down(1168, y)
y = box(980, y, 376, "roadWidth()", [
    "['interpolate', ['exponential', 1.5],",
    "  ['zoom'], …]",
    "la route épaissit avec le zoom",
])
y = down(1168, y)
box(980, y, 376, "GarageMarkers", [
    "ShapeSource + SymbolLayer,",
    "rank en champ de données",
], accent=RED)

# ---- liaisons entre colonnes
s.path(f"M 444 {END_DEVICE - 40} L 470 {END_DEVICE - 40} L 470 104 L 508 104",
       stroke=INK, sw=1.7, marker="arrow")
s.text(474, 96, "HTTPS", size=12, fill=MUTED, italic=True)
s.path(f"M 912 {END_SERVER - 40} L 940 {END_SERVER - 40} L 940 {END_SERVER + 8} L 976 {END_SERVER + 8}",
       stroke=INK, sw=1.7, marker="arrow")
s.text(700, BOT - 14, "rang, distance_m, lat, lng", size=12, fill=MUTED, italic=True)

s.save("figures/11-pipeline-carte.svg")
print("ok")

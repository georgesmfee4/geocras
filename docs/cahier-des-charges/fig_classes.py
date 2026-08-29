# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1520, 1080)
BOXES = {}

def cls(key, x, y, w, name, attrs, ops=None, stereo=None, accent=INK):
    hdr = 30 + (14 if stereo else 0)
    h = hdr + 8 + len(attrs) * 14.5 + (8 + len(ops) * 14.5 + 4 if ops else 4)
    s.rect(x, y, w, h, fill=BG, stroke=accent, sw=1.7)
    s.rect(x, y, w, hdr, fill=PANEL, stroke=accent, sw=1.7)
    yy = y + 15
    if stereo:
        s.text(x + w / 2, yy, stereo, size=10, fill=MUTED, anchor="middle", italic=True)
        yy += 15
    s.text(x + w / 2, yy + 5, name, size=13.5, anchor="middle", weight="700")
    cy = y + hdr + 16
    for a in attrs:
        s.text(x + 10, cy, a, size=10.5, fill=INK2, font=MONO)
        cy += 14.5
    if ops:
        s.line(x, cy - 10, x + w, cy - 10, stroke=RULE, sw=1.1)
        cy += 6
        for o in ops:
            s.text(x + 10, cy, o, size=10.5, fill=INK, font=MONO)
            cy += 14.5
    BOXES[key] = (x, y, w, h)
    return BOXES[key]

def rel(a, b, mult_a="", mult_b="", label="", marker="diamond", dash=None, side="v", off=0):
    ax, ay, aw, ah = BOXES[a]
    bx, by, bw, bh = BOXES[b]
    if side == "v":
        x = min(ax + aw, bx + bw) - max(ax, bx)
        cx = max(ax, bx) + x / 2 + off
        y1, y2 = (ay + ah, by) if ay < by else (ay, by + bh)
        s.line(cx, y1, cx, y2, stroke=INK, sw=1.4, dash=dash, marker=marker)
        my = (y1 + y2) / 2
        if mult_a: s.text(cx + 6, y1 + (15 if ay < by else -7), mult_a, size=10, fill=INK2, font=MONO)
        if mult_b: s.text(cx + 6, y2 - (7 if ay < by else -15), mult_b, size=10, fill=INK2, font=MONO)
        if label: s.text(cx - 6, my, label, size=10, fill=MUTED, anchor="end", italic=True)
    else:
        y = min(ay + ah, by + bh) - max(ay, by)
        cy = max(ay, by) + y / 2 + off
        x1, x2 = (ax + aw, bx) if ax < bx else (ax, bx + bw)
        s.line(x1, cy, x2, cy, stroke=INK, sw=1.4, dash=dash, marker=marker)
        if mult_a: s.text(x1 + (8 if ax < bx else -8), cy - 6, mult_a, size=10, fill=INK2, font=MONO,
                          anchor="start" if ax < bx else "end")
        if mult_b: s.text(x2 - (8 if ax < bx else -8), cy - 6, mult_b, size=10, fill=INK2, font=MONO,
                          anchor="end" if ax < bx else "start")
        if label: s.text((x1 + x2) / 2, cy + 15, label, size=10, fill=MUTED, anchor="middle", italic=True)

# ---------------- colonne 1 : acteurs et parc ----------------
cls("user", 40, 40, 250, "Utilisateur", [
    "- id : UUID", "- nomComplet : String", "- telephone : String «unique»",
    "- email : String", "- motDePasseHash : String", "- role : RoleUtilisateur",
    "- ville : String", "- langue : Locale", "- pointsFidelite : Integer",
    "- codeParrainage : String", "- parrainePar : UUID",
], ["+ grade() : Grade", "+ soldePoints() : Integer"], accent=RED)

cls("veh", 40, 350, 250, "Vehicule", [
    "- id : UUID", "- type : TypeVehicule", "- marque : String", "- modele : String",
    "- annee : Integer", "- immatriculation : String", "- parDefaut : Boolean",
])

cls("token", 40, 540, 250, "JetonRafraichissement", [
    "- id : UUID", "- jetonHash : String «unique»", "- expireLe : DateTime",
    "- revoqueLe : DateTime",
])

cls("ledger", 40, 700, 250, "MouvementFidelite", [
    "- id : UUID", "- deltaPoints : Integer", "- motif : MotifFidelite",
    "- etat : EtatMouvement", "- cleIdempotence : String «unique»",
    "- confirmeLe : DateTime",
], accent=GREEN)

cls("badge", 40, 900, 250, "Badge", [
    "- id : String", "- libelleFr : String", "- libelleEn : String", "- ton : TonBadge",
])

# ---------------- colonne 2 : la demande ----------------
cls("req", 360, 40, 300, "DemandeAssistance", [
    "- id : UUID", "- typeVehicule : TypeVehiculeDemande",
    "- libelleVehicule : String", "- typePanne : TypePanne",
    "- description : String", "- urgence : NiveauUrgence",
    "- immobilise : Boolean", "- passagersVulnerables : Boolean",
    "- photoUrl : String", "- origine : Point «GEOGRAPHY»",
    "- precisionM : Real", "- statut : StatutDemande",
    "- dernierSeq : Integer", "- creeeLe / accepteeLe : DateTime",
    "- enRouteLe / clotureeLe : DateTime",
    "- garageArriveLe : DateTime", "- clientArriveLe : DateTime",
], ["+ estEnCours() : Boolean", "+ peutEtreCloturee() : Boolean"], accent=RED)

cls("event", 360, 490, 300, "EvenementDemande", [
    "- id : BigInt", "- seq : Integer", "- type : TypeEvenement",
    "- roleActeur : RolePartie", "- charge : JSON",
    "- position : Point «GEOGRAPHY»", "- creeLe : DateTime",
], stereo="«journal en ajout seul»")

cls("ping", 360, 720, 300, "PositionPing", [
    "- id : BigInt", "- role : RolePartie", "- position : Point «GEOGRAPHY»",
    "- vitesseMps : Real", "- capDeg : Real", "- precisionM : Real",
    "- mesureeLe : DateTime",
], stereo="«preuve de mouvement»", accent=BLUE)

# ---------------- colonne 3 : garage et avis ----------------
cls("garage", 730, 40, 300, "Garage", [
    "- id : UUID", "- nom : String", "- description : String",
    "- telephone : String", "- email : String",
    "- position : Point «GEOGRAPHY»", "- adresse : String",
    "- quartier : String", "- ville : String",
    "- certifie : Boolean", "- certifieLe : DateTime",
    "- verifieLe : DateTime", "- note : Decimal(2,1)",
    "- nombreAvis : Integer", "- services : String[]",
    "- specialites : String[]", "- photos : String[]",
    "- horaires : JSON", "- actif : Boolean",
], ["+ estOuvert(t) : Boolean", "+ noteBayesienne() : Real"], accent=RED)

cls("review", 730, 520, 300, "Avis", [
    "- id : UUID", "- note : Integer [1..5]", "- commentaire : String",
    "- creeLe : DateTime",
], stereo="«une par demande clôturée»")

# ---------------- colonne 4 : mode conduite ----------------
cls("sess", 1100, 40, 300, "SessionConduite", [
    "- id : UUID", "- idSessionClient : String", "- demarreeLe : DateTime",
    "- termineeLe : DateTime", "- distanceM : Double",
    "- vitesseMaxKmh : Real", "- vitesseMoyKmh : Real",
    "- nombreAlertes : Integer", "- score : Integer [0..100]",
], accent=AMBER)

cls("alert", 1100, 260, 300, "AlerteConduite", [
    "- id : BigInt", "- type : TypeAlerte", "- gravite : Gravite",
    "- vitesseKmh : Real", "- distanceM : Real", "- survenueLe : DateTime",
], accent=AMBER)

# ---------------- énumérations ----------------
cls("enum1", 1100, 430, 300, "StatutDemande", [
    "pending", "selected", "accepted", "en_route",
    "awaiting_confirmation", "closed", "cancelled",
], stereo="«énumération»", accent=MUTED)

cls("enum2", 1100, 620, 300, "Grade", [
    "standard  (0 réparation, 0 %)", "bronze    (1 réparation, 3 %)",
    "gold      (10 réparations, 6 %)", "vip       (20 réparations, 9 %)",
    "vip_platinum (35, 12 %)", "vip_diamond  (60, 15 %)",
], stereo="«énumération»", accent=MUTED)

cls("enum3", 1100, 810, 300, "TypePanne", [
    "battery, flat_tyre, overheating,", "out_of_fuel, brakes, clutch,",
    "gearbox, alternator, electrical,", "chain_transmission, carburettor,",
    "air_brakes, axle_suspension, …", "21 valeurs, triées par véhicule",
], stereo="«énumération»", accent=MUTED)

# ---------------- relations ----------------
def elbow_left(a, b, mult_a="1", mult_b="0..*", label="", spine=22):
    """Connecteur coudé longeant la marge gauche : évite de traverser les classes."""
    ax, ay, aw, ah = BOXES[a]
    bx, by, bw, bh = BOXES[b]
    y1, y2 = ay + ah - 22, by + bh / 2
    s.path(f"M {ax} {y1} L {spine} {y1} L {spine} {y2} L {bx} {y2}",
           stroke=INK, sw=1.4, marker="diamond")
    s.text(ax - 8, y1 - 6, mult_a, size=10, fill=INK2, font=MONO, anchor="end")
    s.text(bx - 8, y2 - 6, mult_b, size=10, fill=INK2, font=MONO, anchor="end")
    if label:
        s.text(spine + 8, (y1 + y2) / 2, label, size=10, fill=MUTED, italic=True)

rel("user", "veh", "1", "0..*", "possède", side="v", off=-70)
elbow_left("user", "token")
elbow_left("user", "ledger")
rel("ledger", "badge", "", "", "", marker=None, dash="4 3")

# Utilisateur → SessionConduite : contourne par le haut du plan
s.path("M 165 40 L 165 18 L 1250 18 L 1250 40", stroke=INK, sw=1.4, marker="diamond")
s.text(700, 13, "1  enregistre  0..*", size=10, fill=MUTED, anchor="middle", italic=True)

rel("user", "req", "1", "0..*", "émet", side="h", off=-120)
rel("garage", "req", "0..1", "0..*", "traite", side="h", off=-120)
rel("req", "event", "1", "1..*", "journalise", side="v")
rel("req", "ping", "1", "0..*", "", side="v", off=90)
rel("garage", "review", "1", "0..*", "reçoit", side="v")
rel("req", "review", "1", "0..1", "autorise", side="h", off=120)
rel("sess", "alert", "1", "0..*", "", side="v")

s.text(760, 1060, "Composition (losange plein côté conteneur) : le journal, les pings et les alertes n'existent pas sans leur parent.",
       size=11, fill=MUTED, anchor="middle", italic=True)

s.save("figures/04-classes.svg")
print("ok")

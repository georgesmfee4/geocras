# ÉCRAN — Mode conduite

> Joindre : `ecrans/06-conduite-demarrer.png` et `ecrans/07-conduite-actif.png`

---

Implémente le mode conduite en deux états, conformes aux maquettes jointes.

## État repos
- Fond sombre `#121110` avec halo radial rouge très diffus.
- Titre « Prêt à conduire ? » encadré de deux filets rouges et du libellé « MODE CONDUITE ».
- **Gros disque DÉMARRER** de 152 px, rouge, avec triangle de lecture et onde pulsante.
- Deux interrupteurs : Alertes sonores, Détection d'angle mort.

## État actif
- Bandeau « SESSION ACTIVE » avec pastille clignotante et chronomètre en mono.
- **Vitesse en 104 px de mono**, unité en dessous en 11 px letter-spacing .28em,
  soulignée d'un filet rouge de 64 px.
- Trois compteurs séparés par des filets : ALERTES · DISTANCE · SCORE (lettre, en vert).
- **Pile d'alertes** :
  - Alerte active : fond `#2A1513`, **bordure gauche rouge de 3 px**, pastille carrée
    rouge, titre, sous-titre, et distance en mono à droite. L'ensemble clignote doucement.
  - Alerte secondaire : bordure gauche `#E0A32E`.
  - Alerte passée : bordure grise, opacité réduite, horodatage relatif.
- Barre de contrôle : Pause · « Enregistrement… » · Stop (carré rouge chamfré).

## Le moteur de simulation — le point le plus important

En v1, les alertes sont **simulées**. Mais la simulation doit être crédible et surtout
**remplaçable**. Construis-la ainsi :

- Un module `src/driving/AlertEngine.ts` derrière une **interface**
  `AlertSource` (`start()`, `stop()`, `onAlert(cb)`).
- Une implémentation `SimulatedAlertSource` : scénario scripté et **plausible** — les
  alertes suivent la vitesse et le temps écoulé, pas un tirage aléatoire pur.
  Un feu rouge apparaît quand la vitesse baisse ; un angle mort survient en phase de
  vitesse stable ; les alertes ne se chevauchent jamais de façon absurde.
- La vitesse suit une courbe réaliste : accélérations et décélérations progressives,
  jamais de saut de 40 à 90 km/h en une seconde.
- Vibration (`expo-haptics`) et son sur alerte critique.
- Toute la session est enregistrée dans `drivingSessions` à l'arrêt.

Plus tard, brancher de vrais capteurs devra consister à écrire une seconde implémentation
de `AlertSource` — sans toucher à l'interface.

⚠️ Contrainte de sécurité : l'écran doit rester lisible d'un coup d'œil, à bout de bras,
en conduisant. Rien de petit, rien de tapotable pendant la conduite sauf Pause et Stop.

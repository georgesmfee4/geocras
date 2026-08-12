# ÉCRAN — Itinéraire & suivi

> Joindre : `ecrans/04-itineraire-suivi.png`

---

Implémente l'écran de suivi, conforme à la maquette jointe.

- Tracé de l'itinéraire en **trois couches superposées** : ombre `#1C1A17` à 14 %
  (9 px), trait rouge plein (6 px), et pointillés blancs animés qui défilent vers la
  destination (2 px, dash 2/15).
  Le tracé **part exactement du point bleu de l'utilisateur** et **arrive exactement sur
  la pointe du marqueur de destination** — pas d'approximation.
- **Bandeau de suivi** sombre en haut :
  - Pastille verte clignotante + « Le garagiste est en route » + « MAJ 3s » en mono
  - Deux compteurs côte à côte, séparés par un filet de 1 px :
    **VERS VOUS** → « 8 min » en mono blanc + « 2,4 km · 45 km/h »
    **VERS GARAGE** → « 5 min » en mono rouge + « 1,2 km · à pied »
- Le véhicule du garagiste est un disque blanc bordé de rouge qui **se déplace le long
  du tracé** au fil des positions reçues.
- Pied : carte d'identité du dépanneur (avatar chamfré, nom, note et plaque en mono,
  bouton d'appel) + bouton vert **« Confirmer l'arrivée »** chamfré.

Voir `05-TEMPS-REEL.md` pour la mécanique de synchronisation.

# ÉCRAN — Accueil / Carte

> Joindre : `ecrans/01-accueil-carte.png`. **C'est l'écran le plus important de l'app.**

---

Implémente l'écran d'accueil de GeoCras, conforme à la maquette jointe.

## Carte
- `react-native-maps` plein écran, style personnalisé aux couleurs de la maquette :
  fond `#EFEBE2`, routes `#FEFBF0` avec casing `#E2DDD1`, eau `#BBD5EA`,
  végétation `#D9E6C8`, bâtiments `#E6E1D6`. Pas de POI parasites, pas de couleurs vives.
- Position utilisateur : point bleu `#2D6FD6` bordé de blanc, halo pulsant, et **cercle
  de précision** semi-transparent autour.
- Voile blanc dégradé sur les 190 px du haut, pour que la barre de recherche reste
  lisible quel que soit le fond de carte.

## Marqueurs
- Écusson pentagonal numéroté (`polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)`), 38 px.
- **Certifié** : rempli `#E53935`, bordure blanche, pastille ✓ blanche en haut à droite.
- **Non certifié** : fond blanc, bordure `#1C1A17` de 2 px, 33 px.
- Ombre portée elliptique floutée au sol sous chaque marqueur.
- Le n° 1 porte une bulle sombre : nom du garage + distance en mono rouge.
- **Le numéro vient du serveur** (`rank`), il n'est jamais recalculé côté client.

## Chrome
- Bouton 3 barres chamfré 48 px, ouvre le drawer.
- Champ de recherche 48 px avec avatar « JD » intégré à droite.
- Ligne de contexte : pastille verte clignotante + « **7** garages ouverts autour de vous »
  (le chiffre en mono).
- Puces de filtre : Certifiés (actif, fond `#1C1A17`), Ouverts, Remorquage.
- À droite : bouton de bascule 2D/3D et **bouton de recentrage** (croix de visée bleue).

## Feuille du bas — la partie critique
Elle contient, de haut en bas :
1. Poignée de 34 × 3 px.
2. **Position exacte** : libellé majuscule 9 px, adresse en gras, et badge vert
   « ±5m » en mono avec pastille clignotante. Cette ligne doit toujours tenir sur une ligne.
3. Carrousel horizontal des garages proches : vignette, nom, badge ✓, et
   « ★4,6 · 1,2km · 5min » en mono.
4. **Bouton SOS** : 64 px, rouge, chamfré, avec un halo qui pulse en boucle
   (`box-shadow` animé) et une icône à ondes concentriques. Titre « SOS — Trouver un
   garage » + sous-titre « Position envoyée automatiquement », les deux sur **une seule
   ligne chacun**, jamais tronqués.

Le bouton SOS est l'action la plus importante de l'application : il doit rester atteignable
au pouce, visible en plein soleil, et déclencher immédiatement l'écran de déclaration
de panne.

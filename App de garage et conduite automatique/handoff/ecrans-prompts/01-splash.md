# ÉCRAN — Splash

> Joindre : `ecrans/00-splash.png`

---

Implémente l'écran de lancement de GeoCras, conforme à la maquette jointe.

- Fond rouge avec dégradé radial : `#F1544F` au centre haut → `#E53935` → `#BF2723`.
- Fond de carte fantôme (rues, fleuve) à 10 % d'opacité — repris de l'écran Carte.
- Logo : carré blanc **chamfré** de 94 px, cercle rouge de 38 px avec point central.
- Deux ondes concentriques blanches qui pulsent en boucle (décalage de 1 s entre elles).
- Wordmark `GEOCRAS` : 36 px, `GEO` poids 500 + `CRAS` poids 800, letter-spacing .11em.
- Baseline « UN GARAGE PROCHE, EN UN GESTE » : 11 px, majuscules, letter-spacing .22em,
  blanc à 70 %.
- Barre de progression 128 × 2 px + « acquisition GPS… » en mono, avec pastille clignotante.
- Pied : « CAMEROUN · V1.0 » en mono, 9,5 px, letter-spacing .16em.

**Comportement réel** : l'écran demande la permission de localisation et acquiert la
position. Il ne disparaît que lorsque la position est obtenue **ou** après 4 s en cas
d'échec — dans ce cas, l'app s'ouvre avec un bandeau « position indisponible » et un
bouton pour réessayer. Ne fais pas un splash décoratif avec un `setTimeout`.

Prévoir aussi la variante mode sombre (fond `#121110`, logo rouge, halo rouge).

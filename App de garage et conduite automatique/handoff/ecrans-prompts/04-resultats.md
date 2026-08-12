# ÉCRAN — Résultats & fiche garage

> Joindre : `ecrans/03-resultats-fiche.png`

---

Implémente l'affichage des résultats de recherche, conforme à la maquette jointe.

- En-tête flottant : « 3 résultats » en mono sur fond blanc + rappel de la panne
  recherchée en petit.
- **Puces de tri** : Plus proche · Mieux noté · Certifié. La puce active est `#1C1A17`.
  **Changer de tri renumérote les marqueurs sur la carte** avec une transition douce —
  c'est le mécanisme central de l'écran, il doit être immédiat et visible.
- Marqueurs identiques à l'écran Carte (écusson numéroté, certifié vs non certifié).
- **Feuille contextuelle** au clic sur un marqueur, avec animation d'entrée par le bas :
  - Vignette photo 66 px portant le **numéro de rang chamfré en surimpression**
  - Nom du garage, badge « ✓ CERTIFIÉ » rouge
  - « 1,2 km · 5 min » en mono
  - Étoiles + « 4,6 · 128 avis » en mono
  - Deux boutons : **Appeler** (contour encre) et **Itinéraire** (rouge chamfré)
- « Appeler » ouvre le composeur natif. « Itinéraire » trace le trajet sur la carte et
  bascule sur l'écran de suivi.
- Balayer la feuille vers le bas la referme ; balayer horizontalement passe au garage suivant.

Si aucun garage n'est trouvé : état vide explicite avec élargissement du rayon de recherche
proposé, et le numéro vert d'assistance en secours.

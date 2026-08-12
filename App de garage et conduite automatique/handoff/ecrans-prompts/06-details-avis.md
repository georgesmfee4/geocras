# ÉCRAN — Détails garage & avis

> Joindre : `ecrans/05-details-avis.png`

---

Implémente la fiche détaillée d'un garage, conforme à la maquette jointe.

- **Photo en bandeau** de 216 px, carrousel horizontal avec indicateur en tirets
  (le tiret actif est plus long, pas un point).
- Bouton retour sur fond sombre translucide.
- Panneau de contenu qui remonte sur la photo, coins hauts arrondis à 20 px.
- Nom en 20 px poids 800, badge « ✓ CERTIFIÉ » aligné en haut à droite.
- Étoiles + « 4,6 · 128 avis · 1,2 km » en mono.
- **Bandeau de 3 statistiques** séparées par des filets de 1 px, valeurs en mono :
  24h (Ouvert) · 12 ans (Métier) · Oui (Remorquage, en vert).
- Description courte.
- **Avis** sous le filet rouge « AVIS CLIENTS » : avatar avec initiales sur fond teinté,
  nom, étoiles, ancienneté en mono à droite, texte de l'avis.
- Pied fixe : bouton étoile (contour encre) pour noter + « Contacter le garage » chamfré.

Le bouton étoile ouvre la saisie d'un avis : note 1–5 et commentaire.
**Seul un utilisateur ayant une demande clôturée avec ce garage peut publier un avis** —
sinon le bouton est désactivé avec une explication claire.

# ÉCRAN — Profil, menu latéral & paramètres

> Joindre : `ecrans/08-profil-fidelite.png`, `ecrans/09-menu-lateral.png`,
> `ecrans/10-parametres-sombre.png`

---

Implémente les trois écrans de compte, conformes aux maquettes jointes.

## Profil
- En-tête rouge de 214 px avec fond de carte fantôme à 12 %.
- Avatar **chamfré** blanc de 74 px avec initiales rouges.
- Nom, puis téléphone masqué et ville en mono.
- Carte « MON VÉHICULE » sous filet rouge : pictogramme, modèle, « 2018 · LT-4821 » en
  mono, lien « Modifier ». Gérer **plusieurs véhicules** avec un véhicule par défaut.
- « FIDÉLITÉ » avec le total de points en mono rouge.
- **Trois badges chamfrés** séparés par des filets : Membre Or (rouge), 10 dépannages
  (ambre), Parrain (grisé, non débloqué).
- Encart sombre « Prochain palier » : barre de progression rouge et
  « 260 pts restants · garages certifiés » en mono.

## Menu latéral
Voir `03-NAVIGATION.md`. **Assistance** affiche le numéro vert dans une pastille verte
en mono et déclenche l'appel direct.

## Paramètres (montré en mode sombre)
- **Apparence** : sélecteur 3 positions Clair / Sombre / Auto, segments séparés par des
  filets de 1 px, position active en rouge plein.
- **Notifications** : Garagiste en route · Alertes de conduite · Offres & fidélité.
  Interrupteurs **carrés**, pas arrondis.
- **Langue** : Français (coché rouge) / English.
- Ajoute aussi : unités (km/miles), partage de position en arrière-plan, mode économie
  de données, effacer l'historique, contacts d'urgence.
- Pied : « GEOCRAS V1.0 · BUILD 104 » en mono, letter-spacing .12em.

## Sécurité (à concevoir, pas dans les maquettes)
Propose-moi le contenu avant de coder. Ma direction : code PIN à l'ouverture,
contacts d'urgence prévenus automatiquement en cas de SOS, partage de trajet en direct
avec un proche, historique des connexions, et blocage à distance du compte.

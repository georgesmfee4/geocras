# PROMPT 3 — Navigation

> Joindre : `ecrans/01-accueil-carte.png` et `ecrans/09-menu-lateral.png`

---

Mets en place le squelette de navigation de GeoCras. Les écrans restent **vides**
(un simple titre) — seule la navigation est implémentée.

## Structure
- **Bottom tab à 2 entrées** : `CARTE` et `CONDUITE`.
  - Libellés en majuscules, 10 px, poids 700, letter-spacing .04em
  - Onglet actif en `#E53935` avec un **trait rouge de 26 × 2,5 px collé au bord haut
    de la barre**, centré sur l'onglet — voir la maquette
  - Onglet inactif en `#B5AFA3` (clair) / `#565149` (sombre)
  - Hauteur 82 px, safe area comprise, fond `#F6F4EF` avec filet haut `#E8E4DB`
- **Drawer latéral** ouvert par le bouton 3 barres en haut à gauche de l'écran Carte.
  Largeur 81 %. Entrées : Profil, Sécurité, Assistance, Paramètres, Historique.
  L'entrée active porte une bordure gauche rouge de 3 px et un fond `#FCECEA`.
  En-tête rouge avec avatar chamfré, nom, et « Membre Or · 1 240 pts » en mono.
  Pied de menu : « Déconnexion » et le numéro de version en mono.
- **Stack** par-dessus pour : Détail garage, Itinéraire, Avis, Paramètres.

## Attendu
Navigation typée (pas de `any` sur les routes), deep-linking prévu,
et le bouton matériel Retour d'Android géré correctement.

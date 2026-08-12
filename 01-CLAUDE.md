# CLAUDE.md — à copier à la racine du repo GeoCras

> Claude Code lit ce fichier à chaque session. C'est lui qui empêche la dérive visuelle.

---

# GeoCras

Application mobile de géolocalisation de garages et d'assistance à la conduite.
Marché : Cameroun (Douala en premier). Langue de l'interface : français.

## Stack
- **Mobile** : React Native + Expo, TypeScript
- **Serveur** : Node.js + Express + MongoDB (Mongoose)
- **Carte** : react-native-maps
- **Temps réel** : Socket.io

## Identité visuelle — NON NÉGOCIABLE

Quatre partis pris qui reviennent partout. C'est ce qui distingue GeoCras d'une app générique.

### 1. L'angle coupé (chamfer)
Coin inférieur droit coupé à 45° sur : logo, boutons d'action rouges, avatars, badges de
fidélité. Jamais sur les cartes de contenu ni les champs de saisie.
```
clipPath / masque : polygon(0 0, 100% 0, 100% 74%, 74% 100%, 0 100%)
```
Sur un bouton large, la coupe est plus douce : `100% 72%, 94% 100%`.

### 2. Le chiffre en mono
**IBM Plex Mono** pour TOUTE donnée mesurée : distances, ETA, vitesse, notes, points,
plaques, précision GPS, horodatages, numéros de version.
**Inter** pour tout le reste. Jamais l'inverse.

### 3. Le blanc chaud
Pas de gris bleuté. Fond `#F6F4EF`, encre `#1C1A17`.
Le mode sombre est chaud aussi : `#121110`, surfaces `#1C1A18`.

### 4. Le filet rouge
Chaque libellé de section est précédé d'un trait rouge de 14 × 2 px.
Le libellé est en majuscules, 10 px, letter-spacing .16em, couleur `#8A8578`.

## Palette

| Rôle | Clair | Sombre |
|---|---|---|
| Primaire | `#E53935` | `#E53935` |
| Primaire foncé | `#C62A26` | `#C62A26` |
| Teinte primaire | `#FCECEA` | `#2A1513` |
| Fond | `#F6F4EF` | `#121110` |
| Surface | `#FFFFFF` | `#1C1A18` |
| Encre | `#1C1A17` | `#FFFFFF` |
| Encre secondaire | `#6E6A62` | `#BDB7AB` |
| Discret | `#A39D91` | `#8C867A` |
| Filet | `#E8E4DB` | `#2A2724` |
| Succès | `#2F8F5B` | `#2F8F5B` |
| Attention | `#E0A32E` | `#E0A32E` |
| Position utilisateur | `#2D6FD6` | `#2D6FD6` |
| Fond de carte | `#EFEBE2` | — |
| Routes | `#FEFBF0` sur casing `#E2DDD1` | — |

## Règles de code

- **Aucune couleur en dur** dans un composant. Tout passe par `theme.ts`.
- **Rayons** : 0 par défaut, 2 px sur les champs et puces, 20–22 px sur les feuilles
  du bas, 50 % sur les pastilles. Pas de 8/12/16 px partout.
- **Marqueurs de carte** : écusson pentagonal numéroté
  (`polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)`), **jamais** la goutte par défaut.
  Certifié = rempli rouge + pastille ✓ blanche. Non certifié = blanc, bordure encre.
- **Aucun emoji** dans l'interface.
- **Aucune icône dessinée en SVG décoratif** : soit une vraie librairie d'icônes
  (lucide-react-native), soit des formes CSS simples comme dans les maquettes.
- Toute donnée chiffrée est en `IBM Plex Mono` avec `fontVariant: ['tabular-nums']`.
- Cible tactile minimum : 44 × 44 px.
- L'app doit rester lisible en plein soleil et utilisable **sous stress** (panne au bord
  de la route) : peu de texte, actions grandes, priorité au bouton SOS.

## Wordmark
`GEOCRAS` en capitales. `GEO` en poids 500, `CRAS` en poids 800, letter-spacing .11em.
Jamais « GeoCras » en CamelCase dans l'interface.

## Conventions
- Commits : `feat(carte): …`, `fix(sos): …`
- Un écran = un dossier dans `src/screens/`
- Les appels API passent tous par `src/api/`, jamais de `fetch` dans un composant

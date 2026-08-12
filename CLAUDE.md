@AGENTS.md

# GeoCras

Application mobile de géolocalisation de garages et d'assistance à la conduite.
Marché : Cameroun, **Yaoundé** en premier. Interface en français, anglais prévu.

> Les maquettes portent encore des libellés de Douala (Akwa, Wouri, Rue Joss).
> C'est cosmétique : **le produit se lance à Yaoundé**, le seed l'est déjà.

## Stack — décidée, ne pas rediscuter sans raison

| Domaine | Choix |
|---|---|
| Mobile | React Native + Expo SDK 54, TypeScript |
| Serveur | Node + Express 5, TypeScript |
| Base | PostgreSQL + **PostGIS** (Neon) |
| Accès données | **Kysely** + migrations SQL écrites à la main — **pas Prisma** |
| Carte | **MapLibre GL + MapTiler** — pas react-native-maps, pas Google Maps |
| Temps réel | Socket.io, room par demande |
| Itinéraire | tracé **dans l'app** (OSRM auto-hébergé prévu) — **pas** de deep link sortant |

`geocras-backend/` est un dossier **historique sans code**. Plusieurs de ses décisions ont
été remplacées — voir `geocras-backend/CLAUDE.md`. Ne pas s'y référer.

## Identité visuelle — NON NÉGOCIABLE

Quatre partis pris qui reviennent partout. C'est ce qui distingue GeoCras d'une app générique.

### 1. L'angle coupé (chamfer)
Coin inférieur droit coupé à 45° sur : logo, boutons d'action rouges, avatars, badges de
fidélité. **Jamais** sur les cartes de contenu ni les champs de saisie.
Utiliser `<ChamferView>` — ne pas réimplémenter.

### 2. Le chiffre en mono
**IBM Plex Mono** pour TOUTE donnée mesurée : distances, ETA, vitesse, notes, points,
plaques, précision GPS, horodatages, numéros de version. **Inter** pour tout le reste.
Jamais l'inverse. Passer par `<Text variant="mono|monoSmall|monoStrong|speed|footnote">`,
qui active `tabular-nums` automatiquement.

### 3. Le blanc chaud
Pas de gris bleuté. Fond `#F6F4EF`, encre `#1C1A17`.
Le mode sombre est chaud aussi : `#121110`, surfaces `#1C1A18`.

### 4. Le filet rouge
Chaque libellé de section est précédé d'un trait rouge de 14 × 2 px.
Utiliser `<SectionLabel>`.

## Palette

Elle vit dans [`apps/mobile/src/theme/tokens.ts`](apps/mobile/src/theme/tokens.ts).
**Aucune couleur en dur dans un composant** — si une valeur manque, on l'ajoute aux jetons.

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

Carte : fond `#EFEBE2`, routes `#FEFBF0` sur casing `#E2DDD1`, eau `#BBD5EA`,
végétation `#D9E6C8`, bâtiments `#E6E1D6`.

## Règles de code

### Transverses
- **Rayons** : 0 par défaut, 2 px sur champs et puces, 20–22 px sur les feuilles du bas,
  50 % sur les pastilles. Pas de 8/12/16 px partout.
- **Aucun emoji** dans l'interface.
- Pas d'icône dessinée en SVG décoratif : `lucide-react-native` ou formes simples.
- Cible tactile minimum 44 × 44 px.
- L'app doit rester lisible en plein soleil et utilisable **sous stress** (panne au bord de
  la route) : peu de texte, actions grandes, priorité au bouton SOS.

### Mobile
- Un écran = un dossier dans `apps/mobile/src/screens/` (ou une route `app/`).
- Les appels API passent tous par `src/api/`, **jamais de `fetch` dans un composant**.
- **Marqueurs de carte** : `<GarageMarker>` — écusson pentagonal numéroté, jamais la goutte
  par défaut. Certifié = rouge plein + pastille ✓. Non certifié = blanc, bordure encre 2 px.
- Le `rank` d'un marqueur **vient du serveur**. Ne jamais le dériver d'un index de tableau.

### Serveur
- Découpage par **domaine** (`src/modules/<domaine>/`), pas par couche.
- Routes minces, services épais.
- Validation zod sur **chaque** entrée avant le controller.
- Erreurs toujours `{ error: { code, message } }` — le mobile traduit sur le **code**.
- Toute écriture géographique passe par `src/db/geo.ts`. Ne jamais écrire `ST_SetSRID`
  ailleurs. Rappel : `ST_MakePoint(longitude, latitude)` — dans cet ordre.
- **`ST_DWithin` avant tout tri par distance**, sinon l'index GIST n'est pas utilisé.

### Fidélité — les points sont de l'argent
- Jamais de `UPDATE users SET points = points + n`. Toujours une ligne dans
  `loyalty_ledger` avec sa `idempotency_key`.
- Le crédit exige la **double confirmation d'arrivée** — c'est une contrainte SQL
  (`closed_requires_both_arrivals`), pas une vérification applicative.
- Voir `ANTI_FRAUD` dans `packages/shared/src/loyalty.ts` avant de toucher au barème.

## Wordmark
`GEOCRAS` en capitales. `GEO` en poids 500, `CRAS` en poids 800, letter-spacing .11em.
Jamais « GeoCras » en CamelCase dans l'interface. Utiliser `<Wordmark>`.

## Conventions
- Commits : `feat(carte): …`, `fix(sos): …`
- Un prompt = un écran = un commit.

# GeoCras

GeoCras sert à trouver un garage quand on tombe en panne à Yaoundé. On appuie sur SOS,
on dit quel véhicule et ce qui ne va pas, et les garages autour s'affichent sur une carte,
classés par pertinence. Après l'appel, le garagiste peut se déclarer en route et les deux
parties se suivent en direct jusqu'à ce qu'elles se rejoignent. L'intervention est archivée
et crédite des points de fidélité, mais seulement une fois que le client et le garagiste
ont tous les deux confirmé leur arrivée.

Il y a un deuxième volet dans l'app, le mode conduite, qui affiche la vitesse et des alertes
pendant un trajet. Il est simulé pour l'instant. Le moteur qui produit les événements est
isolé derrière une interface, de façon à pouvoir brancher de vrais capteurs plus tard sans
retoucher les écrans.

L'interface est en français. L'anglais est prévu, pas encore fait.

## Organisation du dépôt

Monorepo npm workspaces.

```
apps/mobile       React Native, Expo SDK 54, expo-router
apps/api          Express 5, Socket.io, PostgreSQL + PostGIS
packages/shared   contrats zod, taxonomie des pannes, barème de fidélité
docs/maquettes    les onze écrans dessinés qui servent de référence
```

`packages/shared` existe pour une raison précise : trois choses ne doivent jamais diverger
entre le mobile et le serveur, la liste des pannes, la forme des réponses d'API et le barème
de points. Elles vivent toutes là, importées des deux côtés, et une divergence se voit à la
compilation plutôt qu'en production.

Le détail des choix techniques est dans [ARCHITECTURE.md](ARCHITECTURE.md). Les règles de
code dans [CONTRIBUTING.md](CONTRIBUTING.md), et tout ce qui touche à l'apparence dans
[docs/charte-visuelle.md](docs/charte-visuelle.md).

## Installation

```bash
npm install
npm run build --workspace @geocras/shared
```

Le build de `shared` n'est pas optionnel : l'api et le mobile en dépendent tous les deux,
rien ne démarre sans lui.

### La base de données

Il faut un Postgres avec PostGIS. J'utilise Neon.

1. Créer un projet sur [neon.tech](https://neon.tech), puis une branche `dev`. Ne jamais
   développer contre `main`.
2. Activer l'extension :
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. `cp apps/api/.env.example apps/api/.env` et renseigner `DATABASE_URL`.
4. Générer les deux secrets JWT, en veillant à ce qu'ils soient différents l'un de l'autre :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Appliquer le schéma et les données de développement :
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

Le seed imprime en fin d'exécution le plan de la requête de proximité. Il faut y trouver
`garages_location_idx`. Si l'index GIST n'apparaît pas, c'est que la requête parcourt toute
la table, et ça ne sert à rien d'avancer avant d'avoir réglé ce point.

### Le serveur

```bash
npm run api          # http://localhost:3000
curl "http://localhost:3000/garages/nearby?lat=3.848&lng=11.5021&sort=certified"
```

### Le mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env   # renseigner la clé MapTiler
npm run mobile
```

| Variable | Rôle | Défaut |
|---|---|---|
| `EXPO_PUBLIC_MAPTILER_KEY` | tuiles de carte | vide, la carte affiche alors « indisponible » |
| `EXPO_PUBLIC_API_URL` | URL de l'API | l'IP du serveur Metro, port 3000 |
| `EXPO_PUBLIC_SUPPORT_PHONE` | numéro vert du menu Assistance | `+237800000000` |

La navigation complète est en place : splash, onglets Carte et Conduite, tiroir latéral,
pile par-dessus. Les écrans produits sont écrits : carte, déclaration de panne, résultats
classés, suivi, fiche garage et avis, atelier du garagiste, fidélité, historique, profil,
véhicules, paramètres. Vingt-six routes au total. Ce qui reste tient au rendu réel de la
carte, qui ne se vérifie que sur un appareil — voir le spike plus bas.

## Le spike carte

C'est la chose à faire avant d'habiller le moindre écran. La couche carte est écrite, avec
le style aux couleurs des maquettes, le composant `MapCanvas`, les marqueurs numérotés et le
tracé d'itinéraire, et les deux plateformes bundlent. Mais le reste ne se vérifie que sur un
appareil : MapLibre ne tourne pas dans Expo Go, et son support de la New Architecture n'est
pas confirmé alors que `app.json` active `newArchEnabled: true`.

```bash
# clé MapTiler, gratuite, deux minutes → https://cloud.maptiler.com/account/keys/
npm install -g eas-cli
cd apps/mobile
eas login
eas build --profile development --platform android
```

EAS marche depuis Windows, sans Android Studio ni Mac. On installe le build, on lance
`npm run mobile` et on ouvre l'onglet CARTE.

Si la carte s'affiche aux bonnes couleurs, les écrans 01, 03 et 04 sont débloqués. Si on
obtient un écran gris ou un crash au montage, il faut repasser `newArchEnabled` à `false`
dans `app.json`, rebuilder et réessayer. Le SDK 54 est la dernière version à autoriser ce
retour en arrière, donc c'est une dette avec une date de péremption. Et si c'est toujours
cassé après ça, le repli est `react-native-maps`, en acceptant un style limité sur iOS.

Il faut aussi profiter du spike pour mesurer le rendu : soixante images par seconde au
pan et au zoom avec vingt marqueurs, sur un Android milieu de gamme. Si le budget saute,
la sortie de secours est décrite dans
[`GarageMarkers.tsx`](apps/mobile/src/map/GarageMarkers.tsx).

## Tests

```bash
npm test
```

Les tests géospatiaux ont besoin d'un vrai PostGIS. Ni pg-mem ni SQLite ne savent exécuter
`ST_DWithin`, et tester la requête centrale du produit contre une imitation ne prouverait
rien du tout. Ces tests sont donc ignorés tant que `TEST_DATABASE_URL` n'est pas défini.

```bash
# une branche Neon dédiée aux tests, jamais dev, jamais main :
# la suite exécute DROP SCHEMA public CASCADE.
TEST_DATABASE_URL=postgresql://… npm test --workspace @geocras/api
```

| Suite | Tests | Base requise |
|---|---|---|
| `@geocras/shared` — barème, taxonomie, géo, machine à états | 49 | non |
| `@geocras/api` — routes, SQL compilé, calcul d'ETA | 35 | non |
| `@geocras/api` — géospatial : plan GIST, tris, filtres, repli | 21 | oui |
| `@geocras/mobile` — filtre GPS, moteur de simulation | 28 | non |

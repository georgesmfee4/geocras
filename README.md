# GeoCras

Géolocalisation de garages et assistance à la conduite — Cameroun, Yaoundé en premier.

```
geocras/
├── apps/
│   ├── mobile/        React Native + Expo SDK 54 + expo-router
│   │   ├── app/       routes (splash, onglets, tiroir, pile)
│   │   └── src/       theme · ui · map · api · realtime · driving · location · i18n · stores
│   └── api/           Express 5 + Socket.io + PostgreSQL/PostGIS
│       ├── migrations/  SQL pur
│       └── src/         modules par domaine + realtime + db
├── packages/
│   └── shared/        contrats zod, taxonomie des pannes, barème de fidélité
└── geocras-backend/   dossier historique, sans code — ne pas suivre
```

Architecture détaillée : [`ARCHITECTURE.md`](ARCHITECTURE.md).
Règles de contribution et identité visuelle : [`CLAUDE.md`](CLAUDE.md).
Les prompts de handoff (`00-` à `05-`) restent à la racine comme référence produit.

## Démarrage

```bash
npm install
npm run build --workspace @geocras/shared    # requis avant api et mobile
```

### Base de données

1. Créer un projet sur [neon.tech](https://neon.tech), puis **une branche `dev`** —
   ne jamais développer contre `main`.
2. Activer PostGIS :
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. `cp apps/api/.env.example apps/api/.env` et renseigner `DATABASE_URL`.
4. Générer les deux secrets JWT (ils doivent être **différents**) :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Appliquer le schéma et les données de développement :
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

Le seed affiche le plan d'exécution de la requête de proximité. Il doit contenir
`garages_location_idx` : si l'index GIST n'est pas utilisé, la requête centrale du
produit ne tiendra pas la charge et il faut s'arrêter là.

### Serveur

```bash
npm run api          # http://localhost:3000
curl "http://localhost:3000/garages/nearby?lat=3.848&lng=11.5021&sort=certified"
```

### Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env   # puis renseigner la clé MapTiler
npm run mobile
```

La navigation complète est en place (splash → onglets Carte / Conduite, tiroir latéral,
pile). L'écran Carte est réel ; les autres écrans produits sont des squelettes qui
nomment la maquette qui les remplacera. L'écran de validation des primitives reste
accessible sur `geocras://design`.

| Variable | Rôle | Défaut |
|---|---|---|
| `EXPO_PUBLIC_MAPTILER_KEY` | Tuiles de carte | vide — la carte affiche alors « indisponible » |
| `EXPO_PUBLIC_API_URL` | URL de l'API | l'IP du serveur Metro, port 3000 |
| `EXPO_PUBLIC_SUPPORT_PHONE` | Numéro vert du menu Assistance | `+237800000000` |

## Le spike carte — à faire avant d'aller plus loin

La couche carte est **écrite** (style aux couleurs des maquettes, `MapCanvas`,
marqueurs numérotés, tracé d'itinéraire) et les deux plateformes bundlent. Ce qui reste
ne peut se vérifier que sur un appareil : MapLibre ne tourne pas dans Expo Go, et son
support de la New Architecture n'est pas confirmé alors que `app.json` active
`newArchEnabled: true`.

```bash
# 1. Clé MapTiler (gratuit, 2 min) → https://cloud.maptiler.com/account/keys/
# 2. Development build — EAS fonctionne depuis Windows, sans Android Studio ni Mac
npm install -g eas-cli
cd apps/mobile
eas login
eas build --profile development --platform android
```

Installer le build, lancer `npm run mobile`, ouvrir l'onglet CARTE.

| Résultat | Suite |
|---|---|
| La carte s'affiche aux bonnes couleurs | Écrans 01, 03 et 04 débloqués. Risque n°3 éteint. |
| Écran gris ou crash au montage | Passer `newArchEnabled: false` dans `app.json` (SDK 54 est la **dernière** version à le permettre — dette datée), rebuild, réessayer. |
| Toujours cassé | Repli sur `react-native-maps`, en acceptant un style limité sur iOS. |

**À mesurer pendant le spike** : 60 fps au pan/zoom avec 20 marqueurs sur un Android
milieu de gamme. Si le budget saute, la sortie est documentée dans
[`GarageMarkers.tsx`](apps/mobile/src/map/GarageMarkers.tsx).

## Tests

```bash
npm test
```

Les tests géospatiaux exigent un vrai PostGIS — ni pg-mem ni SQLite ne savent exécuter
`ST_DWithin`, et tester la requête centrale contre une imitation ne prouverait rien.
Ils sont **ignorés** tant que `TEST_DATABASE_URL` n'est pas défini :

```bash
# Une branche Neon dédiée aux tests — jamais `dev`, jamais `main` :
# la suite exécute DROP SCHEMA public CASCADE.
TEST_DATABASE_URL=postgresql://… npm test --workspace @geocras/api
```

| Suite | Tests | Base requise |
|---|---|---|
| `@geocras/shared` — barème, taxonomie, géo, machine à états | 49 | non |
| `@geocras/api` — routes, SQL compilé, calcul d'ETA | 35 | non |
| `@geocras/api` — géospatial (plan GIST, tris, filtres, repli) | 21 | **oui** |
| `@geocras/mobile` — filtre GPS, moteur de simulation | 28 | non |

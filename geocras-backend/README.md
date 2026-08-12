# GeoCras Backend

API et infrastructure de données pour GeoCras — application camerounaise de géolocalisation de garages et d'assistance véhicule d'urgence.

Ce projet est **indépendant** de l'application mobile (React Native / Expo). Il expose une API REST que l'app mobile (et un futur back-office) consomment.

## Stack technique (décidée)

| Domaine | Choix | Pourquoi |
|---|---|---|
| Runtime | Node.js + TypeScript | Cohérent avec l'écosystème mobile (Expo/RN), un seul langage sur toute la stack |
| Framework HTTP | Express | Simple, ubiquitaire, documentation abondante |
| Base de données | PostgreSQL + PostGIS | Requêtes géospatiales natives et indexées (`ST_DWithin`, `ST_Distance`) — pas de calcul de distance côté application |
| Hébergement DB | Neon | Postgres serverless, PostGIS supporté nativement, tier gratuit généreux, scaling automatique |
| ORM | Prisma (tables classiques) + SQL brut (colonnes géospatiales) | Prisma n'a pas de support natif propre pour PostGIS — voir `docs/DATABASE.md` pour le pattern hybride |
| Stockage images | Cloudinary | Upload direct depuis le client (signé), pas de fichiers qui transitent par le serveur Node |
| Cartographie (app mobile) | MapLibre GL + MapTiler Cloud | Voir `docs/MAPPING.md` — remplace les tuiles OSM brutes utilisées en prototypage |
| Auth | JWT (access + refresh) + bcrypt | Standard, sans dépendance à un service tiers |

## Pourquoi ce choix de stack

Le projet mobile existant (`geocras/`) utilisait des données de garages **codées en dur** (mock) et des tuiles OpenStreetMap publiques (`tile.openstreetmap.org`) — les deux ne sont pas utilisables en production :
- Les garages doivent venir d'une vraie base que GeoCras contrôle (certification, notes, photos, horaires — ce sont des données métier propriétaires, pas des données OpenStreetMap).
- Le serveur de tuiles public OSM interdit explicitement l'usage commercial/à fort trafic (voir [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)) — il faut un vrai fournisseur de tuiles pour la prod.

Cette stack règle les deux problèmes : PostGIS pour des recherches "garages à proximité" rapides et précises sur de vraies données, MapTiler pour des tuiles de production fiables et un service de géocodage.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vue d'ensemble du système, structure de dossiers, déploiement
- [`docs/DATABASE.md`](docs/DATABASE.md) — schéma PostgreSQL/PostGIS, setup Neon, pattern Prisma + SQL géospatial, migrations
- [`docs/API.md`](docs/API.md) — spécification des routes REST (auth, garages, SOS, avis, uploads)
- [`docs/MAPPING.md`](docs/MAPPING.md) — choix de la techno cartographique côté app mobile, géocodage, itinéraires
- [`docs/STORAGE.md`](docs/STORAGE.md) — flux d'upload d'images via Cloudinary (signé, direct depuis le client)

## Démarrage rapide (pour Claude Code ou un développeur qui reprend ce projet)

1. Lire `docs/ARCHITECTURE.md` pour la vue d'ensemble avant de toucher au code.
2. Créer un projet Neon (Postgres) et activer PostGIS (`CREATE EXTENSION postgis;`) — détails dans `docs/DATABASE.md`.
3. Initialiser le projet Node : `npm init -y`, TypeScript, Express, Prisma.
4. Appliquer le schéma décrit dans `docs/DATABASE.md`.
5. Implémenter les routes une par une en suivant `docs/API.md`, dans l'ordre : auth → garages (lecture) → SOS → avis → garages (écriture/admin).
6. Créer un compte Cloudinary, configurer l'upload signé décrit dans `docs/STORAGE.md`.
7. Ne jamais committer de secrets — utiliser `.env` (voir `.env.example` à créer dès l'initialisation du projet) et l'ajouter au `.gitignore`.

## Ce que ce backend NE fait PAS (pour l'instant, volontairement)

- Pas de moteur d'itinéraire/routing intégré — l'app mobile ouvre Google Maps/Apple Maps via deep link pour la navigation (voir `docs/MAPPING.md`).
- Pas de paiement en ligne.
- Pas de notifications push (à ajouter plus tard via Expo Push Notifications, hors périmètre de ce backend pour le moment).

Ces exclusions sont volontaires pour garder le MVP maintenable — à ne réévaluer que si le produit l'exige vraiment.

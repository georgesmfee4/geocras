# Architecture

## Vue d'ensemble

```
┌─────────────────────┐         ┌──────────────────────────┐
│   App mobile Expo    │  HTTPS  │   API Node/Express        │
│   (React Native)     │────────▶│   (ce projet)             │
│                       │         │                            │
│  MapLibre + MapTiler  │         │  Auth (JWT)                │
│  (tuiles, rendu carte)│         │  Routes REST               │
└───────────┬───────────┘         │  Requêtes PostGIS          │
            │                      └───────┬─────────┬─────────┘
            │ upload direct signé          │         │
            ▼                              ▼         ▼
    ┌───────────────┐            ┌─────────────┐ ┌──────────────┐
    │   Cloudinary   │            │ Neon        │ │ MapTiler      │
    │ (photos garage,│            │ (Postgres + │ │ (tuiles carte,│
    │  photos SOS)   │            │  PostGIS)   │ │  géocodage)   │
    └───────────────┘            └─────────────┘ └──────────────┘
```

Points clés :
- L'app mobile parle **directement** à Cloudinary pour uploader des photos (upload signé — voir `STORAGE.md`), pas via le serveur Node. Le serveur ne fait que générer la signature et stocker l'URL finale.
- L'app mobile parle **directement** à MapTiler pour le rendu des tuiles de carte (le serveur Node n'est pas dans cette boucle — pas de proxy de tuiles nécessaire).
- Le serveur Node est le **seul** point d'accès à la base Postgres/PostGIS (l'app mobile ne s'y connecte jamais directement).

## Structure de dossiers recommandée

```
geocras-backend/
├── src/
│   ├── index.ts                # point d'entrée, démarrage du serveur
│   ├── app.ts                  # configuration Express (middlewares, routes)
│   ├── config/
│   │   └── env.ts              # lecture/validation des variables d'environnement
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── garages.routes.ts
│   │   ├── sos.routes.ts
│   │   ├── reviews.routes.ts
│   │   └── uploads.routes.ts
│   ├── controllers/            # logique par route (une fonction par endpoint)
│   ├── services/                # logique métier réutilisable (ex: garageSearchService)
│   ├── middleware/
│   │   ├── auth.middleware.ts  # vérification JWT
│   │   └── error.middleware.ts # gestion centralisée des erreurs
│   ├── db/
│   │   ├── client.ts           # instance Prisma partagée
│   │   └── geo.ts              # requêtes SQL brutes PostGIS (voir DATABASE.md)
│   └── lib/
│       └── cloudinary.ts       # config + génération de signature d'upload
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
└── tsconfig.json
```

Principe : **routes minces, services épais**. Une route ne fait que valider l'input et appeler un service ; toute la logique (recherche géo, calculs, règles métier) vit dans `services/`, testable indépendamment d'Express.

## Environnements

- **Développement local** : Neon a une fonctionnalité de branches de base de données (comme Git) — créer une branche `dev` séparée de `main` pour ne jamais développer contre les données de production.
- **Production** : déployer l'API sur Render ou Railway (déploiement Git direct, tier gratuit suffisant pour démarrer, montée en charge simple).

## Sécurité — non négociable dès le départ

- Toutes les routes sauf `POST /auth/signup`, `POST /auth/login`, `GET /garages/nearby` sont protégées par le middleware JWT.
- Mots de passe : `bcrypt` avec un coût ≥ 10, jamais stockés/loggés en clair.
- Validation stricte de tous les inputs (utiliser `zod` pour valider body/query avant d'atteindre un controller).
- CORS configuré explicitement pour n'autoriser que les origines connues (l'app mobile n'a pas d'origine web classique, mais si un back-office web est ajouté plus tard, restreindre son domaine).
- Rate limiting sur `/auth/login` (ex: `express-rate-limit`) pour limiter le brute-force.

## Ce qui rend cette architecture évolutive

- PostGIS + index `GIST` : les recherches "à proximité" restent rapides même à 100 000+ garages, sans changement de code.
- Neon scale automatiquement le compute Postgres — pas de migration de base de données à prévoir en cas de croissance.
- Cloudinary gère la transformation d'images à la volée (miniatures, compression) sans travail supplémentaire côté serveur.
- Le découpage routes/services/db permet de remplacer Express par un autre framework plus tard sans toucher à la logique métier.

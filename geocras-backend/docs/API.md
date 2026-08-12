# Spécification API REST

Base URL en dev : `http://localhost:3000`. Toutes les réponses en JSON. Toutes les routes protégées attendent `Authorization: Bearer <accessToken>`.

Ordre d'implémentation recommandé : **Auth → Garages (lecture) → SOS → Reviews → Garages (écriture/admin) → Uploads**. Chaque étape reste testable avant de passer à la suivante.

## Auth

### `POST /auth/signup`
Correspond au formulaire déjà construit côté app mobile (`SignupScreen.tsx`) — le payload matche déjà cette forme.

Body :
```json
{
  "fullName": "Jean Fotso",
  "phone": "+237670123456",
  "email": "jean@example.com",
  "password": "motdepasse123",
  "vehicleType": "Voiture",
  "vehicleBrand": "Toyota",
  "vehicleModel": "Corolla",
  "vehicleYear": 2020
}
```
Réponse `201` :
```json
{ "user": { "id": "...", "fullName": "...", "phone": "..." }, "accessToken": "...", "refreshToken": "..." }
```
Erreurs : `409` si `phone` déjà utilisé.

### `POST /auth/login`
Body : `{ "phone": "+237670123456", "password": "..." }` (ou `email` à la place de `phone`).
Réponse `200` : même forme que signup. `401` si identifiants invalides.
Rate-limité (ex: 10 tentatives / 15 min / IP) pour éviter le brute-force.

### `POST /auth/refresh`
Body : `{ "refreshToken": "..." }` → renvoie un nouveau `accessToken`.

## Garages

### `GET /garages/nearby`
Route publique (pas d'auth requise — un visiteur non connecté doit pouvoir voir les garages près de lui).

Query params : `lat`, `lng` (requis), `radiusKm` (défaut 15), `limit` (défaut 20).

Réponse `200` :
```json
{
  "results": [
    {
      "id": "...", "name": "Garage Auto Prestige", "certified": true,
      "rating": 4.6, "reviewCount": 128, "distanceKm": 1.2,
      "photos": ["https://res.cloudinary.com/..."]
    }
  ],
  "fallback": null
}
```
Si `results` est vide, remplir `fallback` avec le garage le plus proche indépendamment de `radiusKm` (voir `docs/DATABASE.md` §4) — reproduit exactement le comportement déjà implémenté côté app mobile (`GarageSosSheet.tsx`, variable `closestFallback`).

### `GET /garages/:id`
Détail complet d'un garage (description, spécialités, horaires, photos, avis récents). Correspond à l'écran "fiche garage" des maquettes.

### `POST /garages` *(protégé, rôle admin/garagiste — à ajouter plus tard)*
Créer un garage. Body : mêmes champs que le schéma `garages` (hors `id`, `rating`, `review_count`, auto-générés).

> Pas de système de rôles pour la V1 — toutes les créations de garages passent par un admin manuel (toi) en attendant un espace garagiste dédié. Prévoir un champ `role` sur `users` (`'client' | 'garage_owner' | 'admin'`) dès maintenant pour ne pas avoir à migrer plus tard.

## SOS

### `POST /sos` *(protégé)*
Body :
```json
{ "description": "La voiture ne démarre plus", "photoUrl": "https://res.cloudinary.com/...", "latitude": 4.05, "longitude": 9.7 }
```
`photoUrl` optionnel — provient d'un upload Cloudinary fait *avant* cet appel (voir `docs/STORAGE.md`).

Réponse `201` :
```json
{
  "sosRequest": { "id": "...", "status": "pending" },
  "nearbyGarages": [ /* même forme que GET /garages/nearby */ ]
}
```
Logique serveur : insérer la ligne `sos_requests`, puis exécuter immédiatement la même requête de proximité que `/garages/nearby` sur les coordonnées fournies, et renvoyer les deux dans la même réponse (évite un aller-retour réseau supplémentaire depuis l'app).

### `GET /sos/:id`
Consulter le statut d'une demande SOS (`pending` / `matched` / `resolved` / `cancelled`).

### `PATCH /sos/:id/status` *(protégé)*
Body : `{ "status": "resolved" }`. Pour l'instant appelable par l'utilisateur lui-même (annuler sa propre demande) ; deviendra une action admin/garagiste plus tard.

## Reviews

### `POST /garages/:id/reviews` *(protégé)*
Body : `{ "rating": 5, "comment": "Service impeccable" }`. `409` si l'utilisateur a déjà noté ce garage (contrainte unique en base).

### `GET /garages/:id/reviews`
Paginé (`?page=&pageSize=`), trié par `created_at DESC`.

## Uploads

### `POST /uploads/sign` *(protégé)*
Voir `docs/STORAGE.md` pour le détail — génère une signature Cloudinary à usage unique, ne stocke rien.

## Conventions transverses

- Erreurs : toujours `{ "error": { "code": "GARAGE_NOT_FOUND", "message": "..." } }`, jamais une string brute — permet à l'app mobile de traduire les messages proprement (FR déjà partout côté UI).
- Pagination : `?page=1&pageSize=20`, réponse enveloppée `{ "results": [...], "page": 1, "pageSize": 20, "total": 143 }`.
- Toutes les dates en ISO 8601 UTC.
- Validation d'entrée avec `zod` sur chaque route avant d'atteindre le controller — rejeter avec `400` et un message clair plutôt que de laisser une erreur Postgres remonter brute.

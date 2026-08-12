# Architecture GeoCras

Décisions actées. Ce document remplace `geocras-backend/docs/`, dont plusieurs choix ont
été écartés (voir la table de correspondance dans `geocras-backend/CLAUDE.md`).

---

## 1. Structure

Monorepo npm workspaces. Trois choses ne doivent **jamais** diverger entre le mobile et le
serveur : la taxonomie des pannes, la forme des réponses (surtout `rank`), et le barème de
fidélité. `packages/shared` rend la divergence impossible à compiler.

```
apps/mobile/src/
├── theme/     tokens.ts (palette, type, chamfer), ThemeProvider, useAppFonts
├── ui/        ChamferView, Text, Button, SectionLabel, Stars, GarageMarker
├── screens/   un dossier par écran
├── api/       client + hooks TanStack Query — aucun fetch ailleurs
├── realtime/  socket, useTracking, mode dégradé
├── driving/   AlertSource, SimulatedAlertSource
├── stores/    zustand : tracking, driving
└── location/  permissions, watcher, filtre EMA

apps/api/
├── migrations/           SQL pur, versionné, PostGIS natif
├── src/modules/          découpage par DOMAINE, pas par couche
│   ├── auth/  garages/  requests/  loyalty/  reviews/  driving/
│   └── (.routes .service .repo par module)
├── src/db/               client Kysely, types, geo.ts, migrate.ts
├── src/middleware/       auth, validate, error
└── src/seed/yaounde.ts

packages/shared/src/
├── contracts/   schémas zod = source unique des types d'API
├── taxonomy.ts  véhicule → pannes ordonnées
├── loyalty.ts   paliers, barème, garde-fous anti-fraude
└── geo.ts       haversine, ETA provisoire, lissage de vitesse
```

**Par domaine, pas par couche.** Ajouter le niveau d'urgence au SOS touche
`modules/requests/` seul, au lieu de quatre dossiers.

### Kysely plutôt que Prisma

Le pattern documenté dans l'ancien dossier — Prisma + `Unsupported()` + migrations
générées puis éditées à la main — abandonnait la type-safety sur toute la moitié
géospatiale, c'est-à-dire sur le cœur du produit.

| | Prisma + `Unsupported()` | Kysely |
|---|---|---|
| Requête géo | `$queryRaw`, retour **non typé** | fragment `sql\`\``, résultat **typé** |
| Migrations | générées puis **éditées à la main** | fichiers `.sql` écrits directement |
| Dérive de schéma | invisible | erreur de compilation |

Le type `GeographyPoint` (`src/db/types.ts`) est volontairement hostile : en écriture il
n'accepte qu'un fragment SQL, donc on passe forcément par `pointFromLatLng()` ; en lecture
il rend une chaîne WKB inexploitable, ce qui force à projeter `ST_Y`/`ST_X` explicitement.

---

## 2. Données

Tables : `users`, `vehicles`, `garages`, `assistance_requests`, `request_events`,
`position_pings`, `reviews`, `loyalty_ledger`, `badges`/`user_badges`,
`driving_sessions`/`driving_alerts`, `refresh_tokens`.

### Les règles métier sont des contraintes SQL

Une vérification applicative s'oublie au prochain endpoint. Une contrainte tient même
quand le code se trompe.

| Contrainte | Ce qu'elle garantit |
|---|---|
| `closed_requires_both_arrivals` | une demande ne peut pas être clôturée sans les **deux** confirmations d'arrivée — donc aucun point ne peut être crédité sans elles |
| `reviews.request_id UNIQUE` | un avis exige une intervention réellement clôturée ; et un client qui revient trois fois note trois fois |
| `loyalty_ledger.idempotency_key UNIQUE` | une requête rejouée ne crédite jamais deux fois |
| `vehicles_single_default_idx` | un seul véhicule par défaut, y compris en écriture concurrente |
| `requests_one_active_per_client_idx` | pas dix SOS ouverts en parallèle |

### Index

```sql
CREATE INDEX garages_location_idx ON garages USING GIST (location);
CREATE INDEX garages_certified_location_idx ON garages USING GIST (location)
  WHERE is_active AND certified;          -- partiel, pour le tri « certifié »
CREATE INDEX garages_services_idx ON garages USING GIN (services);
```

### La requête de pertinence

Deux invariants, dans cet ordre :

**a. `ST_DWithin` filtre avant le tri.** C'est ce qui consomme l'index GIST. Un
`ORDER BY ST_Distance(...)` sans filtre préalable parcourt la table entière.

**b. `ROW_NUMBER()` calcule le rang en SQL.** Le mobile l'affiche sans jamais le recalculer.

```sql
ROW_NUMBER() OVER (ORDER BY
  CASE WHEN $sort = 'certified' THEN NOT certified END ASC,
  CASE WHEN $sort = 'rating'    THEN score_note     END DESC,
  distance_m ASC,
  id ASC
)
```

Dans la branche inactive, l'expression vaut `NULL` pour *toutes* les lignes : elle ne
discrimine rien et le tri retombe sur la clé suivante. Un seul plan couvre les trois tris,
sans concaténer de SQL — donc sans surface d'injection.

`score_note` est une **note bayésienne** : un 5,0 avec deux avis complaisants ne doit pas
devancer un 4,6 avec 128 avis.

```
(n / (n + 20)) × note  +  (20 / (n + 20)) × 3,8
```

**Repli.** Si le rayon ne rend rien, on remonte le garage le plus proche dans `fallback`
avec `meta.widened = true`. Au bord de la route, un écran vide est un échec produit.

---

## 3. API

Erreurs `{ error: { code, message, fields? } }` — le mobile traduit sur le **code**.
Pagination enveloppée. Dates ISO 8601 UTC. Validation zod sur chaque entrée.

| Méthode | Route | Notes |
|---|---|---|
| POST | `/auth/signup` · `/login` · `/refresh` · `/logout` | rotation du refresh, jeton opaque haché en base |
| GET | `/garages/nearby` | **public** · `lat,lng,radiusKm,sort,services,openNow,limit` |
| GET | `/garages/:id` · `/:id/reviews` | |
| POST | `/requests` | crée + renvoie les garages classés en **un seul aller-retour** |
| POST | `/requests/:id/select` · `/accept` · `/en-route` | |
| POST | `/requests/:id/arrive` | **les deux parties**, idempotent |
| POST | `/requests/:id/cancel` | |
| GET | `/requests/:id` | état complet + `lastSeq` — route du **mode dégradé** |
| POST | `/requests/:id/review` | clé sur la demande · `403` si non clôturée |
| GET | `/me/loyalty` · POST `/me/referral/claim` | |
| POST | `/driving/sessions` | envoi **groupé en fin de session**, tolérant au hors-ligne |
| POST | `/uploads/sign` | signature Cloudinary avec `upload_preset` contraint |

---

## 4. État mobile

La **fréquence de changement** dicte l'outil.

| Nature | Outil | Pourquoi |
|---|---|---|
| Cache serveur | TanStack Query | retry, `staleTime`, persistance hors-ligne — décisif sur réseau irrégulier |
| Session & tokens | Context + `expo-secure-store` | petit, rare, doit survivre au redémarrage |
| **Suivi temps réel** | Zustand | change 3–5 ×/s ; dans Query, on invaliderait le cache en boucle |
| **Mode conduite** | Zustand + moteur hors React | l'`AlertSource` est un émetteur pur ; lecture par sélecteurs |
| Préférences | Context + AsyncStorage | lu partout, change une fois par mois |

Deux règles fermes : aucune position temps réel dans TanStack Query ; le thème en Context.

---

## 5. Temps réel

**Socket.io.** Le polling à 15 s rend un véhicule en mouvement inutilisable. Le SSE est
unidirectionnel, or le client doit *émettre* sa position. Le WebSocket brut obligerait à
réécrire la reconnexion et perdrait le repli long-polling — précisément ce qui sauve une
session sur un réseau 3G qui coupe.

1. **Room par `requestId`**, rejointe après vérification JWT *et* contrôle d'appartenance.
2. **L'ETA est calculé par le serveur.** Les deux parties doivent voir le même chiffre, et
   cet ETA alimente la détection de fraude.
3. **Émission throttlée à 4 s + seuil de 15 m.** Un ping ≈ 120 octets ; 20 min
   d'intervention ≈ 36 Ko. Les forfaits data se comptent.
4. **Lissage EMA** (α = 0,3) et rejet des sauts impliquant plus de 150 km/h.
5. **Rattrapage** : à la reconnexion, le client envoie son `lastSeq`, le serveur rejoue les
   `request_events` manquants.
6. **Mode dégradé** : socket mort → polling 15 s + bandeau. Le compteur « MAJ 3s » affiche
   `Date.now() − lastPacketAt`, la fraîcheur **réelle**.

---

## 6. Cartographie

**MapLibre GL + MapTiler.**

Le critère décisif est la stylisation. Google Maps n'expose son style JSON que sur Android
via `expo-maps`, et Apple Maps ne se style quasiment pas : l'app ne ressemblerait pas à la
même app sur iOS, ce qui est inacceptable pour une identité déclarée non négociable.
MapLibre rend un style vectoriel **identique au pixel** sur les deux plateformes.

Sur la donnée routière, OSM — socle de MapTiler comme de Mapbox — est compétitif à Yaoundé
grâce à la cartographie humanitaire, et **meilleur sur les voies non bitumées**. Google ne
garde l'avantage que sur les POI commerciaux, ce que GeoCras apporte lui-même.

Coût : MapTiler facture à l'**usage** (100 k chargements/mois gratuits), Mapbox au **MAU**.
Porte de sortie : PMTiles auto-hébergé, un changement d'URL.

`expo-maps` est en **alpha** en SDK 54 — écarté.

**Itinéraire : OSRM auto-hébergé** sur l'extrait OSM Cameroun. Le deep link sortant de
l'ancien dossier est incompatible avec le produit — il sort l'utilisateur de l'app, donc
plus de suivi, donc plus de double confirmation, donc plus de preuve anti-fraude.
En attendant, l'ETA est approximé (`shared/geo.ts`) et **marqué comme provisoire**.

---

## 7. Ordre de construction

**L'ossature complète est en place.** Ce qui reste est l'habillage des écrans à
partir des maquettes — la plomberie sous chacun est écrite et testée.

| # | Phase | Validation | État |
|---|---|---|---|
| 0a | **Spike MapLibre** — dev build, carte stylée, iOS + Android | bloquant | **à faire en premier** |
| 0b | Monorepo, `shared`, thème, primitives, écran de démo | revue visuelle deux thèmes | fait |
| 1 | Migrations, seed Yaoundé, requête `nearby` | `EXPLAIN` montre l'Index Scan GIST | fait — 19 tests en attente de base |
| 2 | Auth + routes garages | tests d'intégration HTTP | fait |
| 3 | Splash (GPS réel), navigation, écran Carte | sur appareil | plomberie faite, **rendu carte à faire** |
| 4 | Flux SOS → résultats | changer de tri renumérote les marqueurs | API faite, **écrans à faire** |
| 5 | Fiche garage + lecture des avis | | API faite, **écrans à faire** |
| 6 | Rôle garagiste : 3ᵉ onglet, accepter / en route / arrivé | deux comptes, deux appareils | API + onglet faits, **écran à faire** |
| 7 | Temps réel, double ETA, mode dégradé | couper le socket en pleine session | fait de bout en bout, **à éprouver sur appareil** |
| 8 | Double confirmation → crédit fidélité | double confirmation ne crédite qu'une fois | fait — contrainte SQL + ledger idempotent |
| 9 | Publication d'avis verrouillée | bouton désactivé avec explication | API faite, **écran à faire** |
| 10 | Mode conduite + `SimulatedAlertSource` | courbe de vitesse plausible | moteur fait et testé, **écran à faire** |
| 11 | Profil, drawer, paramètres, i18n | | drawer + i18n faits, **écrans à faire** |
| 12 | Push + deep links | notification ouvre le bon écran | routes prêtes, **branchement à faire** |
| 13 | Écran Sécurité | à soumettre avant codage | à faire |

---

## 8. Les trois risques

### Risque 1 — La chaîne de confiance de la fidélité *(le plus grave)*

Les points deviennent du Mobile Money : ce sont des espèces. La double confirmation prouve
que deux personnes se sont mises d'accord — pas qu'une intervention a eu lieu. **Deux
comptes complices se confirment mutuellement** et le système imprime de l'argent.

Traitement, par ordre d'efficacité :
- **Preuve de mouvement** : `position_pings` doit montrer deux parties initialement
  éloignées puis convergentes. C'est ce qui casse la collusion statique.
- **Crédit différé** 24 h en `pending` — fenêtre de reversal.
- **Plafonds** par paire (client, garage) et par mois.
- **Garages certifiés uniquement** pour les paliers convertibles.
- **`idempotency_key`** sur le ledger.
- **Conversion Mobile Money jamais automatique en v1.**

Seuils dans `ANTI_FRAUD` (`packages/shared/src/loyalty.ts`). Posés dès le schéma, ils ne
coûtent rien ; rétro-installés, ils coûtent une migration et un audit comptable.

### Risque 2 — GPS et réseau au Cameroun

20–50 m de précision en centre-ville, réseau 2G/3G intermittent. Symptômes : ETA qui
saute, positions qui téléportent, badge « ±5m » qui ment.

Traitement : filtre EMA + rejet des sauts implausibles (`shared/geo.ts`) ; **afficher la
précision réelle** issue de `coords.accuracy` ; file de requêtes avec retry ; sessions de
conduite stockées localement puis synchronisées ; mode dégradé conçu dès le départ.
Et tester sur un **Android milieu de gamme en 3G réelle** — l'émulateur ne montrera rien.

### Risque 3 — MapLibre + New Architecture sur Expo 54

`app.json` active `newArchEnabled: true`. Le plugin Expo de MapLibre existe, mais son
support New Architecture n'est **pas confirmé**. C'est le risque le plus susceptible de
coûter une semaine, et il est sous tout le reste.

Traitement : **phase 0a, avant tout écran.** Si ça casse, deux issues connues dès le
premier jour : `newArchEnabled: false` (SDK 54 est la dernière version à le permettre —
donc dette datée), ou repli sur `react-native-maps` en acceptant le compromis iOS.

S'y ajoute la performance des marqueurs : 20 écussons en vues React se re-rendent à chaque
mouvement de caméra. Passer par un `ShapeSource` + `SymbolLayer` MapLibre avec le `rank` en
champ de données. Budget : 60 fps au pan/zoom avec 20 marqueurs sur Android milieu de gamme.

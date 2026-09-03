# Architecture

Ce document explique comment le projet est construit et pourquoi. Ce sont des décisions
prises, pas des pistes ouvertes : si on veut en changer une, il faut une raison, pas une
préférence.

## Le découpage

Le monorepo tient en trois workspaces.

```
apps/mobile/src/
  theme/      tokens.ts (palette, typo, chamfer), ThemeProvider, useAppFonts
  ui/         ChamferView, Text, Button, SectionLabel, Stars, GarageMarker
  screens/    un dossier par écran
  api/        client et hooks TanStack Query, aucun fetch ailleurs
  realtime/   socket, useTracking, mode dégradé
  driving/    AlertSource, SimulatedAlertSource
  stores/     zustand : tracking, driving
  location/   permissions, watcher, filtre EMA

apps/api/
  migrations/     SQL pur, versionné, PostGIS natif
  src/modules/    auth, garages, requests, loyalty, reviews, driving
  src/db/         client Kysely, types, geo.ts, migrate.ts
  src/middleware/ auth, validate, error
  src/seed/       yaounde.ts

packages/shared/src/
  contracts/    schémas zod, source unique des types d'API
  taxonomy.ts   véhicule vers pannes ordonnées
  loyalty.ts    paliers, barème, garde-fous anti-fraude
  geo.ts        haversine, ETA provisoire, lissage de vitesse
```

Le serveur est découpé par domaine et non par couche. Concrètement, ajouter un niveau
d'urgence au SOS se fait dans `modules/requests/` et nulle part ailleurs, là où un
découpage en controllers / services / repos aurait fait toucher quatre dossiers pour un
seul champ.

## Kysely plutôt que Prisma

La moitié du produit est géospatiale, et Prisma ne sait pas typer PostGIS. Le pattern
habituel consiste à déclarer les colonnes en `Unsupported()`, à passer par `$queryRaw`
pour tout ce qui touche à la géométrie, et à éditer à la main les migrations générées.
Ça revient à abandonner la type-safety exactement là où elle sert le plus.

Avec Kysely, une requête géo s'écrit dans un template `sql` tagué dont le résultat
reste typé, les migrations sont des fichiers `.sql` qu'on écrit directement, et une dérive
entre le schéma et le code devient une erreur de compilation au lieu d'une surprise à
l'exécution.

Le type `GeographyPoint` dans `src/db/types.ts` est volontairement pénible à utiliser.
En écriture il n'accepte qu'un fragment SQL, ce qui oblige à passer par
`pointFromLatLng()`. En lecture il rend une chaîne WKB inexploitable, ce qui oblige à
projeter `ST_Y` et `ST_X` explicitement. Dans les deux cas on ne peut pas se tromper
par distraction.

## Les données

Les tables : `users`, `vehicles`, `garages`, `assistance_requests`, `request_events`,
`position_pings`, `reviews`, `loyalty_ledger`, `badges` et `user_badges`,
`driving_sessions` et `driving_alerts`, `refresh_tokens`.

Les règles métier importantes sont des contraintes SQL plutôt que des vérifications dans
le code. Une vérification applicative s'oublie au prochain endpoint qu'on écrit ; une
contrainte tient même quand le code se trompe.

`closed_requires_both_arrivals` interdit de clôturer une demande sans les deux
confirmations d'arrivée, ce qui rend structurellement impossible de créditer des points
sans elles. `reviews.request_id UNIQUE` fait qu'un avis suppose une intervention
réellement terminée, tout en laissant un client qui revient trois fois noter trois fois.
`loyalty_ledger.idempotency_key UNIQUE` empêche une requête rejouée de créditer deux
fois. `vehicles_single_default_idx` garantit un seul véhicule par défaut, y compris en
écriture concurrente. `requests_one_active_per_client_idx` évite les dix SOS ouverts en
parallèle.

Côté index :

```sql
CREATE INDEX garages_location_idx ON garages USING GIST (location);
CREATE INDEX garages_certified_location_idx ON garages USING GIST (location)
  WHERE is_active AND certified;          -- partiel, pour le tri « certifié »
CREATE INDEX garages_services_idx ON garages USING GIN (services);
```

## La requête de pertinence

C'est la requête centrale du produit, celle qui remplit l'écran carte. Deux choses
comptent, dans cet ordre.

D'abord `ST_DWithin` filtre avant qu'on trie. C'est ce qui fait consommer l'index GIST.
Un `ORDER BY ST_Distance(...)` sans filtre préalable parcourt la table entière, et ça ne
se voit pas tant que la base est petite.

Ensuite le rang se calcule en SQL, avec `ROW_NUMBER()`. Le mobile l'affiche tel quel et
ne le recalcule jamais.

```sql
ROW_NUMBER() OVER (ORDER BY
  CASE WHEN $sort = 'certified' THEN NOT certified END ASC,
  CASE WHEN $sort = 'rating'    THEN score_note     END DESC,
  distance_m ASC,
  id ASC
)
```

L'astuce des `CASE` tient au fait que dans une branche inactive l'expression vaut `NULL`
pour toutes les lignes : elle ne discrimine rien et le tri retombe sur la clé suivante.
Un seul plan couvre donc les trois tris, sans concaténer de SQL, donc sans surface
d'injection.

`score_note` est une note bayésienne, pas une moyenne. Un 5,0 obtenu sur deux avis
complaisants ne doit pas passer devant un 4,6 obtenu sur cent vingt-huit.

```
(n / (n + 20)) × note  +  (20 / (n + 20)) × 3,8
```

Enfin, si le rayon ne rend rien, la réponse remonte quand même le garage le plus proche
dans `fallback` avec `meta.widened = true`. Quelqu'un en panne au bord de la route à qui
on affiche une liste vide n'a rien à faire de la rigueur du rayon de recherche.

## L'API

Les erreurs ont toujours la forme `{ error: { code, message, fields? } }` et le mobile
traduit sur le code, jamais sur le message. La pagination est enveloppée, les dates sont
en ISO 8601 UTC, et chaque entrée passe par un schéma zod avant d'atteindre le controller.

| Méthode | Route | Notes |
|---|---|---|
| POST | `/auth/signup` · `/login` · `/refresh` · `/logout` | rotation du refresh, jeton opaque haché en base |
| GET | `/garages/nearby` | public · `lat,lng,radiusKm,sort,services,openNow,limit` |
| GET | `/garages/:id` · `/:id/reviews` | |
| POST | `/requests` | crée la demande et renvoie les garages classés en un seul aller-retour |
| POST | `/requests/:id/select` · `/accept` · `/en-route` | |
| POST | `/requests/:id/arrive` | appelé par les deux parties, idempotent |
| POST | `/requests/:id/cancel` | |
| GET | `/requests/:id` | état complet et `lastSeq`, c'est la route du mode dégradé |
| POST | `/requests/:id/review` | clé sur la demande, 403 si elle n'est pas clôturée |
| GET | `/me/loyalty` · POST `/me/referral/claim` | |
| POST | `/driving/sessions` | envoi groupé en fin de session, tolérant au hors-ligne |
| POST | `/uploads/sign` | signature Cloudinary avec `upload_preset` contraint |

## L'état côté mobile

Ce qui décide de l'outil, c'est la fréquence à laquelle la donnée change.

Le cache serveur passe par TanStack Query, pour le retry, le `staleTime` et la
persistance hors-ligne, qui font toute la différence sur un réseau irrégulier. La session
et les tokens vivent dans un Context adossé à `expo-secure-store` : c'est petit, ça change
rarement, et ça doit survivre au redémarrage. Les préférences suivent le même schéma avec
AsyncStorage.

Le suivi temps réel est dans Zustand, parce qu'il change trois à cinq fois par seconde et
que le mettre dans Query reviendrait à invalider le cache en boucle. Le mode conduite
aussi, avec le moteur d'alertes en dehors de React : l'`AlertSource` est un émetteur pur,
et les écrans lisent par sélecteurs.

Deux règles fermes en découlent : aucune position temps réel dans TanStack Query, et le
thème reste dans un Context.

## Le temps réel

C'est Socket.io. Le polling à quinze secondes rend un véhicule en mouvement inutilisable.
Le SSE est unidirectionnel alors que le client doit émettre sa position. Et le WebSocket
brut obligerait à réécrire toute la reconnexion tout en perdant le repli long-polling,
qui est précisément ce qui sauve une session sur une 3G qui coupe.

Le fonctionnement tient en quelques points. Une room par `requestId`, rejointe après
vérification du JWT et contrôle d'appartenance. L'ETA est calculé par le serveur, parce
que les deux parties doivent voir le même chiffre et que cet ETA alimente la détection de
fraude. L'émission est throttlée à quatre secondes avec un seuil de quinze mètres : un
ping fait environ cent vingt octets, une intervention de vingt minutes revient donc à une
trentaine de kilooctets, et au Cameroun les forfaits data se comptent. Les positions
passent par un lissage EMA à α = 0,3, avec rejet des sauts qui impliqueraient plus de
150 km/h.

À la reconnexion, le client renvoie son `lastSeq` et le serveur rejoue les
`request_events` manquants. Si le socket meurt pour de bon, on bascule sur du polling à
quinze secondes avec un bandeau qui le dit. Le compteur « MAJ 3s » affiche
`Date.now() − lastPacketAt`, c'est-à-dire la fraîcheur réelle de la donnée et pas une
animation décorative.

## La carte

MapLibre GL avec les tuiles MapTiler.

Le critère qui a tranché, c'est la stylisation. Google Maps n'expose son style JSON que
sur Android via `expo-maps`, et Apple Maps ne se style pratiquement pas. On se retrouverait
avec deux apps qui ne se ressemblent pas selon la plateforme, ce qui est intenable quand
l'identité visuelle est le principal facteur de différenciation. MapLibre rend le même
style vectoriel au pixel près des deux côtés.

Sur la donnée routière, OSM, qui est le socle de MapTiler comme de Mapbox, tient très bien
à Yaoundé grâce au travail de cartographie humanitaire, et il est meilleur que Google sur
les voies non bitumées. Google ne garde l'avantage que sur les POI commerciaux, c'est-à-dire
exactement la donnée que GeoCras apporte lui-même.

Sur le coût, MapTiler facture à l'usage avec cent mille chargements gratuits par mois, là
où Mapbox facture au MAU. Si ça devient cher, la porte de sortie est un PMTiles
auto-hébergé, ce qui ne change qu'une URL. Quant à `expo-maps`, il est encore en alpha en
SDK 54, donc écarté.

Pour l'itinéraire, la cible est un OSRM auto-hébergé sur l'extrait OSM du Cameroun. Un
deep link vers Google Maps aurait été plus simple mais est incompatible avec le produit :
il sort l'utilisateur de l'app, donc plus de suivi, donc plus de double confirmation, donc
plus de preuve anti-fraude. En attendant OSRM, l'ETA est approximé dans `shared/geo.ts` et
marqué comme provisoire dans l'interface.

## Où en est la construction

L'application est écrite de bout en bout. Ce qui reste ne tient plus à des écrans
manquants mais à ce qui ne se vérifie que sur un appareil, et à trois branchements
en attente.

| # | Phase | Validation | État |
|---|---|---|---|
| 0a | Spike MapLibre : dev build, carte stylée, iOS et Android | bloquant | à faire en premier |
| 0b | Monorepo, `shared`, thème, primitives, écran de démo | revue visuelle deux thèmes | fait |
| 1 | Migrations, seed Yaoundé, requête `nearby` | `EXPLAIN` montre l'Index Scan GIST | fait, 19 tests en attente de base |
| 2 | Auth et routes garages | tests d'intégration HTTP | fait |
| 3 | Splash avec GPS réel, navigation, écran Carte | sur appareil | fait, rendu carte à éprouver sur appareil |
| 4 | Flux SOS vers résultats | changer de tri renumérote les marqueurs | fait |
| 5 | Fiche garage et lecture des avis | | fait |
| 6 | Rôle garagiste : 3ᵉ onglet, accepter / refuser / en route / arrivé | deux comptes, deux appareils | fait |
| 7 | Temps réel, double ETA, mode dégradé | couper le socket en pleine session | fait de bout en bout, à éprouver sur appareil |
| 8 | Double confirmation et crédit fidélité | une double confirmation ne crédite qu'une fois | fait, contrainte SQL et ledger idempotent |
| 9 | Publication d'avis verrouillée | bouton désactivé avec explication | fait |
| 10 | Mode conduite et `SimulatedAlertSource` | courbe de vitesse plausible | fait |
| 11 | Profil, tiroir, paramètres, véhicules, i18n | | fait |
| 12 | Push et deep links | la notification ouvre le bon écran | routes prêtes, branchement à faire |
| 13 | Écran Sécurité | à cadrer avant codage | à faire |

## Ce qui peut mal tourner

### La chaîne de confiance de la fidélité

C'est le risque le plus sérieux, parce que les points ont vocation à devenir du Mobile
Money, donc des espèces. La double confirmation prouve que deux personnes se sont mises
d'accord, pas qu'une intervention a eu lieu. Deux comptes complices qui se confirment
mutuellement suffisent à faire imprimer de l'argent au système.

Le traitement, par ordre d'efficacité décroissante. La preuve de mouvement d'abord :
`position_pings` doit montrer deux parties d'abord éloignées puis convergentes, ce qui
casse la collusion statique, celle qui ne coûte rien à monter. Ensuite un crédit différé
de 24 h en `pending`, qui laisse une fenêtre de reversal. Puis des plafonds par paire
client-garage et par mois, la restriction des paliers convertibles aux garages certifiés,
et l'`idempotency_key` sur le ledger. Et en v1, la conversion en Mobile Money n'est jamais
automatique.

Les seuils sont dans `ANTI_FRAUD`, dans `packages/shared/src/loyalty.ts`. Posés dès le
schéma ils ne coûtent rien ; rétro-installés ils coûtent une migration et un audit
comptable.

### Le GPS et le réseau

On est entre vingt et cinquante mètres de précision en centre-ville, sur un réseau 2G/3G
intermittent. Ça se traduit par des ETA qui sautent, des positions qui téléportent et un
badge « ±5m » qui ment.

Ce qui est en place ou à tenir : le filtre EMA et le rejet des sauts implausibles dans
`shared/geo.ts`, l'affichage de la précision réelle issue de `coords.accuracy` plutôt
qu'une valeur rassurante, une file de requêtes avec retry, les sessions de conduite
stockées localement puis synchronisées, et le mode dégradé pensé dès le départ plutôt
qu'ajouté après coup. Il faudra aussi tester sur un Android milieu de gamme en 3G réelle,
parce que l'émulateur ne montrera rien de tout ça.

### MapLibre sur la New Architecture

`app.json` active `newArchEnabled: true`. Le plugin Expo de MapLibre existe, mais son
support de la New Architecture n'est pas confirmé. C'est le risque le plus susceptible de
coûter une semaine entière, et il est sous tout le reste, d'où la phase 0a avant le moindre
écran. Les deux issues sont connues d'avance : repasser `newArchEnabled` à `false`, ce que
le SDK 54 autorise encore et les suivants non, ou se replier sur `react-native-maps` en
acceptant le compromis sur iOS.

Il y a un second volet à ce risque, la performance des marqueurs. Vingt écussons rendus en
vues React se re-rendent à chaque mouvement de caméra. La parade est de passer par un
`ShapeSource` et un `SymbolLayer` MapLibre avec le `rank` en champ de données. Le budget
à tenir est de soixante images par seconde au pan et au zoom, avec vingt marqueurs, sur un
Android milieu de gamme.

## Le cahier des charges

Le dossier complet — analyse des besoins, critique de l'existant, modélisation UML,
schéma de base de données, justification des choix techniques et état des résultats —
est dans [`docs/cahier-des-charges/`](docs/cahier-des-charges/), en DOCX et en PDF.
Il se régénère depuis ses sources avec `python3 make.py`.

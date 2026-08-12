# ⚠ Dossier historique — ne pas suivre ces décisions

Ce dossier ne contient **aucun code** : ce sont les notes techniques d'un travail
antérieur. Il est conservé pour mémoire, pas comme référence.

Plusieurs de ses décisions ont été **remplacées** après revue :

| Sujet | Ce dossier disait | Décision retenue |
|---|---|---|
| Temps réel | hors périmètre | Socket.io, room par demande |
| Itinéraire | deep link vers Google Maps | tracé dans l'app (OSRM prévu) |
| ORM | Prisma + `Unsupported()` + migrations éditées à la main | Kysely + migrations SQL |
| Ville | Douala | **Yaoundé** |
| Avis | `UNIQUE (garage_id, user_id)` | clé sur la demande clôturée |

Ce qui reste valable a été repris dans le code : PostgreSQL + PostGIS,
`GEOGRAPHY(POINT, 4326)`, `ST_DWithin` avant tout tri, upload Cloudinary signé
direct, MapLibre + MapTiler.

**Référence à jour : [`../ARCHITECTURE.md`](../ARCHITECTURE.md).**

Aucun `@import` ici : ce fichier ne doit pas injecter la pile contradictoire
(MongoDB, react-native-maps, deep link) dans le contexte des sessions.

# Cartographie — recommandation technique

Ce document couvre la techno de carte côté **application mobile** (pas ce backend directement), mais elle est documentée ici car elle forme un couple indissociable avec PostGIS : PostGIS trouve les garages, la carte les affiche.

## Décision : MapLibre GL + MapTiler Cloud

| Ancien prototype (`geocras/`) | Nouveau projet |
|---|---|
| `@maplibre/maplibre-react-native` | **Inchangé** — déjà validé, fonctionne, pas de raison de changer de SDK |
| Tuiles brutes `tile.openstreetmap.org` | **MapTiler Cloud** (tuiles vectorielles + géocodage) |

### Pourquoi garder MapLibre

MapLibre GL est déjà intégré et fonctionnel dans le prototype existant (rendu, marqueurs, caméra, geste de rotation/zoom, `UserLocation`). Aucune raison de changer de SDK — le seul problème du prototype était la **source de tuiles**, pas le moteur de rendu.

### Pourquoi remplacer les tuiles OSM brutes

`https://tile.openstreetmap.org/{z}/{x}/{y}.png` est un service **communautaire, gratuit, mais explicitement interdit en usage commercial/production** par la [politique d'usage OSM](https://operations.osmfoundation.org/policies/tiles/) : pas de garantie de disponibilité, risque de bannissement d'IP en cas de trafic soutenu, aucun SLA. Utilisable pour prototyper (ce qui a été fait), pas pour lancer un vrai produit.

### Pourquoi MapTiler spécifiquement

- Tuiles **vectorielles** (plus nettes, plus légères, style personnalisable en JSON) plutôt que raster.
- Compatible nativement avec MapLibre — juste une URL de style à passer en `mapStyle` :
  ```ts
  const OSM_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`;
  ```
  Remplace directement l'objet `StyleSpecification` fait à la main dans le prototype — aucun changement de code MapLibre nécessaire au-delà de cette ligne.
- Tier gratuit généreux (100 000 chargements de tuiles/mois), facturation à l'usage au-delà — prévisible, pas de mauvaise surprise.
- Inclut une **API de géocodage** (recherche d'adresse, utile pour la barre de recherche "Comment pouvons-nous vous aider ?" si elle doit un jour chercher une adresse plutôt qu'un service).
- Maintenu par des contributeurs directement impliqués dans MapLibre — compatibilité garantie dans la durée.

### Alternative si le coût des tuiles devient un sujet à grande échelle

Auto-héberger des tuiles **PMTiles** (projet [Protomaps](https://protomaps.com/)) : un unique fichier statique contenant toutes les tuiles pour une zone géographique (ex: Cameroun uniquement, quelques centaines de Mo), hébergé sur n'importe quel stockage objet (Cloudflare R2 a un tier gratuit avec zéro coût de sortie réseau). MapLibre supporte nativement le protocole `pmtiles://`. Zéro coût récurrent, zéro dépendance à un service tiers — mais demande de régénérer le fichier périodiquement pour les mises à jour de carte. À évaluer seulement si le volume d'utilisateurs justifie l'effort d'infra ; **ne pas commencer par cette option**, MapTiler suffit largement pour un MVP et au-delà.

## Géocodage (recherche d'adresse)

Si la barre de recherche doit un jour permettre de taper une adresse (pas seulement une catégorie de panne) : utiliser l'API de géocodage MapTiler (même clé API que les tuiles, un seul fournisseur à gérer). Ne pas appeler Nominatim (le géocodeur gratuit d'OSM) en production pour la même raison que les tuiles brutes — usage limité, non garanti en prod.

## Itinéraire / navigation ("Itinéraire" dans les maquettes)

**Ne pas construire de moteur de routing en interne pour la V1.** Déléguer à l'application de navigation déjà installée sur le téléphone de l'utilisateur via un deep link — c'est déjà l'approche implémentée dans le prototype (`GarageSosSheet.tsx`, fonction `handleDirections`) :

```ts
const url = Platform.select({
  ios: `maps:0,0?q=${garage.latitude},${garage.longitude}`,
  android: `geo:0,0?q=${garage.latitude},${garage.longitude}(${encodeURIComponent(garage.name)})`,
});
Linking.openURL(url);
```

Avantages : zéro coût, zéro infra à maintenir, l'utilisateur reste dans une app de navigation qu'il connaît déjà (Google Maps/Plans/Waze). À réévaluer seulement si le produit a un besoin fort de navigation **turn-by-turn intégrée** (ex: suivi en temps réel d'une dépanneuse envoyée) — dans ce cas, [OSRM](http://project-osrm.org/) auto-hébergé (gratuit, open-source, basé sur les données OSM) serait la prochaine étape, pas avant.

## Résumé des clés API à provisionner

| Service | Utilisé par | Variable d'env |
|---|---|---|
| MapTiler | App mobile (directement, pas via ce backend) | `MAPTILER_API_KEY` côté app (ou `EXPO_PUBLIC_MAPTILER_API_KEY`) |
| Cloudinary | Backend (signature) + App mobile (upload direct) | voir `docs/STORAGE.md` |

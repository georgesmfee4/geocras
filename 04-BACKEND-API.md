# PROMPT 4 — Backend & API

> Joindre : aucune maquette. Peut être fait en parallèle du mobile.

---

Implémente le serveur GeoCras en repartant de `geocras-backend`, selon l'architecture validée.

## Collections

- **users** — identité, téléphone (login principal au Cameroun), véhicules,
  points de fidélité, badges, préférences
- **garages** — nom, position GeoJSON, `certified`, services (dont remorquage),
  horaires, photos, téléphone, note agrégée, nombre d'avis
- **requests** — une demande SOS : client, position, type de véhicule, nature de la panne,
  description, garage retenu, statut, horodatages (créée / acceptée / en route / arrivée / clôturée)
- **reviews** — auteur, garage, note 1–5, commentaire, lien vers la `request`
- **drivingSessions** — début, fin, distance, vitesse max et moyenne, alertes, score

## Points durs à traiter sérieusement

1. **Index géospatial**
   ```js
   garageSchema.index({ location: '2dsphere' })
   ```
   La recherche utilise `$geoNear` pour obtenir la distance réelle, puis applique le tri
   demandé. **La numérotation des marqueurs (1, 2, 3…) est calculée côté serveur** et
   renvoyée dans la réponse : le client ne doit jamais recalculer un classement.

2. **Endpoint de recherche**
   ```
   POST /api/requests/search
   { lat, lng, vehicleType, problemType, sort: 'distance'|'rating'|'certified' }
   → [{ rank, garage, distanceM, etaMin, certified, rating, reviewCount }]
   ```

3. **Anti-fraude fidélité** — les points ne sont crédités que lorsque **les deux parties**
   ont confirmé l'arrivée et que la demande est clôturée. Un avis ne peut être publié que
   par un utilisateur ayant une `request` clôturée avec ce garage.

4. **Validation** de toutes les entrées (zod ou joi), et gestion d'erreurs homogène.

5. **Seed** : un script qui insère une trentaine de garages réalistes autour de Douala
   (Akwa, Bonanjo, Deïdo, Bonapriso), dont une moitié certifiés, avec des notes variées.
   Indispensable pour développer l'écran carte.

Écris les tests des requêtes géospatiales — c'est le cœur du produit.

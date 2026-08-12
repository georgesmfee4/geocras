# Base de données — PostgreSQL + PostGIS sur Neon

## 1. Setup Neon

1. Créer un compte sur [neon.tech](https://neon.tech), créer un projet `geocras`.
2. Neon crée une branche `main` par défaut. Créer une branche `dev` pour le développement local (Neon > Branches > Create branch), et garder `main` pour la production uniquement.
3. Récupérer la chaîne de connexion (`postgresql://...`) de la branche `dev` → variable d'environnement `DATABASE_URL`.
4. Se connecter (via `psql`, l'éditeur SQL intégré de Neon, ou un client comme TablePlus) et activer PostGIS :
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   Neon supporte PostGIS nativement, pas de configuration supplémentaire nécessaire.

## 2. Schéma

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  vehicle_type TEXT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  phone TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address_label TEXT,               -- ex: "Akwa, Douala" — affiché tel quel, pas de reverse-geocoding nécessaire
  certified BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  specialties TEXT[] NOT NULL DEFAULT '{}',   -- ex: {'Moteur','Électronique','Carrosserie'}
  photos TEXT[] NOT NULL DEFAULT '{}',        -- URLs Cloudinary
  opening_hours JSONB,               -- ex: {"mon": "08:00-19:00", ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index géospatial : indispensable, sans lui ST_DWithin scanne toute la table.
CREATE INDEX garages_location_idx ON garages USING GIST (location);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (garage_id, user_id)   -- un seul avis par utilisateur par garage
);

CREATE TABLE sos_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  photo_url TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sos_requests_location_idx ON sos_requests USING GIST (location);
```

`GEOGRAPHY(POINT, 4326)` (et non `GEOMETRY`) : calcule les distances en tenant compte de la courbure terrestre — le résultat de `ST_Distance` est directement en **mètres**, pas besoin de conversion manuelle.

Trigger optionnel pour maintenir `rating`/`review_count` à jour automatiquement à chaque insert dans `reviews` (évite un recalcul à chaque lecture) :
```sql
CREATE OR REPLACE FUNCTION update_garage_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE garages SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE garage_id = NEW.garage_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE garage_id = NEW.garage_id)
  WHERE id = NEW.garage_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_garage_rating
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_garage_rating();
```

## 3. Pattern hybride Prisma + SQL brut

**Important** : Prisma n'a pas de support natif propre pour les types PostGIS (`geography`/`geometry`). Ne pas essayer de forcer Prisma à gérer les colonnes géo — utiliser Prisma pour tout le reste (users, reviews, migrations, CRUD simple), et du SQL brut pour tout ce qui touche à `location`.

`prisma/schema.prisma` :
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  fullName     String   @map("full_name")
  phone        String   @unique
  email        String?  @unique
  passwordHash String   @map("password_hash")
  avatarUrl    String?  @map("avatar_url")
  vehicleType  String?  @map("vehicle_type")
  vehicleBrand String?  @map("vehicle_brand")
  vehicleModel String?  @map("vehicle_model")
  vehicleYear  Int?     @map("vehicle_year")
  createdAt    DateTime @default(now()) @map("created_at")
  reviews      Review[]

  @@map("users")
}

model Garage {
  id            String   @id @default(uuid())
  name          String
  description   String?
  phone         String?
  location      Unsupported("geography(Point, 4326)")   // jamais lu/écrit via Prisma directement
  addressLabel  String?  @map("address_label")
  certified     Boolean  @default(false)
  rating        Decimal  @default(0) @db.Decimal(2, 1)
  reviewCount   Int      @default(0) @map("review_count")
  specialties   String[]
  photos        String[]
  openingHours  Json?    @map("opening_hours")
  createdAt     DateTime @default(now()) @map("created_at")
  reviews       Review[]

  @@map("garages")
}

model Review {
  id        String   @id @default(uuid())
  garageId  String   @map("garage_id")
  userId    String   @map("user_id")
  rating    Int
  comment   String?
  createdAt DateTime @default(now()) @map("created_at")

  garage Garage @relation(fields: [garageId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([garageId, userId])
  @@map("reviews")
}

model SosRequest {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  description String
  photoUrl    String?  @map("photo_url")
  location    Unsupported("geography(Point, 4326)")
  status      String   @default("pending")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("sos_requests")
}
```

Colonnes `Unsupported(...)` : Prisma les ignore dans le client généré (pas de champ `location` accessible via `prisma.garage.findMany()`). Pour créer/lire/chercher par position, passer par `prisma.$queryRaw` / `prisma.$executeRaw` (exemples ci-dessous).

**Migrations** : générer avec `npx prisma migrate dev --create-only` (ne pas laisser Prisma exécuter automatiquement, car il ne connaît pas la syntaxe `GEOGRAPHY`), puis éditer le fichier SQL généré à la main pour utiliser le vrai type PostGIS avant de l'appliquer avec `npx prisma migrate deploy`.

## 4. Requêtes géospatiales (SQL brut via Prisma)

**Créer un garage** :
```ts
await prisma.$executeRaw`
  INSERT INTO garages (name, phone, location, certified, address_label)
  VALUES (
    ${name}, ${phone},
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
    ${certified}, ${addressLabel}
  )
`;
```

**Recherche par proximité** (le cœur du produit — remplace `MOCK_GARAGES` + calcul Haversine côté app) :
```ts
type NearbyGarage = {
  id: string;
  name: string;
  certified: boolean;
  rating: number;
  distanceKm: number;
};

const results = await prisma.$queryRaw<NearbyGarage[]>`
  SELECT
    id, name, certified, rating,
    ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS "distanceKm"
  FROM garages
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    ${radiusKm} * 1000
  )
  ORDER BY "distanceKm" ASC
  LIMIT ${limit}
`;
```

`ST_DWithin` utilise l'index `GIST` automatiquement (contrairement à un simple `ORDER BY ST_Distance(...)` sans filtre, qui scanne toute la table) — toujours filtrer avec `ST_DWithin` avant de trier.

**Cas "aucun garage à proximité, afficher le plus proche quand même"** (logique déjà présente côté app mobile, à répliquer côté API) : si `results.length === 0`, refaire la même requête sans la clause `WHERE ST_DWithin` et avec `LIMIT 1` pour récupérer le garage le plus proche peu importe la distance.

## 5. Checklist avant la première implémentation

- [ ] Projet Neon créé, branche `dev` séparée de `main`
- [ ] `CREATE EXTENSION postgis;` exécuté
- [ ] Schéma SQL ci-dessus appliqué (via migration Prisma éditée à la main)
- [ ] `prisma/schema.prisma` en place, `npx prisma generate` exécuté
- [ ] Requête `nearby` testée manuellement avec des coordonnées réelles avant de la brancher à une route

-- GeoCras — schéma initial.
--
-- Deux partis pris qui traversent tout le fichier :
--
-- 1. TEXT + CHECK plutôt que des types ENUM Postgres. Ajouter une valeur à un
--    ENUM est une migration verrouillante ; ici c'est un ALTER de contrainte.
--
-- 2. Les règles anti-fraude sont des CONTRAINTES, pas des vérifications
--    applicatives. Une vérification applicative s'oublie au prochain endpoint ;
--    une contrainte tient même quand le code se trompe.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  phone           TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'client'
                    CHECK (role IN ('client', 'garage_owner', 'admin')),
  city            TEXT NOT NULL DEFAULT 'Yaoundé',
  locale          TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  -- Cache dénormalisé. La vérité comptable est la somme de loyalty_ledger ;
  -- cette colonne n'existe que pour éviter un SUM à chaque affichage d'écran.
  loyalty_points  INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  referral_code   TEXT NOT NULL UNIQUE,
  referred_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- On ne se parraine pas soi-même.
  CONSTRAINT no_self_referral CHECK (referred_by IS NULL OR referred_by <> id)
);

CREATE INDEX users_referred_by_idx ON users (referred_by) WHERE referred_by IS NOT NULL;

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Le jeton lui-même n'est jamais stocké en clair : une fuite de la table ne
  -- doit pas donner des sessions utilisables.
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE vehicles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('car', 'moto', 'truck')),
  brand      TEXT,
  model      TEXT,
  year       INTEGER CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
  plate      TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vehicles_user_idx ON vehicles (user_id);

-- « Un seul véhicule par défaut » devient impossible à violer, y compris par
-- une écriture concurrente.
CREATE UNIQUE INDEX vehicles_single_default_idx
  ON vehicles (user_id) WHERE is_default;

-- ---------------------------------------------------------------------------
-- Garages
-- ---------------------------------------------------------------------------

CREATE TABLE garages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  phone             TEXT,
  -- GEOGRAPHY et non GEOMETRY : ST_Distance rend directement des mètres en
  -- tenant compte de la courbure terrestre, sans conversion manuelle.
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  address_label     TEXT,
  quarter           TEXT,
  city              TEXT NOT NULL DEFAULT 'Yaoundé',
  certified         BOOLEAN NOT NULL DEFAULT false,
  certified_at      TIMESTAMPTZ,
  rating            NUMERIC(2, 1) NOT NULL DEFAULT 0
                      CHECK (rating >= 0 AND rating <= 5),
  review_count      INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  services          TEXT[] NOT NULL DEFAULT '{}',
  specialties       TEXT[] NOT NULL DEFAULT '{}',
  photos            TEXT[] NOT NULL DEFAULT '{}',
  opening_hours     JSONB,
  years_in_business INTEGER CHECK (years_in_business IS NULL OR years_in_business >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT certified_has_date CHECK (NOT certified OR certified_at IS NOT NULL)
);

-- L'index qui décide de tout. Sans lui, ST_DWithin dégénère en scan complet.
CREATE INDEX garages_location_idx ON garages USING GIST (location);

-- Index partiel : le tri « certifié » ne parcourt que les lignes concernées.
CREATE INDEX garages_certified_location_idx ON garages USING GIST (location)
  WHERE is_active AND certified;

-- Accélère le filtre `services @> ARRAY[...]`.
CREATE INDEX garages_services_idx ON garages USING GIN (services);

-- ---------------------------------------------------------------------------
-- Demandes d'assistance
-- ---------------------------------------------------------------------------

CREATE TABLE assistance_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id            UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  garage_id             UUID REFERENCES garages(id) ON DELETE SET NULL,

  vehicle_type          TEXT NOT NULL CHECK (vehicle_type IN ('car', 'moto', 'truck')),
  problem_type          TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  urgency               TEXT NOT NULL DEFAULT 'blocking'
                          CHECK (urgency IN ('can_wait', 'blocking', 'danger')),
  immobilized           BOOLEAN NOT NULL DEFAULT true,
  vulnerable_passengers BOOLEAN NOT NULL DEFAULT false,
  photo_url             TEXT,

  origin                GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy_m            REAL,

  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                          'pending', 'selected', 'accepted', 'en_route',
                          'awaiting_confirmation', 'closed', 'cancelled')),
  -- Numéro du dernier événement émis. Sert au rattrapage après reconnexion.
  last_seq              INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at           TIMESTAMPTZ,
  en_route_at           TIMESTAMPTZ,
  garage_arrived_at     TIMESTAMPTZ,
  client_arrived_at     TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,

  -- ⬇ Le cœur de l'anti-fraude, en dur dans le schéma.
  -- Une demande ne peut pas être clôturée sans les DEUX confirmations
  -- d'arrivée. Aucun chemin de code, présent ou futur, ne peut contourner ça.
  CONSTRAINT closed_requires_both_arrivals CHECK (
    status <> 'closed'
    OR (garage_arrived_at IS NOT NULL AND client_arrived_at IS NOT NULL)
  ),

  -- Passé la sélection, un garage est obligatoire.
  CONSTRAINT garage_set_after_selection CHECK (
    status IN ('pending', 'cancelled') OR garage_id IS NOT NULL
  ),

  CONSTRAINT closed_has_timestamp CHECK (
    (status = 'closed') = (closed_at IS NOT NULL)
  ),

  CONSTRAINT cancelled_has_timestamp CHECK (
    (status = 'cancelled') = (cancelled_at IS NOT NULL)
  )
);

CREATE INDEX requests_client_idx ON assistance_requests (client_id, created_at DESC);
CREATE INDEX requests_garage_idx ON assistance_requests (garage_id, status);
CREATE INDEX requests_origin_idx ON assistance_requests USING GIST (origin);

-- Une seule demande active par client : évite dix SOS ouverts en parallèle.
CREATE UNIQUE INDEX requests_one_active_per_client_idx
  ON assistance_requests (client_id)
  WHERE status NOT IN ('closed', 'cancelled');

CREATE TABLE request_events (
  id            BIGSERIAL PRIMARY KEY,
  request_id    UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role    TEXT CHECK (actor_role IN ('client', 'garage')),
  type          TEXT NOT NULL CHECK (type IN (
                  'created', 'garage_selected', 'accepted', 'en_route',
                  'position', 'arrival_confirmed', 'closed', 'cancelled')),
  payload       JSONB NOT NULL DEFAULT '{}',
  location      GEOGRAPHY(POINT, 4326),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Journal en ajout seul : c'est à la fois la piste d'audit anti-fraude et la
  -- source du rejeu après coupure réseau.
  UNIQUE (request_id, seq)
);

CREATE INDEX request_events_replay_idx ON request_events (request_id, seq);

CREATE TABLE position_pings (
  id          BIGSERIAL PRIMARY KEY,
  request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('client', 'garage')),
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  speed_mps   REAL CHECK (speed_mps IS NULL OR speed_mps >= 0),
  heading_deg REAL CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)),
  accuracy_m  REAL CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pings_request_time_idx ON position_pings (request_id, recorded_at DESC);
CREATE INDEX pings_role_idx ON position_pings (request_id, role, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Avis
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clé sur la DEMANDE, pas sur (garage, utilisateur).
  -- Conséquence 1 : un avis exige une intervention réellement clôturée.
  -- Conséquence 2 : un client fidèle qui revient trois fois note trois fois.
  request_id UUID NOT NULL UNIQUE REFERENCES assistance_requests(id) ON DELETE CASCADE,
  garage_id  UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reviews_garage_idx ON reviews (garage_id, created_at DESC);
CREATE INDEX reviews_user_idx ON reviews (user_id);

-- Recalcul de la note agrégée.
-- Couvre INSERT, UPDATE **et** DELETE : la version d'origine ne gérait que
-- INSERT, ce qui laissait rating/review_count définitivement faux après la
-- moindre suppression d'avis ou de compte.
CREATE OR REPLACE FUNCTION refresh_garage_rating() RETURNS TRIGGER AS $$
DECLARE
  affected UUID[];
  target   UUID;
BEGIN
  affected := ARRAY(
    SELECT DISTINCT g FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.garage_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.garage_id END
    ]) AS g WHERE g IS NOT NULL
  );

  FOREACH target IN ARRAY affected LOOP
    UPDATE garages SET
      rating = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE garage_id = target), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE garage_id = target)
    WHERE id = target;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_garage_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_garage_rating();

-- ---------------------------------------------------------------------------
-- Fidélité
-- ---------------------------------------------------------------------------

CREATE TABLE loyalty_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta_points    INTEGER NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN (
                    'assistance_completed', 'review_published', 'referral_completed',
                    'referred_signup', 'manual_adjustment', 'reversal')),
  state           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending', 'confirmed', 'reversed')),
  request_id      UUID REFERENCES assistance_requests(id) ON DELETE SET NULL,
  -- Verrou d'idempotence : une requête rejouée ne peut pas créditer deux fois.
  -- Les points deviennent du Mobile Money — c'est de la comptabilité.
  idempotency_key TEXT NOT NULL UNIQUE,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT confirmed_has_timestamp CHECK (
    (state = 'confirmed') = (confirmed_at IS NOT NULL)
  )
);

CREATE INDEX loyalty_user_idx ON loyalty_ledger (user_id, created_at DESC);
CREATE INDEX loyalty_state_idx ON loyalty_ledger (state, created_at)
  WHERE state = 'pending';

CREATE TABLE badges (
  id          TEXT PRIMARY KEY,
  label_fr    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  tone        TEXT NOT NULL DEFAULT 'muted'
                CHECK (tone IN ('primary', 'warning', 'muted')),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_badges (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ---------------------------------------------------------------------------
-- Mode conduite
-- ---------------------------------------------------------------------------

CREATE TABLE driving_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Identifiant généré par le mobile : rend le renvoi idempotent quand le
  -- réseau coupe pendant la synchronisation de fin de session.
  client_session_id TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ NOT NULL,
  distance_m        DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (distance_m >= 0),
  max_speed_kmh     REAL NOT NULL DEFAULT 0 CHECK (max_speed_kmh >= 0),
  avg_speed_kmh     REAL NOT NULL DEFAULT 0 CHECK (avg_speed_kmh >= 0),
  alert_count       INTEGER NOT NULL DEFAULT 0 CHECK (alert_count >= 0),
  score             INTEGER NOT NULL DEFAULT 100 CHECK (score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, client_session_id),
  CONSTRAINT session_ends_after_start CHECK (ended_at >= started_at)
);

CREATE INDEX driving_sessions_user_idx ON driving_sessions (user_id, started_at DESC);

CREATE TABLE driving_alerts (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES driving_sessions(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
                  'red_light', 'obstacle', 'blind_spot_left',
                  'blind_spot_right', 'side_impact')),
  severity      TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  at_speed_kmh  REAL NOT NULL DEFAULT 0,
  distance_m    REAL,
  occurred_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX driving_alerts_session_idx ON driving_alerts (session_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Horodatage de mise à jour
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_touch
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- Badges de référence
-- ---------------------------------------------------------------------------

INSERT INTO badges (id, label_fr, label_en, tone, sort_order) VALUES
  ('tier_gold',      'Membre Or',      'Gold member',      'primary', 10),
  ('ten_rescues',    '10 dépannages',  '10 rescues',       'warning', 20),
  ('referrer',       'Parrain',        'Referrer',         'muted',   30),
  ('first_rescue',   'Premier dépannage', 'First rescue',  'muted',   40),
  ('reviewer',       'Contributeur',   'Contributor',      'muted',   50);

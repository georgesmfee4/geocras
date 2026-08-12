import type { ColumnType, Generated, RawBuilder } from 'kysely';

/**
 * Colonne PostGIS `geography(Point, 4326)`.
 *
 * Le type est volontairement hostile :
 *  - en écriture, seul un fragment `sql\`...\`` est accepté, donc on passe
 *    forcément par `pointFromLatLng()` ;
 *  - en lecture, on récupère une chaîne WKB inexploitable, ce qui force à
 *    projeter explicitement `ST_Y(...) AS lat` / `ST_X(...) AS lng`.
 *
 * C'est ce que le pattern Prisma + `Unsupported()` ne pouvait pas offrir :
 * ici le compilateur empêche l'erreur, il ne se contente pas de l'ignorer.
 */
export type GeographyPoint = ColumnType<string, RawBuilder<unknown>, RawBuilder<unknown>>;

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export type UserRole = 'client' | 'garage_owner' | 'admin';
export type VehicleKind = 'car' | 'moto' | 'truck';
/**
 * Une demande accepte en plus `other`, la table `vehicles` non — leurs
 * contraintes CHECK diffèrent, leurs types aussi. Les confondre laisserait
 * passer un véhicule enregistré « other » qui casserait à l'insertion.
 */
export type RequestVehicleKind = VehicleKind | 'other';
export type Locale = 'fr' | 'en';
export type RequestStatus =
  | 'pending'
  | 'selected'
  | 'accepted'
  | 'en_route'
  | 'awaiting_confirmation'
  | 'closed'
  | 'cancelled';
export type PartyRole = 'client' | 'garage';
export type LedgerState = 'pending' | 'confirmed' | 'reversed';

export type UsersTable = {
  id: Generated<string>;
  full_name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  avatar_url: string | null;
  role: ColumnType<UserRole, UserRole | undefined, UserRole>;
  city: ColumnType<string, string | undefined, string>;
  locale: ColumnType<Locale, Locale | undefined, Locale>;
  loyalty_points: ColumnType<number, number | undefined, number>;
  referral_code: string;
  referred_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

export type RefreshTokensTable = {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  created_at: Generated<Date>;
};

export type VehiclesTable = {
  id: Generated<string>;
  user_id: string;
  type: VehicleKind;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  is_default: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: Generated<Date>;
};

export type GaragesTable = {
  id: Generated<string>;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  phone: string | null;
  /** Contact de vérification — jamais servi au public. */
  email: string | null;
  location: GeographyPoint;
  address_label: string | null;
  quarter: string | null;
  city: ColumnType<string, string | undefined, string>;
  certified: ColumnType<boolean, boolean | undefined, boolean>;
  certified_at: Timestamp | null;
  /** NULL tant que le dossier n'a pas été vérifié. Cf. 0006. */
  verified_at: Timestamp | null;
  /** `NUMERIC` : le driver pg le rend en chaîne, à convertir explicitement. */
  rating: ColumnType<string, number | undefined, number>;
  review_count: ColumnType<number, number | undefined, number>;
  services: ColumnType<string[], string[] | undefined, string[]>;
  specialties: ColumnType<string[], string[] | undefined, string[]>;
  photos: ColumnType<string[], string[] | undefined, string[]>;
  opening_hours: ColumnType<Record<string, string> | null, string | null | undefined, string | null>;
  years_in_business: number | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: Generated<Date>;
};

export type AssistanceRequestsTable = {
  id: Generated<string>;
  client_id: string;
  vehicle_id: string | null;
  garage_id: string | null;
  vehicle_type: RequestVehicleKind;
  /** Libellé libre, renseigné uniquement quand `vehicle_type` vaut `other`. */
  vehicle_label: string | null;
  problem_type: string;
  description: ColumnType<string, string | undefined, string>;
  urgency: ColumnType<'can_wait' | 'blocking' | 'danger', 'can_wait' | 'blocking' | 'danger' | undefined, 'can_wait' | 'blocking' | 'danger'>;
  immobilized: ColumnType<boolean, boolean | undefined, boolean>;
  vulnerable_passengers: ColumnType<boolean, boolean | undefined, boolean>;
  photo_url: string | null;
  origin: GeographyPoint;
  accuracy_m: number | null;
  status: ColumnType<RequestStatus, RequestStatus | undefined, RequestStatus>;
  last_seq: ColumnType<number, number | undefined, number>;
  created_at: Generated<Date>;
  selected_at: Timestamp | null;
  accepted_at: Timestamp | null;
  en_route_at: Timestamp | null;
  garage_arrived_at: Timestamp | null;
  client_arrived_at: Timestamp | null;
  closed_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  cancel_reason: string | null;
};

export type RequestEventsTable = {
  id: Generated<string>;
  request_id: string;
  seq: number;
  actor_user_id: string | null;
  actor_role: PartyRole | null;
  type:
    | 'created'
    | 'garage_selected'
    | 'accepted'
    | 'en_route'
    | 'position'
    | 'arrival_confirmed'
    | 'closed'
    | 'cancelled';
  payload: ColumnType<unknown, string | undefined, string>;
  location: GeographyPoint | null;
  created_at: Generated<Date>;
};

export type PositionPingsTable = {
  id: Generated<string>;
  request_id: string;
  user_id: string;
  role: PartyRole;
  location: GeographyPoint;
  speed_mps: number | null;
  heading_deg: number | null;
  accuracy_m: number | null;
  recorded_at: Timestamp;
  created_at: Generated<Date>;
};

export type ReviewsTable = {
  id: Generated<string>;
  request_id: string;
  garage_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: Generated<Date>;
};

export type LoyaltyLedgerTable = {
  id: Generated<string>;
  user_id: string;
  delta_points: number;
  reason:
    | 'assistance_completed'
    | 'review_published'
    | 'referral_completed'
    | 'referred_signup'
    | 'manual_adjustment'
    | 'reversal';
  state: ColumnType<LedgerState, LedgerState | undefined, LedgerState>;
  request_id: string | null;
  idempotency_key: string;
  confirmed_at: Timestamp | null;
  created_at: Generated<Date>;
};

export type BadgesTable = {
  id: string;
  label_fr: string;
  label_en: string;
  tone: ColumnType<'primary' | 'warning' | 'muted', 'primary' | 'warning' | 'muted' | undefined, 'primary' | 'warning' | 'muted'>;
  sort_order: ColumnType<number, number | undefined, number>;
};

export type UserBadgesTable = {
  user_id: string;
  badge_id: string;
  unlocked_at: Generated<Date>;
};

export type DrivingSessionsTable = {
  id: Generated<string>;
  user_id: string;
  client_session_id: string;
  started_at: Timestamp;
  ended_at: Timestamp;
  distance_m: ColumnType<number, number | undefined, number>;
  max_speed_kmh: ColumnType<number, number | undefined, number>;
  avg_speed_kmh: ColumnType<number, number | undefined, number>;
  alert_count: ColumnType<number, number | undefined, number>;
  score: ColumnType<number, number | undefined, number>;
  created_at: Generated<Date>;
};

export type DrivingAlertsTable = {
  id: Generated<string>;
  session_id: string;
  type: 'red_light' | 'obstacle' | 'blind_spot_left' | 'blind_spot_right' | 'side_impact';
  severity: 'critical' | 'warning' | 'info';
  at_speed_kmh: ColumnType<number, number | undefined, number>;
  distance_m: number | null;
  occurred_at: Timestamp;
};

export type Database = {
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  vehicles: VehiclesTable;
  garages: GaragesTable;
  assistance_requests: AssistanceRequestsTable;
  request_events: RequestEventsTable;
  position_pings: PositionPingsTable;
  reviews: ReviewsTable;
  loyalty_ledger: LoyaltyLedgerTable;
  badges: BadgesTable;
  user_badges: UserBadgesTable;
  driving_sessions: DrivingSessionsTable;
  driving_alerts: DrivingAlertsTable;
};

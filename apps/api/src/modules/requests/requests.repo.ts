import { sql, type Kysely, type Transaction } from 'kysely';
import type { PartyRole, ProofPing, RequestEventType } from '@geocras/shared';
import type { Database } from '../../db/types';
import { latOf, lngOf, pointFromLatLng, type LatLng } from '../../db/geo';

type Db = Kysely<Database> | Transaction<Database>;

const REQUEST_COLUMNS = [
  'r.id',
  'r.client_id',
  'r.vehicle_id',
  'r.garage_id',
  'r.vehicle_type',
  'r.vehicle_label',
  'r.problem_type',
  'r.description',
  'r.urgency',
  'r.immobilized',
  'r.vulnerable_passengers',
  'r.photo_url',
  'r.accuracy_m',
  'r.service_mode',
  'r.status',
  'r.last_seq',
  'r.created_at',
  'r.selected_at',
  'r.accepted_at',
  'r.en_route_at',
  'r.garage_arrived_at',
  'r.client_arrived_at',
  'r.closed_at',
  'r.cancelled_at',
  'r.cancel_reason',
] as const;

export function selectRequest(db: Db) {
  return db
    .selectFrom('assistance_requests as r')
    .select([
      ...REQUEST_COLUMNS,
      latOf('r.origin').as('origin_lat'),
      lngOf('r.origin').as('origin_lng'),
    ]);
}

export type RequestRow = Awaited<ReturnType<ReturnType<typeof selectRequest>['executeTakeFirst']>>;

export async function findRequestById(db: Db, id: string) {
  return selectRequest(db).where('r.id', '=', id).executeTakeFirst();
}

/**
 * Demande active d'un client, s'il en a une.
 *
 * Le filtre reprend **mot pour mot** celui de l'index partiel
 * `requests_one_active_per_client_idx` (`status NOT IN ('closed','cancelled')`).
 * Ce n'est pas seulement de la performance : c'est ce qui garantit que cette
 * lecture voit exactement la même demande que celle qui fait échouer une
 * seconde création avec `REQUEST_ALREADY_ACTIVE`. Une définition d'« active »
 * qui divergerait de l'index produirait le pire des cas — l'app dit qu'il n'y
 * a rien en cours, et la base refuse quand même la nouvelle demande.
 *
 * `LIMIT 1` est une précaution formelle : l'index est UNIQUE, il ne peut pas y
 * en avoir deux.
 */
export async function findActiveRequestForClient(db: Db, clientId: string) {
  return selectRequest(db)
    .where('r.client_id', '=', clientId)
    .where('r.status', 'not in', ['closed', 'cancelled'])
    .orderBy('r.created_at', 'desc')
    .limit(1)
    .executeTakeFirst();
}

/**
 * Statuts qui composent la file de travail d'un garage.
 *
 * `pending` en est absent volontairement : une demande sans garage retenu
 * n'est adressée à personne. `closed` et `cancelled` non plus — ils relèvent
 * de l'historique, que `getHistory` sert déjà au propriétaire.
 */
const LIVE_JOB_STATUSES = [
  'selected',
  'accepted',
  'en_route',
  'awaiting_confirmation',
] as const;

/** Garage détenu par ce compte, s'il en détient un. */
export async function findGarageOwnedBy(db: Db, userId: string) {
  return db
    .selectFrom('garages')
    .select(['id', 'name', 'certified', 'is_active', 'verified_at'])
    .where('owner_user_id', '=', userId)
    .executeTakeFirst();
}

/**
 * Demandes vivantes adressées à ce garage, avec leur demandeur.
 *
 * Pas de `ST_DWithin` ici, et ce n'est pas un oubli : la règle vise les
 * recherches de proximité, où le filtre géographique **est** la requête. On
 * filtre ici sur `garage_id`, qui rend au plus une poignée de lignes, et la
 * distance n'est qu'une colonne projetée sur chacune — jamais un critère de
 * tri ni de sélection. Un `ST_DWithin` n'écarterait rien et coûterait un
 * calcul de plus.
 */
export async function findGarageJobs(db: Db, garageId: string) {
  return selectRequest(db)
    .innerJoin('garages as g', 'g.id', 'r.garage_id')
    .innerJoin('users as u', 'u.id', 'r.client_id')
    // Le véhicule est facultatif : une demande peut être déposée sans en avoir
    // enregistré aucun, auquel cas le type déclaré au SOS est tout ce qu'on a.
    .leftJoin('vehicles as v', 'v.id', 'r.vehicle_id')
    .select([
      'u.full_name as client_name',
      'u.phone as client_phone',
      'u.avatar_url as client_avatar',
      'v.brand as vehicle_brand',
      'v.model as vehicle_model',
      'v.plate as vehicle_plate',
      sql<number>`ST_Distance(r.origin, g.location)::float8`.as('distance_m'),
    ])
    .where('r.garage_id', '=', garageId)
    .where('r.status', 'in', [...LIVE_JOB_STATUSES])
    .orderBy('r.created_at', 'desc')
    .execute();
}

/** Propriétaire d'un garage désigné par son identifiant, s'il en a un. */
export async function findGarageOwner(db: Db, garageId: string): Promise<string | null> {
  const row = await db
    .selectFrom('garages')
    .select(['owner_user_id'])
    .where('id', '=', garageId)
    .executeTakeFirst();

  return row?.owner_user_id ?? null;
}

/**
 * Propriétaire du garage retenu sur cette demande, s'il y en a un.
 *
 * Sert au routage temps réel : c'est ce compte-là qu'il faut prévenir, et lui
 * seul. Les garages du seed n'ont pas de propriétaire — d'où le `null`, qui
 * est un cas normal et non une anomalie.
 */
export async function findOwnerOfRequestGarage(
  db: Db,
  requestId: string,
): Promise<string | null> {
  const row = await db
    .selectFrom('assistance_requests as r')
    .innerJoin('garages as g', 'g.id', 'r.garage_id')
    .select(['g.owner_user_id'])
    .where('r.id', '=', requestId)
    .executeTakeFirst();

  return row?.owner_user_id ?? null;
}

/**
 * Détermine le rôle de l'appelant dans la demande.
 *
 * Le garagiste n'est pas désigné par un champ dédié : c'est le propriétaire du
 * garage retenu. Passer par cette fonction plutôt que par une comparaison
 * ad hoc évite qu'un endpoint oublie de vérifier `garages.owner_user_id` et
 * laisse un tiers écouter la position de deux inconnus.
 */
export async function resolveParty(
  db: Db,
  requestId: string,
  userId: string,
): Promise<PartyRole | null> {
  const row = await db
    .selectFrom('assistance_requests as r')
    .leftJoin('garages as g', 'g.id', 'r.garage_id')
    .select(['r.client_id', 'g.owner_user_id'])
    .where('r.id', '=', requestId)
    .executeTakeFirst();

  if (!row) return null;
  if (row.client_id === userId) return 'client';
  if (row.owner_user_id !== null && row.owner_user_id === userId) return 'garage';
  return null;
}

/**
 * Ajoute un événement au journal en incrémentant `last_seq` de façon atomique.
 *
 * Doit toujours être appelé dans la même transaction que le changement d'état
 * qu'il décrit : c'est ce journal qui sert de piste d'audit anti-fraude ET de
 * source de rejeu après reconnexion. Un événement manquant, et un client
 * reconnecté ne rattrapera jamais son retard.
 */
export async function appendEvent(
  trx: Transaction<Database>,
  params: {
    requestId: string;
    type: RequestEventType;
    actorUserId: string | null;
    actorRole: PartyRole | null;
    payload?: unknown;
    location?: LatLng | null;
  },
): Promise<number> {
  const updated = await trx
    .updateTable('assistance_requests')
    .set({ last_seq: sql<number>`last_seq + 1` })
    .where('id', '=', params.requestId)
    .returning('last_seq')
    .executeTakeFirstOrThrow();

  await trx
    .insertInto('request_events')
    .values({
      request_id: params.requestId,
      seq: updated.last_seq,
      actor_user_id: params.actorUserId,
      actor_role: params.actorRole,
      type: params.type,
      payload: JSON.stringify(params.payload ?? {}),
      location: params.location ? pointFromLatLng(params.location) : null,
    })
    .execute();

  return updated.last_seq;
}

/** Événements postérieurs à `afterSeq`, pour le rattrapage après coupure. */
/**
 * Le dernier fait consigné sur une demande.
 *
 * Trié sur `seq` et non sur `created_at` : deux événements écrits dans la même
 * transaction peuvent porter le même horodatage à la milliseconde, et c'est
 * `seq` qui fait foi partout ailleurs — dans le rattrapage socket comme dans le
 * journal rejoué.
 */
export async function findLatestEvent(db: Db, requestId: string) {
  return db
    .selectFrom('request_events')
    .select(['seq', 'type'])
    .where('request_id', '=', requestId)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export async function findEventsAfter(db: Db, requestId: string, afterSeq: number) {
  return db
    .selectFrom('request_events')
    .select(['seq', 'type', 'actor_user_id', 'actor_role', 'payload', 'created_at'])
    .where('request_id', '=', requestId)
    .where('seq', '>', afterSeq)
    .orderBy('seq', 'asc')
    .limit(200)
    .execute();
}

export type LatestPosition = {
  role: PartyRole;
  lat: number;
  lng: number;
  speed_mps: number | null;
  recorded_at: Date;
};

/** Dernière position connue de chaque partie. */
export async function findLatestPositions(
  db: Db,
  requestId: string,
): Promise<LatestPosition[]> {
  const { rows } = await sql<LatestPosition>`
    SELECT DISTINCT ON (role)
      role,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      speed_mps,
      recorded_at
    FROM position_pings
    WHERE request_id = ${requestId}
    ORDER BY role, recorded_at DESC
  `.execute(db);
  return rows;
}

export async function insertPing(
  db: Db,
  params: {
    requestId: string;
    userId: string;
    role: PartyRole;
    position: LatLng;
    speedMps: number | null;
    headingDeg: number | null;
    accuracyM: number | null;
    recordedAt: Date;
  },
): Promise<void> {
  await db
    .insertInto('position_pings')
    .values({
      request_id: params.requestId,
      user_id: params.userId,
      role: params.role,
      location: pointFromLatLng(params.position),
      speed_mps: params.speedMps,
      heading_deg: params.headingDeg,
      accuracy_m: params.accuracyM,
      recorded_at: params.recordedAt,
    })
    .execute();
}

/**
 * Distance réellement parcourue par le garagiste, cumulée entre pings
 * consécutifs.
 *
 * C'est la mesure qui casse la collusion statique : deux comptes complices qui
 * se confirment mutuellement sans bouger produisent zéro mètre parcouru.
 */
export async function garageTravelMeters(db: Db, requestId: string): Promise<number> {
  const { rows } = await sql<{ meters: number }>`
    SELECT COALESCE(SUM(ST_Distance(location, previous)), 0)::float8 AS meters
    FROM (
      SELECT location, LAG(location) OVER (ORDER BY recorded_at) AS previous
      FROM position_pings
      WHERE request_id = ${requestId} AND role = 'garage'
    ) steps
    WHERE previous IS NOT NULL
  `.execute(db);
  return Number(rows[0]?.meters ?? 0);
}

/** Distance entre le lieu de la panne et le garage retenu, à la création. */
export async function initialSeparationMeters(
  db: Db,
  requestId: string,
): Promise<number | null> {
  const { rows } = await sql<{ meters: number | null }>`
    SELECT ST_Distance(r.origin, g.location)::float8 AS meters
    FROM assistance_requests r
    JOIN garages g ON g.id = r.garage_id
    WHERE r.id = ${requestId}
  `.execute(db);
  const meters = rows[0]?.meters;
  return meters === undefined || meters === null ? null : Number(meters);
}

/** Nombre d'interventions clôturées entre ce client et ce garage sur 30 jours. */
export async function closedPairCount(
  db: Db,
  clientId: string,
  garageId: string,
): Promise<number> {
  const row = await db
    .selectFrom('assistance_requests')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('client_id', '=', clientId)
    .where('garage_id', '=', garageId)
    .where('status', '=', 'closed')
    .where('closed_at', '>', sql<Date>`now() - interval '30 days'`)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function findGarageSummaryById(db: Db, garageId: string) {
  return db
    .selectFrom('garages as g')
    .select([
      'g.id',
      'g.name',
      'g.certified',
      'g.phone',
      'g.address_label',
      'g.quarter',
      'g.services',
      'g.photos',
      'g.review_count',
      'g.owner_user_id',
      sql<number>`g.rating::float8`.as('rating'),
      latOf('g.location').as('lat'),
      lngOf('g.location').as('lng'),
      sql<boolean>`garage_is_open(g.opening_hours, now())`.as('open_now'),
    ])
    .where('g.id', '=', garageId)
    .executeTakeFirst();
}

/**
 * Toute la trace d'un rôle sur une demande, dans l'ordre chronologique.
 *
 * Distinct de `findLatestPositions`, qui ne rend que le dernier point de chacun
 * pour alimenter les ETA : ici on a besoin du **trajet entier**, parce que la
 * preuve d'arrivée se lit sur sa forme — d'où il part, s'il entre dans le rayon,
 * et surtout s'il s'y arrête au lieu de repartir.
 *
 * Le tri est fait par la base et non en mémoire : l'index
 * `pings_role_idx (request_id, role, recorded_at DESC)` le rend gratuit, et une
 * preuve comptable ne se fie pas à un ordre implicite.
 *
 * Aucune borne de volume : une intervention d'une heure produit quelques
 * centaines de points, l'émetteur n'envoyant qu'au-delà de quinze mètres
 * parcourus. Un `LIMIT` couperait la fin du trajet, c'est-à-dire exactement la
 * partie qui prouve l'arrivée.
 */
export async function findTrail(
  db: Db,
  requestId: string,
  role: PartyRole,
): Promise<ProofPing[]> {
  const { rows } = await sql<{ lat: number; lng: number; recorded_at: Date }>`
    SELECT
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      recorded_at
    FROM position_pings
    WHERE request_id = ${requestId} AND role = ${role}
    ORDER BY recorded_at ASC
  `.execute(db);

  return rows.map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    recordedAt: new Date(row.recorded_at).toISOString(),
  }));
}

/**
 * Ce client est-il déjà venu chez ce garage par GeoCras ?
 *
 * Distinct de `closedPairCount`, qui compte les clôtures des trente derniers
 * jours pour plafonner les crédits de fidélité. Ici la question n'a pas de
 * fenêtre : un client rencontré il y a huit mois reste un client que le garage
 * connaît, et c'est précisément ce que la remise de moitié récompense — le fait
 * de continuer à passer par l'app plutôt que d'appeler en direct.
 *
 * `excludeRequestId` n'est pas une commodité. L'appel se fait dans la
 * transaction qui vient de clore la demande courante : sans l'exclure, toute
 * première intervention se compterait elle-même et partirait à moitié prix.
 */
export async function hasEarlierClosedPair(
  db: Db,
  params: { clientId: string; garageId: string; excludeRequestId: string },
): Promise<boolean> {
  const row = await db
    .selectFrom('assistance_requests')
    .select('id')
    .where('client_id', '=', params.clientId)
    .where('garage_id', '=', params.garageId)
    .where('status', '=', 'closed')
    .where('id', '!=', params.excludeRequestId)
    .limit(1)
    .executeTakeFirst();

  return row !== undefined;
}

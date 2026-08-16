import {
  canTransition,
  estimateEtaMinutes,
  isProblemValidForVehicle,
  isTerminal,
  matchingServices,
  type ApproachRoute,
  type AssistanceRequest,
  type CreateRequestBody,
  type CreateRequestResponse,
  type GarageSummary,
  type PartyRole,
  type Position,
  type RequestDetail,
  type RequestParty,
  type RequestStatus,
  type Service,
} from '@geocras/shared';
import { sql } from 'kysely';
import { db } from '../../db/client';
import { pointFromLatLng } from '../../db/geo';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { bus } from '../../realtime/bus';
import { awardForClosedRequest } from '../loyalty/loyalty.service';
import { searchNearby } from '../garages/garages.service';
import { computeRoute } from '../routing/routing.service';
import {
  appendEvent,
  findActiveRequestForClient,
  findGarageSummaryById,
  findLatestPositions,
  findRequestById,
  insertPing,
  resolveParty,
  selectRequest,
} from './requests.repo';
import { computeTracking } from './tracking';

type RequestRecord = NonNullable<Awaited<ReturnType<typeof findRequestById>>>;

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function toAssistanceRequest(row: RequestRecord): AssistanceRequest {
  const iso = (value: Date | null | undefined) =>
    value === null || value === undefined ? null : new Date(value).toISOString();

  return {
    id: row.id,
    status: row.status,
    clientId: row.client_id,
    garageId: row.garage_id,
    vehicleType: row.vehicle_type,
    vehicleLabel: row.vehicle_label,
    problemType: row.problem_type as AssistanceRequest['problemType'],
    description: row.description,
    urgency: row.urgency,
    immobilized: row.immobilized,
    vulnerablePassengers: row.vulnerable_passengers,
    photoUrl: row.photo_url,
    origin: { lat: Number(row.origin_lat), lng: Number(row.origin_lng) },
    createdAt: new Date(row.created_at).toISOString(),
    selectedAt: iso(row.selected_at),
    acceptedAt: iso(row.accepted_at),
    enRouteAt: iso(row.en_route_at),
    garageArrivedAt: iso(row.garage_arrived_at),
    clientArrivedAt: iso(row.client_arrived_at),
    closedAt: iso(row.closed_at),
    cancelledAt: iso(row.cancelled_at),
    cancelReason: row.cancel_reason,
    lastSeq: row.last_seq,
  };
}

/** Charge la demande et vérifie que l'appelant en est bien une partie. */
async function loadAsParty(
  requestId: string,
  userId: string,
): Promise<{ request: RequestRecord; role: PartyRole }> {
  const request = await findRequestById(db, requestId);
  if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable');

  const role = await resolveParty(db, requestId, userId);
  if (!role) throw forbidden("Vous n'êtes pas partie à cette demande");

  return { request, role };
}

function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(
      'INVALID_STATE_TRANSITION',
      `Transition impossible depuis l'état « ${from} »`,
    );
  }
}

/**
 * Crée la demande ET renvoie les garages classés dans la même réponse.
 *
 * Un seul aller-retour réseau : sur un réseau camerounais irrégulier, deux
 * appels successifs doublent la probabilité qu'un utilisateur en panne se
 * retrouve devant un écran de chargement bloqué.
 */
export async function createRequest(
  userId: string,
  body: CreateRequestBody,
): Promise<CreateRequestResponse> {
  if (!isProblemValidForVehicle(body.vehicleType, body.problemType)) {
    throw badRequest('Cette panne ne correspond pas au type de véhicule', {
      problemType: `Panne invalide pour un véhicule « ${body.vehicleType} »`,
    });
  }

  if (body.vehicleId) {
    const vehicle = await db
      .selectFrom('vehicles')
      .select('id')
      .where('id', '=', body.vehicleId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!vehicle) throw notFound('VEHICLE_NOT_FOUND', 'Véhicule introuvable');
  }

  const created = await db
    .transaction()
    .execute(async (trx) => {
      const inserted = await trx
        .insertInto('assistance_requests')
        .values({
          client_id: userId,
          vehicle_id: body.vehicleId,
          vehicle_type: body.vehicleType,
          // Normalisé à `null` hors du cas « Autre » : garder un libellé après
          // un changement d'avis afficherait « Voiture — tricycle » au garage.
          vehicle_label: body.vehicleType === 'other' ? body.vehicleLabel : null,
          problem_type: body.problemType,
          description: body.description,
          urgency: body.urgency,
          immobilized: body.immobilized,
          vulnerable_passengers: body.vulnerablePassengers,
          photo_url: body.photoUrl,
          origin: pointFromLatLng(body.origin),
          accuracy_m: body.accuracyM,
          status: 'pending',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await appendEvent(trx, {
        requestId: inserted.id,
        type: 'created',
        actorUserId: userId,
        actorRole: 'client',
        payload: { vehicleType: body.vehicleType, problemType: body.problemType },
        location: body.origin,
      });

      return inserted.id;
    })
    .catch((error: unknown) => {
      if ((error as Error).message.includes('requests_one_active_per_client_idx')) {
        throw conflict(
          'REQUEST_ALREADY_ACTIVE',
          'Vous avez déjà une demande en cours. Terminez-la ou annulez-la.',
        );
      }
      throw error;
    });

  /**
   * Compétences qui permettent de traiter cette panne.
   *
   * Le filtre ne portait auparavant que sur le remorquage, en ignorant la
   * nature de la panne : on proposait donc un spécialiste pneus pour une boîte
   * de vitesse. Il porte désormais sur les compétences réelles — et en **OU**,
   * parce que ce sont des voies alternatives, pas des exigences cumulées.
   */
  const services = [...matchingServices(body.problemType, body.immobilized)];

  const nearby = await searchNearby({
    lat: body.origin.lat,
    lng: body.origin.lng,
    radiusKm: 15,
    sort: body.sort,
    limit: 20,
    // Aucun filtre de confort sur un SOS : la personne est en panne, on lui
    // montre tout ce qui peut l'aider et on laisse le tri faire le classement.
    openNow: false,
    certifiedOnly: false,
    services,
    matchAny: true,
  });

  // Repli en cascade : plutôt qu'un écran vide, on relâche la contrainte de
  // compétence et on élargit le rayon. Un garage généraliste un peu plus loin
  // vaut mieux que rien du tout au bord de la route.
  const results =
    nearby.results.length > 0
      ? nearby.results
      : (
          await searchNearby({
            lat: body.origin.lat,
            lng: body.origin.lng,
            radiusKm: 25,
            sort: body.sort,
            limit: 20,
            openNow: false,
            certifiedOnly: false,
            matchAny: false,
          })
        ).results;

  const request = await findRequestById(db, created);

  return {
    request: toAssistanceRequest(request as RequestRecord),
    garages: results,
    fallback: nearby.fallback,
  };
}

export async function selectGarage(
  requestId: string,
  userId: string,
  garageId: string,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);
  if (role !== 'client') throw forbidden('Seul le client choisit le garage');
  assertTransition(request.status, 'selected');

  const garage = await findGarageSummaryById(db, garageId);
  if (!garage) throw notFound('GARAGE_NOT_FOUND', 'Garage introuvable');

  return applyTransition({
    requestId,
    userId,
    role,
    next: 'selected',
    // `selected_at` date le moment où ce garage a été prévenu : c'est le point
    // de départ du compteur d'attente affiché au client, et la seule mesure
    // honnête de son délai de réponse.
    patch: { garage_id: garageId, selected_at: new Date() },
    eventType: 'garage_selected',
    payload: { garageId, garageName: garage.name },
  });
}

export async function acceptRequest(
  requestId: string,
  userId: string,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);
  if (role !== 'garage') throw forbidden('Seul le garage accepte une demande');
  assertTransition(request.status, 'accepted');

  return applyTransition({
    requestId,
    userId,
    role,
    next: 'accepted',
    patch: { accepted_at: new Date() },
    eventType: 'accepted',
  });
}

/**
 * Refus du garage : la demande repart en recherche.
 *
 * **Ce n'est pas une annulation.** Le client est en panne au bord d'une route ;
 * lui tuer sa demande parce qu'un garage ne peut pas venir l'obligerait à tout
 * ressaisir. On ne retire que le garage : la demande garde son identifiant, son
 * journal, son ancienneté, et le client retrouve la liste des garages là où il
 * l'avait laissée.
 *
 * `selected_at` repart à `null` avec `garage_id` — c'est l'origine du compteur
 * d'attente, et le garage suivant n'est pas comptable des minutes passées à
 * attendre celui d'avant.
 *
 * L'identité du garage qui refuse est écrite dans le journal, pas perdue : elle
 * est la seule base d'un futur taux de refus, et la seule façon de savoir
 * pourquoi une demande a fait trois garages avant d'aboutir.
 */
export async function declineRequest(
  requestId: string,
  userId: string,
  reason: string,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);
  if (role !== 'garage') throw forbidden('Seul le garage refuse une demande');
  assertTransition(request.status, 'pending');

  const garage = request.garage_id ? await findGarageSummaryById(db, request.garage_id) : null;

  return applyTransition({
    requestId,
    userId,
    role,
    next: 'pending',
    patch: { garage_id: null, selected_at: null },
    eventType: 'declined',
    payload: { garageId: request.garage_id, garageName: garage?.name ?? null, reason },
    // La demande ne désignera plus ce garage une fois la transition écrite :
    // sans ce rappel, l'atelier qui vient de refuser garderait la demande
    // affichée dans sa file jusqu'au prochain sondage.
    notifyGarageId: request.garage_id,
  });
}

export async function declareEnRoute(
  requestId: string,
  userId: string,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);
  if (role !== 'garage') throw forbidden('Seul le garage se déclare en route');
  assertTransition(request.status, 'en_route');

  return applyTransition({
    requestId,
    userId,
    role,
    next: 'en_route',
    patch: { en_route_at: new Date() },
    eventType: 'en_route',
  });
}

/**
 * Confirmation d'arrivée — **idempotente**.
 *
 * Chaque partie confirme la sienne. Un second appui ne rejoue rien : ni
 * horodatage écrasé, ni événement dupliqué, ni point crédité deux fois. C'est
 * indispensable sur un réseau qui coupe, où le mobile réessaie tout seul.
 *
 * La clôture n'intervient qu'aux DEUX confirmations — et la contrainte
 * `closed_requires_both_arrivals` l'impose au niveau de la base, pas seulement
 * ici.
 */
export async function confirmArrival(
  requestId: string,
  userId: string,
  position: { lat: number; lng: number } | null,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);

  if (isTerminal(request.status)) {
    throw conflict('INVALID_STATE_TRANSITION', 'Cette demande est déjà terminée');
  }
  if (request.status !== 'en_route' && request.status !== 'awaiting_confirmation') {
    throw conflict(
      'INVALID_STATE_TRANSITION',
      "L'arrivée ne peut être confirmée qu'une fois le garagiste en route",
    );
  }

  const alreadyConfirmed =
    role === 'garage' ? request.garage_arrived_at !== null : request.client_arrived_at !== null;

  const updated = await db.transaction().execute(async (trx) => {
    if (!alreadyConfirmed) {
      const now = new Date();
      const column = role === 'garage' ? 'garage_arrived_at' : 'client_arrived_at';

      await trx
        .updateTable('assistance_requests')
        .set({ [column]: now })
        .where('id', '=', requestId)
        .execute();

      await appendEvent(trx, {
        requestId,
        type: 'arrival_confirmed',
        actorUserId: userId,
        actorRole: role,
        payload: { role },
        location: position,
      });
    }

    const current = await trx
      .selectFrom('assistance_requests')
      .select(['garage_arrived_at', 'client_arrived_at', 'client_id', 'garage_id', 'status'])
      .where('id', '=', requestId)
      .executeTakeFirstOrThrow();

    const bothArrived =
      current.garage_arrived_at !== null && current.client_arrived_at !== null;

    if (bothArrived && current.status !== 'closed') {
      await trx
        .updateTable('assistance_requests')
        .set({ status: 'closed', closed_at: new Date() })
        .where('id', '=', requestId)
        .execute();

      await appendEvent(trx, {
        requestId,
        type: 'closed',
        actorUserId: userId,
        actorRole: role,
      });

      if (current.garage_id) {
        // Un refus de crédit (fraude suspectée) ne remet jamais en cause la
        // clôture, qui est un fait constaté par les deux parties.
        await awardForClosedRequest(trx, {
          requestId,
          clientId: current.client_id,
          garageId: current.garage_id,
        });
      }
    } else if (!bothArrived && current.status === 'en_route') {
      await trx
        .updateTable('assistance_requests')
        .set({ status: 'awaiting_confirmation' })
        .where('id', '=', requestId)
        .execute();
    }

    return selectRequest(trx).where('r.id', '=', requestId).executeTakeFirstOrThrow();
  });

  bus.emit('request:changed', {
    requestId,
    seq: updated.last_seq,
    type: updated.status === 'closed' ? 'closed' : 'arrival_confirmed',
    actorRole: role,
  });

  return toAssistanceRequest(updated);
}

export async function cancelRequest(
  requestId: string,
  userId: string,
  reason: string,
): Promise<AssistanceRequest> {
  const { request, role } = await loadAsParty(requestId, userId);
  if (isTerminal(request.status)) {
    throw conflict('INVALID_STATE_TRANSITION', 'Cette demande est déjà terminée');
  }

  return applyTransition({
    requestId,
    userId,
    role,
    next: 'cancelled',
    patch: { cancelled_at: new Date(), cancel_reason: reason },
    eventType: 'cancelled',
    payload: { reason },
  });
}

type TransitionParams = {
  requestId: string;
  userId: string;
  role: PartyRole;
  next: RequestStatus;
  patch: Record<string, unknown>;
  eventType: Parameters<typeof appendEvent>[1]['type'];
  payload?: unknown;
  /**
   * Garage à prévenir, quand la transition vient de le détacher.
   *
   * Voir `RequestChangedEvent.garageId` : sans lui, un refus n'atteint jamais
   * l'atelier qui l'a prononcé, puisque la demande ne le désigne plus.
   */
  notifyGarageId?: string | null;
};

async function applyTransition(params: TransitionParams): Promise<AssistanceRequest> {
  const updated = await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('assistance_requests')
      .set({ status: params.next, ...params.patch })
      .where('id', '=', params.requestId)
      .execute();

    await appendEvent(trx, {
      requestId: params.requestId,
      type: params.eventType,
      actorUserId: params.userId,
      actorRole: params.role,
      payload: params.payload,
    });

    return selectRequest(trx).where('r.id', '=', params.requestId).executeTakeFirstOrThrow();
  });

  bus.emit('request:changed', {
    requestId: params.requestId,
    seq: updated.last_seq,
    type: params.eventType,
    actorRole: params.role,
    garageId: params.notifyGarageId,
  });

  return toAssistanceRequest(updated);
}

/**
 * Vue complète d'une demande.
 *
 * C'est aussi la route du **mode dégradé** : quand le socket tombe, le mobile
 * appelle celle-ci toutes les 15 s. Elle doit donc contenir tout ce que le
 * temps réel enverrait, y compris les deux ETA et `lastSeq`.
 */
/**
 * Demande en cours du client, ou `null`.
 *
 * Existe pour que le mobile puisse poser la question **avant** d'ouvrir le
 * formulaire de déclaration. Sans elle, la seule façon d'apprendre qu'une
 * demande est déjà ouverte était de remplir les trois étapes et de se heurter
 * à `REQUEST_ALREADY_ACTIVE` à l'envoi — un mur en fin de parcours, sans
 * aucun moyen de retrouver la demande responsable.
 *
 * Renvoie le **détail complet** et non un simple booléen : l'appelant en a
 * besoin dans la foulée pour rouvrir l'écran correspondant à l'avancement,
 * et un second aller-retour sur un réseau camerounais est un aller-retour de
 * trop.
 */
export async function getActiveRequest(userId: string): Promise<RequestDetail | null> {
  const active = await findActiveRequestForClient(db, userId);
  if (!active) return null;
  return getRequestDetail(active.id, userId);
}

export async function getRequestDetail(
  requestId: string,
  userId: string,
): Promise<RequestDetail> {
  const { request, role } = await loadAsParty(requestId, userId);
  void role;

  const garage = request.garage_id ? await findGarageSummaryById(db, request.garage_id) : null;
  const positions = await findLatestPositions(db, requestId);

  const origin = { lat: Number(request.origin_lat), lng: Number(request.origin_lng) };
  const garageLocation = garage ? { lat: Number(garage.lat), lng: Number(garage.lng) } : null;

  const tracking = computeTracking(positions, { clientOrigin: origin, garageLocation });

  const client = await db
    .selectFrom('users')
    .select(['id', 'full_name', 'phone', 'avatar_url'])
    .where('id', '=', request.client_id)
    .executeTakeFirstOrThrow();

  // Requête séparée plutôt qu'une jointure : `vehicle_id` est facultatif, et
  // une jointure conditionnelle sur une colonne nullable se lit mal pour un
  // gain nul à cette échelle.
  const vehicle = request.vehicle_id
    ? await db
        .selectFrom('vehicles')
        .select(['brand', 'model', 'plate'])
        .where('id', '=', request.vehicle_id)
        .executeTakeFirst()
    : null;

  const mechanic =
    garage?.owner_user_id !== null && garage?.owner_user_id !== undefined
      ? await db
          .selectFrom('users')
          .select(['id', 'full_name', 'phone', 'avatar_url'])
          .where('id', '=', garage.owner_user_id)
          .executeTakeFirst()
      : undefined;

  const clientParty: RequestParty = {
    userId: client.id,
    fullName: client.full_name,
    initials: initialsOf(client.full_name),
    phone: client.phone,
    avatarUrl: client.avatar_url,
    rating: null,
    vehicleLabel:
      vehicle && (vehicle.brand || vehicle.model)
        ? [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
        : null,
    plate: vehicle?.plate ?? null,
  };

  const mechanicParty: RequestParty | null = mechanic
    ? {
        userId: mechanic.id,
        fullName: mechanic.full_name,
        initials: initialsOf(mechanic.full_name),
        phone: mechanic.phone ?? garage?.phone ?? null,
        avatarUrl: mechanic.avatar_url,
        rating: garage ? Number(garage.rating) : null,
        vehicleLabel: null,
        plate: null,
      }
    : null;

  const garageSummary: Omit<GarageSummary, 'rank'> | null = garage
    ? {
        id: garage.id,
        name: garage.name,
        certified: garage.certified,
        rating: Number(garage.rating),
        reviewCount: garage.review_count,
        distanceM: tracking.toGarage.distanceM ?? 0,
        etaMin: tracking.toGarage.etaMin ?? estimateEtaMinutes(0),
        lat: Number(garage.lat),
        lng: Number(garage.lng),
        addressLabel: garage.address_label,
        quarter: garage.quarter,
        phone: garage.phone,
        services: garage.services as Service[],
        photos: garage.photos,
        openNow: garage.open_now,
      }
    : null;

  return {
    ...toAssistanceRequest(request),
    garage: garageSummary,
    client: clientParty,
    mechanic: mechanicParty,
    tracking,
  };
}

/**
 * Enregistre une position.
 *
 * Exposé aussi en HTTP, et pas seulement par le socket : c'est le chemin de
 * repli quand le socket est tombé mais que le réseau permet encore une requête.
 */
export async function recordPosition(
  requestId: string,
  userId: string,
  position: Position,
): Promise<void> {
  const { request, role } = await loadAsParty(requestId, userId);

  if (isTerminal(request.status)) {
    throw conflict('INVALID_STATE_TRANSITION', 'Cette demande est terminée');
  }

  await insertPing(db, {
    requestId,
    userId,
    role,
    position: { lat: position.lat, lng: position.lng },
    speedMps: position.speedMps,
    headingDeg: position.headingDeg,
    accuracyM: position.accuracyM,
    recordedAt: new Date(position.recordedAt),
  });

  bus.emit('request:position', { requestId });
}

/**
 * Trajet d'approche du garagiste, servi **aux deux parties**.
 *
 * Le garagiste a déjà `GET /:id/route`, où il fournit son départ. Le client, lui,
 * ne peut pas : il ne connaît pas la position du dépanneur, et rien ne
 * justifierait de la lui faire transiter pour qu'il la renvoie. Le serveur
 * prend donc le **dernier point émis par le garage** — exactement la source de
 * l'ETA du suivi — et trace depuis là.
 *
 * Une seule vérité, donc : le kilométrage que le client lit est celui que le
 * garagiste conduit, calculé par le même moteur avec les mêmes points. Deux
 * calculs séparés auraient fini par afficher deux distances différentes pour un
 * même trajet, et il n'y aurait eu aucun moyen de dire laquelle avait raison.
 *
 * Sans aucun point émis, on part de l'adresse de l'atelier et `fromLive` le
 * dit. C'est le cas des premières secondes après l'acceptation.
 */
export async function getApproachRoute(
  requestId: string,
  userId: string,
): Promise<ApproachRoute> {
  const { request } = await loadAsParty(requestId, userId);

  if (request.accepted_at === null) {
    throw conflict('INVALID_STATE_TRANSITION', 'Aucun trajet tant que la demande n’est pas acceptée');
  }
  if (!request.garage_id) {
    throw notFound('GARAGE_NOT_FOUND', 'Aucun garage retenu sur cette demande');
  }

  const positions = await findLatestPositions(db, requestId);
  const garagePing = positions.find((position) => position.role === 'garage') ?? null;

  const garage = await findGarageSummaryById(db, request.garage_id);
  if (!garage) throw notFound('GARAGE_NOT_FOUND', 'Garage introuvable');

  const from = garagePing
    ? { lat: Number(garagePing.lat), lng: Number(garagePing.lng) }
    : { lat: Number(garage.lat), lng: Number(garage.lng) };

  const leg = await computeRoute(from, {
    lat: Number(request.origin_lat),
    lng: Number(request.origin_lng),
  });

  return { ...leg, fromLive: garagePing !== null };
}

export async function getHistory(userId: string, page: number, pageSize: number) {
  const total = await db
    .selectFrom('assistance_requests as r')
    .leftJoin('garages as g', 'g.id', 'r.garage_id')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where((eb) =>
      eb.or([eb('r.client_id', '=', userId), eb('g.owner_user_id', '=', userId)]),
    )
    .executeTakeFirstOrThrow();

  const rows = await selectRequest(db)
    .leftJoin('garages as g', 'g.id', 'r.garage_id')
    .leftJoin('reviews as rev', 'rev.request_id', 'r.id')
    // Le demandeur est toujours présent : la colonne est NOT NULL et la clé
    // étrangère cascade. D'où une jointure interne, qui ne peut pas perdre de
    // ligne — contrairement au garage, facultatif tant que la demande est
    // `pending`.
    .innerJoin('users as cu', 'cu.id', 'r.client_id')
    .select([
      'g.name as garage_name',
      'g.certified as garage_certified',
      'cu.full_name as client_name',
      'rev.id as review_id',
      /**
       * De quel côté est l'appelant.
       *
       * Calculé en SQL, dans la requête qui filtre déjà sur cette condition :
       * le `OR` du `WHERE` et ce `CASE` disent la même chose, et les garder
       * ensemble empêche qu'ils divergent. Le déduire côté mobile aurait
       * marché aussi — mais il aurait fallu le refaire dans chaque écran, et
       * chacun l'aurait fait un peu différemment.
       */
      sql<PartyRole>`CASE WHEN r.client_id = ${userId} THEN 'client' ELSE 'garage' END`.as(
        'party_role',
      ),
    ])
    .where((eb) =>
      eb.or([eb('r.client_id', '=', userId), eb('g.owner_user_id', '=', userId)]),
    )
    .orderBy('r.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return {
    results: rows.map((row) => ({
      ...toAssistanceRequest(row as RequestRecord),
      role: row.party_role,
      garageName: row.garage_name,
      garageCertified: row.garage_certified,
      clientName: row.client_name,
      reviewed: row.review_id !== null,
    })),
    page,
    pageSize,
    total: Number(total.count),
  };
}

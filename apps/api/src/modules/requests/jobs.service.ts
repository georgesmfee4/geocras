import {
  compareIncomingJobs,
  estimateEtaMinutes,
  snapToPrivacyGrid,
  type Job,
  type JobsResponse,
  type LatLng,
  type ProblemType,
  type RouteLeg,
  type UrgencyLevel,
} from '@geocras/shared';
import { db } from '../../db/client';
import { forbidden, notFound } from '../../lib/errors';
import { computeRoute } from '../routing/routing.service';
import {
  findGarageJobs,
  findGarageOwnedBy,
  findRequestById,
  resolveParty,
} from './requests.repo';

/**
 * La file de travail du garagiste.
 *
 * Fichier distinct de `requests.service` alors que les deux parlent des mêmes
 * lignes : ce ne sont pas les mêmes règles. `requests.service` sert le client
 * et fait avancer la machine à états ; ici on ne fait que **montrer**, à
 * l'autre partie, et sous une contrainte que le client n'a pas — ce que le
 * garage a le droit de savoir dépend de ce qu'il a déjà accepté.
 */

type JobRow = Awaited<ReturnType<typeof findGarageJobs>>[number];

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function toJob(row: JobRow): Job {
  const iso = (value: Date | null | undefined) =>
    value === null || value === undefined ? null : new Date(value).toISOString();

  /**
   * L'acceptation est la bascule de confidentialité.
   *
   * On la lit sur `accepted_at` et non sur le statut : c'est le fait daté qui
   * s'est produit — le garage s'est engagé —, et il survit aux états
   * suivants sans qu'on ait à les énumérer.
   */
  const accepted = row.accepted_at !== null;

  const exact = { lat: Number(row.origin_lat), lng: Number(row.origin_lng) };
  const distanceM = Number(row.distance_m);

  const vehicleLabel =
    row.vehicle_brand || row.vehicle_model
      ? [row.vehicle_brand, row.vehicle_model].filter(Boolean).join(' ')
      : null;

  return {
    id: row.id,
    status: row.status,
    problemType: row.problem_type as ProblemType,
    vehicleType: row.vehicle_type,
    vehicleLabel: row.vehicle_label,
    description: row.description,
    urgency: row.urgency as UrgencyLevel,
    immobilized: row.immobilized,
    vulnerablePassengers: row.vulnerable_passengers,
    photos: row.photo_url ? [row.photo_url] : [],

    origin: accepted
      ? exact
      : { lat: snapToPrivacyGrid(exact.lat), lng: snapToPrivacyGrid(exact.lng) },
    originPrecise: accepted,
    distanceM,
    etaMin: estimateEtaMinutes(distanceM),

    createdAt: new Date(row.created_at).toISOString(),
    selectedAt: iso(row.selected_at),
    acceptedAt: iso(row.accepted_at),
    enRouteAt: iso(row.en_route_at),
    garageArrivedAt: iso(row.garage_arrived_at),
    clientArrivedAt: iso(row.client_arrived_at),

    client: {
      fullName: row.client_name,
      initials: initialsOf(row.client_name),
      // La promesse faite au client sur son écran d'attente, tenue ici : son
      // numéro n'existe pas dans la réponse tant que le garage n'a pas accepté.
      phone: accepted ? row.client_phone : null,
      avatarUrl: row.client_avatar,
      vehicleLabel,
      plate: accepted ? row.vehicle_plate : null,
    },

    lastSeq: row.last_seq,
  };
}

/**
 * Itinéraire du garagiste vers le lieu de la panne.
 *
 * Le départ est **fourni par l'appelant**, l'arrivée est **lue en base**. Cette
 * asymétrie est le cœur de la route :
 *
 *  - le départ ne peut venir que du téléphone, parce que le garagiste peut être
 *    chez lui, sur une autre intervention ou déjà sur la nationale — calculer
 *    depuis l'adresse de l'atelier donnerait une durée fausse la plupart du
 *    temps ;
 *  - l'arrivée ne doit jamais venir du client de l'API. Si elle voyageait en
 *    paramètre, cette route deviendrait un moyen d'obtenir un itinéraire vers
 *    n'importe quel point en s'authentifiant, et surtout de contourner
 *    l'arrondi qui protège la position du demandeur.
 *
 * D'où le refus tant que la demande n'est pas acceptée : avant l'engagement du
 * garage, la position exacte n'existe pas dans ce qu'on lui envoie, et un
 * itinéraire la lui rendrait au mètre près.
 */
export async function getJobRoute(
  requestId: string,
  userId: string,
  from: LatLng,
): Promise<RouteLeg> {
  const request = await findRequestById(db, requestId);
  if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable');

  const role = await resolveParty(db, requestId, userId);
  if (role !== 'garage') throw forbidden('Seul le garage retenu peut demander cet itinéraire');

  if (request.accepted_at === null) {
    throw forbidden('Acceptez la demande pour obtenir l’itinéraire exact');
  }

  return computeRoute(from, {
    lat: Number(request.origin_lat),
    lng: Number(request.origin_lng),
  });
}

/**
 * File de travail du garage détenu par ce compte, ou `null` s'il n'en détient
 * aucun.
 *
 * `null` plutôt qu'une exception, parce que les deux appelants n'en font pas la
 * même chose : la route HTTP le traduit en 404, la couche temps réel n'a
 * simplement personne à prévenir. Faire lever une erreur ici obligerait le
 * diffuseur à rattraper une exception dans son cas nominal.
 *
 * L'appartenance vient de `owner_user_id` en base et jamais du rôle porté par
 * le jeton : celui-ci date de la connexion, et un garagiste inscrit depuis
 * serait refusé sur sa propre file jusqu'au prochain rafraîchissement.
 */
export async function getJobsForOwner(userId: string): Promise<JobsResponse | null> {
  const garage = await findGarageOwnedBy(db, userId);
  if (!garage) return null;

  const jobs = (await findGarageJobs(db, garage.id)).map(toJob);

  /** Le temps d'attente commence au choix du garage, jamais à l'ouverture du SOS. */
  const waitingSince = (job: Job) => Date.parse(job.selectedAt ?? job.createdAt);

  return {
    garage: {
      id: garage.id,
      name: garage.name,
      certified: garage.certified,
      isActive: garage.is_active,
    },
    incoming: jobs.filter((job) => job.status === 'selected').sort(compareIncomingJobs),
    // Les engagements en cours se lisent dans l'ordre où ils ont été pris : le
    // plus ancien d'abord, c'est celui qu'on finit en premier. L'urgence ne les
    // réordonne pas — elle sert à choisir, et le choix est déjà fait.
    active: jobs
      .filter((job) => job.status !== 'selected')
      .sort((a, b) => waitingSince(a) - waitingSince(b)),
  };
}

import type { Transaction } from 'kysely';
import {
  commissionXaf,
  proveArrival,
  serviceGeometry,
  tariffClassOf,
  type ArrivalProof,
} from '@geocras/shared';
import { latOf, lngOf } from '../../db/geo';
import type { Database } from '../../db/types';
import { logger } from '../../lib/logger';
import { findTrail, hasEarlierClosedPair } from './requests.repo';

/**
 * Écriture du registre des commissions.
 *
 * **Rien n'est prélevé.** Cette phase est une observation : à chaque clôture on
 * écrit ce qu'on *aurait* facturé, et on n'y touche plus. Au bout de deux mois
 * de données réelles, le relevé mensuel dira ce que le barème doit devenir — et
 * le basculement ne coûtera qu'une constante dans `TARIFF_XAF`.
 *
 * L'écriture se fait dans **la transaction de la clôture**, comme le crédit de
 * fidélité juste à côté. Ce n'est pas un détail de forme : si l'intervention est
 * close, la ligne existe ; si la transaction échoue, il n'y a ni clôture ni
 * ligne. Aucun état intermédiaire où une demande serait terminée sans que le
 * registre le sache.
 */

/**
 * Clé d'idempotence d'une ligne de commission.
 *
 * Même principe que `ledgerIdempotencyKey` pour les points, et même raison : la
 * clôture peut être rejouée — reprise après incident, double appel d'un client
 * qui a mal lâché son écran — et une commission facturée deux fois pour une
 * seule intervention serait indéfendable.
 */
export function commissionIdempotencyKey(requestId: string): string {
  return `commission:${requestId}`;
}

/**
 * Pourquoi une intervention n'a fait naître aucune dette.
 *
 * Écrit en clair dans la ligne plutôt que déduit du niveau de preuve : trois
 * mois plus tard, devant un garagiste qui conteste, on lit un motif et non un
 * code à réinterpréter.
 */
const WAIVED_REASONS: Record<string, string> = {
  none: "Aucune trace n'établit qu'un déplacement a eu lieu",
  weak: 'Trajet trop court ou intervention trop brève pour être facturée',
};

export type CommissionOutcome =
  | { written: true; amountXaf: number; proof: ArrivalProof }
  | { written: false; reason: 'no_garage' | 'duplicate' };

/**
 * Inscrit au registre ce que cette intervention a coûté au garage.
 *
 * Appelée une seule fois, à la clôture, depuis la transaction qui vient de faire
 * passer la demande en `closed`.
 *
 * Une ligne est écrite **même quand rien n'est dû** : c'est tout l'intérêt d'un
 * registre d'observation. Savoir combien d'interventions réelles échouent à la
 * preuve est exactement ce qu'on cherche à mesurer avant de facturer quoi que ce
 * soit — une ligne manquante ne se compte pas.
 */
export async function recordCommission(
  trx: Transaction<Database>,
  params: { requestId: string; clientId: string; garageId: string | null },
): Promise<CommissionOutcome> {
  if (!params.garageId) return { written: false, reason: 'no_garage' };

  const request = await trx
    .selectFrom('assistance_requests')
    .select([
      'problem_type',
      'immobilized',
      'service_mode',
      'en_route_at',
      'closed_at',
      'garage_arrived_at',
      'client_arrived_at',
      // Projection explicite : le type de la colonne `origin` est hostile en
      // lecture, ce qui force ce passage et evite qu'une latitude et une
      // longitude soient un jour lues dans le mauvais ordre.
      latOf('origin').as('origin_lat'),
      lngOf('origin').as('origin_lng'),
    ])
    .where('id', '=', params.requestId)
    .executeTakeFirstOrThrow();

  /*
    L'adresse de l'atelier, lue dans la même transaction que la demande.

    Elle ne sert qu'en `at_garage`, où elle **est** le point d'arrivée. La
    charger dans tous les cas plutôt que sous condition coûte une lecture par
    clôture et supprime un chemin d'exécution : un `if` qui décide s'il faut
    lire la destination avant de savoir laquelle est exactement le genre de
    nœud dont on finit par oublier une branche.
  */
  const garage = await trx
    .selectFrom('garages')
    .select([latOf('location').as('lat'), lngOf('location').as('lng')])
    .where('id', '=', params.garageId)
    .executeTakeFirst();

  /*
    Qui s'est déplacé, et vers quoi. Toute la différence entre les deux modes
    tient dans ces deux valeurs — le reste du calcul est rigoureusement
    identique, et c'est ce qui garantit qu'un client venu à l'atelier est
    éprouvé avec la même sévérité qu'un garagiste venu au bord de la route.
  */
  const geometry = serviceGeometry(request.service_mode, {
    origin: { lat: Number(request.origin_lat), lng: Number(request.origin_lng) },
    garageLocation: garage ? { lat: Number(garage.lat), lng: Number(garage.lng) } : null,
  });

  const trail = geometry ? await findTrail(trx, params.requestId, geometry.traveller) : [];

  const proof = proveArrival({
    pings: trail,
    // Sans géométrie — atelier introuvable en `at_garage` — on mesure vers le
    // lieu de la panne avec une trace vide : la preuve rend `none`, aucune
    // dette ne naît, et le motif écrit dans la ligne le dira.
    destination:
      geometry?.destination ??
      { lat: Number(request.origin_lat), lng: Number(request.origin_lng) },
    enRouteAt: request.en_route_at ? new Date(request.en_route_at).toISOString() : null,
    // À la clôture, `closed_at` vient d'être posé : c'est la borne la plus sûre.
    until: request.closed_at ? new Date(request.closed_at).toISOString() : null,
    acknowledged:
      request.garage_arrived_at !== null && request.client_arrived_at !== null,
  });

  /*
    Ce client est-il déjà venu chez ce garage par GeoCras ?

    La demande courante est **exclue** de ce comptage : elle vient de passer en
    `closed` dans cette même transaction, et la compter ferait de toute première
    intervention une intervention répétée — donc la moitié du tarif dès le
    premier client apporté, exactement à l'inverse de ce que la remise veut
    encourager.
  */
  const repeatPair = await hasEarlierClosedPair(trx, {
    clientId: params.clientId,
    garageId: params.garageId,
    excludeRequestId: params.requestId,
  });

  const tariffClass = tariffClassOf(request.problem_type, request.immobilized);
  const amountXaf = proof.billable ? commissionXaf({ tariffClass, repeatPair }) : 0;

  const inserted = await trx
    .insertInto('commission_ledger')
    .values({
      garage_id: params.garageId,
      request_id: params.requestId,
      client_id: params.clientId,
      amount_xaf: amountXaf,
      tariff_class: tariffClass,
      proof_level: proof.level,
      // Sans lui, `travelled_m` est un nombre sans sujet : quatre kilomètres
      // parcourus par qui ? Cf. migration 0009.
      service_mode: request.service_mode,
      repeat_pair: repeatPair,
      problem_type: request.problem_type,
      travelled_m: proof.travelledMeters,
      dwell_s: proof.dwellSeconds,
      closest_m: proof.closestMeters,
      state: proof.billable ? 'pending' : 'waived',
      state_reason: proof.billable ? null : (WAIVED_REASONS[proof.level] ?? 'Preuve insuffisante'),
      idempotency_key: commissionIdempotencyKey(params.requestId),
    })
    // Rejeu inoffensif, comme sur le journal de fidélité.
    .onConflict((conflict) => conflict.column('idempotency_key').doNothing())
    .returning('id')
    .executeTakeFirst();

  if (!inserted) return { written: false, reason: 'duplicate' };

  logger.info(
    {
      requestId: params.requestId,
      garageId: params.garageId,
      amountXaf,
      proofLevel: proof.level,
      repeatPair,
      serviceMode: request.service_mode,
    },
    'Commission inscrite au registre',
  );

  return { written: true, amountXaf, proof };
}


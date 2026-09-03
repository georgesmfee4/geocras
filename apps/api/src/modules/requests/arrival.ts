import {
  noArrivalProof,
  proveArrival,
  serviceGeometry,
  type ArrivalProof,
} from '@geocras/shared';
import { db } from '../../db/client';
import { findGarageSummaryById, findRequestById, findTrail } from './requests.repo';

/**
 * Instruit la preuve d'arrivée d'une demande.
 *
 * Ce module ne facture rien et n'écrit rien : il **constate**. Le registre des
 * commissions viendra le lire au moment de la clôture ; en attendant, il tourne
 * à vide, et c'est délibéré — la dérivation se valide en rétroactif sur des
 * interventions déjà terminées, où l'on sait par ailleurs si le garage est venu.
 * On connaîtra donc son taux de faux positifs et de faux négatifs **avant**
 * qu'un franc en dépende.
 *
 * Toute la règle vit dans `proveArrival`, côté contrat partagé, sans base ni
 * réseau. Ici il ne reste que la lecture : charger la trace et les trois
 * horodatages qui bornent la fenêtre.
 *
 * ---
 *
 * **Quelle trace, et vers quel point ?** C'est `serviceGeometry` qui répond, à
 * partir du mode de service de la demande. Lire en dur la trace du garage
 * mesurée vers le lieu de la panne — ce que faisait ce module avant la
 * migration 0009 — rendrait `none` sur toutes les interventions `at_garage` :
 * le garagiste n'a pas bougé, sa trace est vide, et un client réellement venu
 * à l'atelier ne serait jamais facturable.
 */

/**
 * Fin connue de la demande, pour borner la lecture de la trace.
 *
 * Trois sources, de la plus sûre à la plus faible :
 *
 *  1. `closed_at` — les deux parties ont confirmé, l'affaire est réglée ;
 *  2. la première confirmation reçue, celle du client comme celle du garage.
 *     Prendre la plus ancienne des deux et non celle du garage seul est ce qui
 *     empêche le débiteur de raccourcir la fenêtre en retenant son propre
 *     bouton ;
 *  3. `null` — rien ne dit encore que l'intervention est finie, et il n'y a donc
 *     rien à prouver.
 *
 * L'annulation ne figure pas dans la liste : une demande annulée n'a pas
 * d'arrivée, et lui en chercher une reviendrait à facturer un dépannage qui n'a
 * pas eu lieu.
 */
function knownEnd(request: {
  closed_at: Date | null;
  garage_arrived_at: Date | null;
  client_arrived_at: Date | null;
}): string | null {
  if (request.closed_at) return new Date(request.closed_at).toISOString();

  const confirmations = [request.garage_arrived_at, request.client_arrived_at]
    .filter((value): value is Date => value !== null)
    .map((value) => new Date(value).getTime());

  if (confirmations.length === 0) return null;
  return new Date(Math.min(...confirmations)).toISOString();
}

/**
 * La preuve d'arrivée du garage sur cette demande, ou `null` si la demande
 * n'existe pas.
 *
 * Une demande sans garage retenu rend une preuve vide plutôt que `null` : il n'y
 * a rien à prouver, mais la question était légitime — et l'appelant n'a pas à
 * distinguer « demande introuvable » de « personne n'est venu ».
 */
export async function arrivalProofFor(requestId: string): Promise<ArrivalProof | null> {
  const request = await findRequestById(db, requestId);
  if (!request) return null;

  const garage = request.garage_id ? await findGarageSummaryById(db, request.garage_id) : null;

  const geometry = serviceGeometry(request.service_mode, {
    origin: { lat: Number(request.origin_lat), lng: Number(request.origin_lng) },
    garageLocation: garage ? { lat: Number(garage.lat), lng: Number(garage.lng) } : null,
  });

  // `at_garage` sans garage retenu : on ne sait pas où le client devait se
  // rendre, donc on n'affirme rien. C'est le même vide que « personne n'est
  // venu », et l'appelant n'a pas à distinguer les deux.
  if (!geometry) return noArrivalProof();

  const trail = await findTrail(db, requestId, geometry.traveller);

  return proveArrival({
    pings: trail,
    destination: geometry.destination,
    enRouteAt: request.en_route_at ? new Date(request.en_route_at).toISOString() : null,
    until: knownEnd(request),
    // Les deux confirmations reçues : c'est exactement l'état `closed`, et c'est
    // ce qui distingue « le GPS dit qu'il est venu » de « le GPS le dit et les
    // deux parties en conviennent ». Une facture se conteste ; le niveau de
    // preuve est ce qu'on produit alors.
    acknowledged: request.garage_arrived_at !== null && request.client_arrived_at !== null,
  });
}

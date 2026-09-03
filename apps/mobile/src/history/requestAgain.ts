import { isRequestOngoing, type RequestStatus } from '@geocras/shared';

/**
 * Ce qu'il faut savoir d'une demande pour décider si on peut y refaire appel.
 *
 * Volontairement plus étroit que `HistoryRequest` : la règle ne lit que trois
 * champs, et les énumérer ici la rend vérifiable sans fabriquer une demande
 * complète — véhicule, photos, horodatages et le reste n'y changent rien.
 */
export type RecallCandidate = {
  /** De quel côté ce compte se trouvait. Vient du serveur, jamais déduit. */
  role: 'client' | 'garage';
  status: RequestStatus;
  /** `null` sur une demande sans garage retenu, ou dont le garage a refusé. */
  garageId: string | null;
};

/**
 * Peut-on refaire appel au garage de cette demande ?
 *
 * Trois conditions, et chacune écarte un cas où l'action mentirait :
 *
 *  - **côté client seulement.** Un garagiste ne se convoque pas lui-même. Son
 *    historique mêle les deux points de vue — un garagiste tombe aussi en
 *    panne — d'où la lecture du rôle plutôt qu'une hypothèse sur le compte ;
 *  - **demande terminée.** La base n'autorise qu'une demande active par client
 *    (`requests_one_active_per_client_idx`) : proposer d'en ouvrir une seconde
 *    pendant qu'une intervention court promettrait quelque chose que le serveur
 *    refuse. L'écran a déjà « Reprendre le suivi » pour ce cas ;
 *  - **un garage connu.** Une demande annulée avant tout choix n'en a pas. Un
 *    refus non plus, d'ailleurs : le serveur remet `garage_id` à `null` en
 *    détachant le garage, donc l'action disparaît d'elle-même sur une demande
 *    refusée — ce qui est le bon comportement, il n'y a personne à rappeler.
 *
 * Fonction pure et sans dépendance à React : c'est ce qui la rend testable dans
 * un projet qui ne monte volontairement aucun composant.
 */
export function canRequestAgain(request: RecallCandidate): boolean {
  if (request.role === 'garage') return false;
  if (isRequestOngoing(request.status)) return false;
  return request.garageId !== null;
}

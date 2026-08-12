import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { RequestDetail, RequestStatus } from '@geocras/shared';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/queryClient';
import { useAuth } from '../auth/AuthProvider';

/**
 * Point d'entrée du service SOS.
 *
 * Le bouton SOS de l'accueil ne mène plus directement au formulaire : il
 * demande d'abord au serveur si une demande est déjà ouverte. La base impose
 * une seule demande active par client (`requests_one_active_per_client_idx`),
 * et sans cette vérification préalable on découvrait la règle **à la fin** des
 * trois étapes de saisie, par un refus `REQUEST_ALREADY_ACTIVE` qui ne disait
 * même pas où retrouver la demande fautive.
 */

/**
 * Écran à rouvrir selon l'avancement.
 *
 * C'est la traduction de la machine à états en destinations. `pending` veut
 * dire qu'aucun garage n'a encore été choisi : on rouvre la liste de résultats.
 * Dès qu'un garage est retenu, tout se joue sur l'écran de suivi.
 */
export function screenForStatus(
  status: RequestStatus,
  requestId: string,
  /**
   * Garage ouvert par l'utilisateur avant de demander de l'aide.
   *
   * Ne vaut que pour une demande encore `pending` : dès qu'un garage a été
   * retenu, la question de savoir lequel mettre en tête ne se pose plus.
   */
  preferredGarageId?: string,
): string {
  switch (status) {
    case 'pending':
      return preferredGarageId
        ? `/sos/resultats?requestId=${requestId}&garage=${preferredGarageId}`
        : `/sos/resultats?requestId=${requestId}`;
    case 'selected':
    case 'accepted':
    case 'en_route':
    case 'awaiting_confirmation':
      return `/suivi/${requestId}`;
    default:
      // `closed` et `cancelled` ne sont jamais « actifs » : si on arrive ici,
      // c'est que le serveur a changé d'avis entre-temps. On repart du
      // formulaire plutôt que d'ouvrir un écran de suivi terminé.
      return '/sos/declarer';
  }
}

/**
 * Route du formulaire de déclaration, avec le garage préféré s'il y en a un.
 *
 * Le paramètre traverse ensuite les trois étapes et ressort dans l'URL des
 * résultats. Le faire voyager par l'URL plutôt que par un état global a une
 * conséquence qui vaut le détour : la demande reste **rejouable** — un lien
 * profond, un retour depuis l'historique ou une reprise de demande ouverte
 * retrouvent le même contexte sans mémoire cachée à synchroniser.
 */
function declarerRoute(
  preferredGarageId?: string,
): '/sos/declarer' | `/sos/declarer?garage=${string}` {
  return preferredGarageId ? `/sos/declarer?garage=${preferredGarageId}` : '/sos/declarer';
}

export type SosEntryState = {
  /** La vérification est en cours — la modale de recherche est affichée. */
  checking: boolean;
  /**
   * À appeler depuis le bouton SOS.
   *
   * L’argument est facultatif et ne change **rien** au parcours : il désigne
   * simplement un garage que l’utilisateur venait de consulter, à mettre en
   * tête des résultats une fois la panne décrite. Le bouton SOS de la carte
   * appelle la même fonction sans argument, et suit exactement le chemin
   * qu’il suivait avant.
   */
  start: (preferredGarageId?: string) => void;
};

export function useSosEntry(): SosEntryState {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status: authStatus } = useAuth();
  const [checking, setChecking] = useState(false);

  const start = useCallback((preferredGarageId?: string) => {
    // Sans compte, la question n'a pas de sens : le serveur répondrait 401 et
    // il n'y a de toute façon pas de demande rattachée à personne. On envoie
    // au formulaire, qui porte déjà l'écran « connexion requise ».
    if (authStatus !== 'authenticated') {
      router.push(declarerRoute(preferredGarageId));
      return;
    }

    setChecking(true);

    void (async () => {
      try {
        const { request } = await api.requests.active();

        if (request) {
          // On sème le cache avant de naviguer : l'écran de destination trouve
          // sa demande déjà chargée et s'ouvre sur du contenu, pas sur un
          // second sablier juste après celui de la modale.
          queryClient.setQueryData<RequestDetail>(
            queryKeys.requests.detail(request.id),
            request,
          );
          queryClient.setQueryData(queryKeys.requests.active(), { request });

          router.push(screenForStatus(request.status, request.id, preferredGarageId) as never);
          return;
        }

        router.push(declarerRoute(preferredGarageId));
      } catch {
        // Réseau muet, jeton expiré : on n'a pas pu savoir. On ouvre quand
        // même le formulaire — refuser l'accès au SOS parce qu'une
        // vérification de confort a échoué serait le pire des arbitrages sur
        // un service d'urgence. Le serveur reste le garde-fou : il refusera la
        // création s'il y a bien une demande ouverte.
        router.push(declarerRoute(preferredGarageId));
      } finally {
        setChecking(false);
      }
    })();
  }, [authStatus, router, queryClient]);

  return { checking, start };
}

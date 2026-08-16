import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { EMISSION, jobsResponseSchema, SOCKET_EVENTS, type JobsResponse } from '@geocras/shared';
import { useGarageJobs } from '../api/hooks';
import { queryClient, queryKeys } from '../api/queryClient';
import { usePreferences } from '../settings/preferences';
import { getSocket } from './socket';

/**
 * Réception des SOS adressés au garage.
 *
 * Le pendant de `useTracking`, pour l'autre partie et à l'envers : le client
 * suit **une** demande qu'il connaît déjà, le garagiste attend **celle qui
 * n'existe pas encore**. Il ne peut donc rejoindre aucune room — le serveur
 * pousse sa file dans une room à son nom, qu'il rejoint dès la connexion du
 * socket.
 *
 * Trois choses ici, et une seule fois dans l'app — voir l'appel unique dans la
 * barre d'onglets :
 *
 *  1. **Écoute** de la file poussée, écrite directement dans le cache de Query
 *     pour que tous les écrans la lisent au même endroit.
 *  2. **Repli** en sondage HTTP quand la liaison tombe. Sans lui, un garagiste
 *     dont le socket a lâché ne verrait plus jamais arriver un SOS — l'écran
 *     resterait vide, sans rien signaler.
 *  3. **Alerte** à l'arrivée d'une demande. Le téléphone d'un atelier est posé
 *     sur un établi, pas tenu en main : une liste qui se remplit en silence
 *     n'est pas une notification.
 */

type JobFeedState = {
  connection: 'connecting' | 'live' | 'degraded';
  setConnection: (connection: JobFeedState['connection']) => void;
};

/**
 * État de la liaison, hors de React Query.
 *
 * Un store minuscule plutôt qu'une valeur remontée par le hook : l'écran
 * Interventions doit pouvoir afficher « connexion instable » alors que c'est la
 * barre d'onglets, ailleurs dans l'arbre, qui tient l'abonnement.
 */
export const useJobFeedStore = create<JobFeedState>((set) => ({
  connection: 'connecting',
  setConnection: (connection) => set({ connection }),
}));

/** Identifiants des demandes reçues, pour repérer celles qui viennent d'arriver. */
function incomingIds(jobs: JobsResponse | undefined): Set<string> {
  return new Set((jobs?.incoming ?? []).map((job) => job.id));
}

export function useJobFeed(enabled: boolean) {
  const connection = useJobFeedStore((state) => state.connection);

  /**
   * Le sondage ne tourne **que** hors liaison temps réel : sonder en parallèle
   * du socket ferait payer deux fois la même liste sur un forfait qui se
   * compte.
   */
  const query = useGarageJobs({
    enabled,
    pollMs: connection === 'live' ? 0 : EMISSION.pollIntervalMs,
  });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      useJobFeedStore.getState().setConnection('connecting');
      return;
    }

    let cancelled = false;

    /**
     * Écouteurs définis hors de l'IIFE asynchrone.
     *
     * Une fonction de nettoyage renvoyée depuis un `async` est une promesse,
     * que React ignore : les écouteurs survivraient au démontage et
     * s'empileraient à chaque remontage — donc autant de vibrations que de
     * montages passés pour un seul SOS.
     */
    const onJobs = (raw: unknown): void => {
      const parsed = jobsResponseSchema.safeParse(raw);
      if (!parsed.success) return;

      const previous = queryClient.getQueryData<JobsResponse>(queryKeys.requests.garageJobs());
      queryClient.setQueryData<JobsResponse>(queryKeys.requests.garageJobs(), parsed.data);

      // Rien à signaler au tout premier envoi : à l'ouverture de l'app, la file
      // entière serait annoncée comme si elle venait d'arriver.
      if (!previous) return;

      const known = incomingIds(previous);
      const isNew = parsed.data.incoming.some((job) => !known.has(job.id));
      if (isNew && usePreferences.getState().haptics) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    };

    const onConnect = (): void => useJobFeedStore.getState().setConnection('live');
    const onDrop = (): void => useJobFeedStore.getState().setConnection('degraded');

    void (async () => {
      const socket = await getSocket();
      if (cancelled) return;

      socketRef.current = socket;
      socket.on('connect', onConnect);
      socket.on('disconnect', onDrop);
      socket.on('connect_error', onDrop);
      socket.on(SOCKET_EVENTS.jobs, onJobs);

      // Le serveur envoie la file à la connexion : rien à demander, il reste à
      // enregistrer l'état de la liaison si elle était déjà ouverte.
      if (socket.connected) onConnect();
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;

      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDrop);
        socket.off('connect_error', onDrop);
        socket.off(SOCKET_EVENTS.jobs, onJobs);
      }

      socketRef.current = null;
      useJobFeedStore.getState().setConnection('connecting');
    };
  }, [enabled]);

  return query;
}

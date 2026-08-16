import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import {
  EMISSION,
  SOCKET_EVENTS,
  statePayloadSchema,
  trackingPayloadSchema,
} from '@geocras/shared';
import { useRequestDetail } from '../api/hooks';
import { useLocation } from '../location/LocationProvider';
import { useTrackingStore } from '../stores/tracking';
import { getSocket, PositionEmitter } from './socket';

/**
 * Suivi bidirectionnel d'une intervention.
 *
 * Trois responsabilités, volontairement réunies pour qu'aucun écran n'ait à les
 * réimplémenter :
 *
 *  1. **Rattrapage après coupure** — on rejoint la room en annonçant le dernier
 *     `seq` connu, le serveur rejoue ce qui manque. Quarante secondes de tunnel
 *     ne cassent pas le suivi.
 *
 *  2. **Mode dégradé** — si le socket tombe, on bascule sur un sondage HTTP
 *     toutes les 15 s. L'écran ne change pas, seul le bandeau de connexion
 *     l'indique.
 *
 *  3. **Émission de sa propre position**, throttlée et conditionnée au
 *     déplacement réel.
 */
export function useTracking(requestId: string | null) {
  const { fix } = useLocation();
  const emitter = useRef<PositionEmitter | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connection = useTrackingStore((state) => state.connection);
  const lastSeq = useTrackingStore((state) => state.lastSeq);

  // Le sondage n'est actif QUE hors connexion temps réel : sonder en parallèle
  // du socket doublerait la consommation de données pour rien.
  const degraded = connection !== 'live';
  const detail = useRequestDetail(requestId, degraded ? EMISSION.pollIntervalMs : 0);

  // --- Socket : connexion, rattrapage, écoute ------------------------------
  useEffect(() => {
    if (!requestId) return;

    const store = useTrackingStore.getState();
    store.start(requestId);
    emitter.current = new PositionEmitter(requestId);

    let cancelled = false;

    // Les écouteurs sont définis ici, hors de l'IIFE asynchrone : une fonction
    // de nettoyage renvoyée depuis un `async` serait une promesse, que React
    // ignore — les écouteurs survivraient au démontage et s'accumuleraient à
    // chaque ouverture de l'écran de suivi.
    const onState = (raw: unknown): void => {
      const parsed = statePayloadSchema.safeParse(raw);
      if (parsed.success) useTrackingStore.getState().applyState(parsed.data);
    };

    const onTracking = (raw: unknown): void => {
      const parsed = trackingPayloadSchema.safeParse(raw);
      if (parsed.success) useTrackingStore.getState().applyTracking(parsed.data);
    };

    const onDisconnect = (): void => {
      useTrackingStore.getState().setConnection('degraded');
    };

    const join = (): void => {
      const socket = socketRef.current;
      if (!socket) return;
      useTrackingStore.getState().setConnection('live');
      socket.emit(SOCKET_EVENTS.join, {
        requestId,
        lastSeq: useTrackingStore.getState().lastSeq,
      });
    };

    void (async () => {
      const socket = await getSocket();
      // L'écran a pu être quitté pendant l'établissement de la connexion.
      if (cancelled) return;

      socketRef.current = socket;
      socket.on('connect', join);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onDisconnect);
      socket.on(SOCKET_EVENTS.state, onState);
      socket.on(SOCKET_EVENTS.tracking, onTracking);

      if (socket.connected) join();
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;

      if (socket) {
        socket.emit(SOCKET_EVENTS.leave, { requestId, lastSeq: 0 });
        socket.off('connect', join);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onDisconnect);
        socket.off(SOCKET_EVENTS.state, onState);
        socket.off(SOCKET_EVENTS.tracking, onTracking);
      }

      socketRef.current = null;
      emitter.current = null;
      useTrackingStore.getState().stop();
    };
  }, [requestId]);

  /**
   * Un changement d'état déclenche **une** relecture HTTP de la demande.
   *
   * Le socket transporte le statut, jamais les horodatages : ni `acceptedAt`,
   * ni `clientArrivedAt`, ni `closedAt`. Sans cette relecture, l'écran de
   * suivi apprenait par socket que l'intervention était close tout en gardant
   * un `closedAt` nul — le récapitulatif affichait donc une durée vide sur une
   * intervention manifestement terminée.
   *
   * Une requête par transition, soit quatre ou cinq sur toute la vie d'une
   * demande. C'est le contraire d'un sondage : on ne relit que quand quelque
   * chose a réellement changé, et le socket nous le dit.
   */
  const status = useTrackingStore((state) => state.status);
  const detailQuery = detail;

  useEffect(() => {
    if (!requestId || status === null) return;
    void detailQuery.refetch();
    // Volontairement sans `detailQuery` en dépendance : l'objet de requête est
    // reconstruit à chaque rendu, ce qui relancerait la lecture en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, status]);

  // --- Mode dégradé : la réponse HTTP alimente le même store ---------------
  useEffect(() => {
    if (!degraded || !detail.data) return;

    const store = useTrackingStore.getState();
    store.applyState({ status: detail.data.status, lastSeq: detail.data.lastSeq });
    store.applyTracking({
      toClient: detail.data.tracking.toClient,
      toGarage: detail.data.tracking.toGarage,
    });
  }, [degraded, detail.data]);

  // --- Émission de sa propre position -------------------------------------
  useEffect(() => {
    if (!requestId || !fix) return;

    void emitter.current?.maybeEmit({
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracyM,
      speedMps: fix.smoothedSpeedMps,
      headingDeg: fix.headingDeg,
      recordedAt: new Date(fix.timestamp).toISOString(),
    });
  }, [requestId, fix]);

  return {
    detail: detail.data ?? null,
    isLoading: detail.isLoading,
    connection,
    lastSeq,
  };
}

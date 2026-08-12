import { create } from 'zustand';
import { EMISSION, type RequestStatus, type TrackingEta } from '@geocras/shared';

export type ConnectionState = 'connecting' | 'live' | 'degraded' | 'offline';

type TrackingState = {
  requestId: string | null;
  status: RequestStatus | null;
  lastSeq: number;
  toClient: TrackingEta | null;
  toGarage: TrackingEta | null;
  connection: ConnectionState;
  /** Horodatage local de la dernière donnée reçue — base du compteur « MAJ ». */
  lastPacketAt: number | null;

  start: (requestId: string) => void;
  stop: () => void;
  setConnection: (connection: ConnectionState) => void;
  applyTracking: (payload: { toClient: TrackingEta; toGarage: TrackingEta }) => void;
  applyState: (payload: { status: RequestStatus; lastSeq: number }) => void;
};

/**
 * État du suivi en direct.
 *
 * Zustand et **pas** TanStack Query : ces valeurs changent trois à cinq fois par
 * seconde. Dans le cache serveur, chaque ping invaliderait une entrée et
 * relancerait des requêtes réseau en boucle.
 *
 * Les composants s'abonnent par sélecteur (`useTracking((s) => s.toClient)`) :
 * le bandeau d'ETA se re-rend, pas l'écran entier.
 */
export const useTrackingStore = create<TrackingState>((set, get) => ({
  requestId: null,
  status: null,
  lastSeq: 0,
  toClient: null,
  toGarage: null,
  connection: 'connecting',
  lastPacketAt: null,

  start: (requestId) => {
    // Changer de demande doit repartir d'un état vierge : sinon l'ancien ETA
    // s'affiche une fraction de seconde sur la nouvelle intervention.
    if (get().requestId !== requestId) {
      set({
        requestId,
        status: null,
        lastSeq: 0,
        toClient: null,
        toGarage: null,
        lastPacketAt: null,
        connection: 'connecting',
      });
    }
  },

  stop: () =>
    set({
      requestId: null,
      status: null,
      lastSeq: 0,
      toClient: null,
      toGarage: null,
      lastPacketAt: null,
      connection: 'offline',
    }),

  setConnection: (connection) => set({ connection }),

  applyTracking: (payload) =>
    set({
      toClient: payload.toClient,
      toGarage: payload.toGarage,
      lastPacketAt: Date.now(),
    }),

  applyState: (payload) =>
    set((current) => ({
      status: payload.status,
      // `seq` ne recule jamais : un paquet arrivé dans le désordre après une
      // reconnexion ne doit pas faire régresser le point de rattrapage.
      lastSeq: Math.max(current.lastSeq, payload.lastSeq),
      lastPacketAt: Date.now(),
    })),
}));

/**
 * Âge de la donnée affichée, en secondes.
 *
 * Alimente l'indicateur « MAJ 3s » de la maquette 04. Il doit refléter la
 * fraîcheur **réelle** : afficher 3 s sur une donnée qui en a 40 revient à
 * mentir sur la seule chose que cet indicateur mesure.
 */
export function dataAgeSeconds(lastPacketAt: number | null): number | null {
  if (lastPacketAt === null) return null;
  return Math.max(0, Math.round((Date.now() - lastPacketAt) / 1000));
}

export function isStale(lastPacketAt: number | null): boolean {
  if (lastPacketAt === null) return true;
  return Date.now() - lastPacketAt > EMISSION.staleAfterMs;
}

import { create } from 'zustand';
import {
  EMISSION,
  type RequestEvent,
  type RequestEventType,
  type RequestStatus,
  type TrackingEta,
} from '@geocras/shared';

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
  /**
   * Type du dernier événement connu sur la demande.
   *
   * C'est la **seule** chose qui distingue une demande refusée d'une demande
   * qui n'a simplement pas encore de garage. Les deux sont `pending`, sans
   * `garageId` et sans `selectedAt` : le refus remet ces deux colonnes à zéro,
   * exactement comme si le garage n'avait jamais été choisi. Sans le journal,
   * l'app ne peut que deviner — et c'est en devinant qu'elle annonçait un refus
   * à quelqu'un dont le SOS venait de partir.
   *
   * `null` tant qu'aucun événement n'a été reçu : on ne conclut rien d'un
   * silence.
   */
  lastEvent: RequestEventType | null;

  start: (requestId: string) => void;
  stop: () => void;
  setConnection: (connection: ConnectionState) => void;
  applyTracking: (payload: { toClient: TrackingEta; toGarage: TrackingEta }) => void;
  applyState: (payload: {
    status: RequestStatus;
    lastSeq: number;
    missedEvents?: readonly RequestEvent[];
  }) => void;
};

/**
 * Le type de l'événement le plus récent d'un lot, ou `null` s'il n'y en a pas.
 *
 * Les événements arrivent triés par `seq` croissant — à la reconnexion, le
 * serveur rejoue tout l'historique dans cet ordre ; sur un changement d'état,
 * il n'envoie que celui qui vient de se produire. Dans les deux cas, c'est le
 * dernier de la liste qui décrit la situation courante.
 *
 * On ne se fie pas à l'ordre du tableau pour autant : `seq` est la source de
 * vérité, et un lot arrivé dans le désordre après une coupure ferait conclure
 * de travers.
 */
export function latestEventType(events: readonly RequestEvent[] | undefined): RequestEventType | null {
  if (!events || events.length === 0) return null;

  let latest = events[0]!;
  for (const event of events) {
    if (event.seq > latest.seq) latest = event;
  }
  return latest.type;
}

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
  lastEvent: null,

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
        lastEvent: null,
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
      lastEvent: null,
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
      // Un lot vide ne remet pas le compteur à zéro : le repli en sondage HTTP
      // pousse un statut sans journal, et il n'a aucune raison d'effacer ce que
      // le socket avait appris avant de tomber.
      lastEvent: latestEventType(payload.missedEvents) ?? current.lastEvent,
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

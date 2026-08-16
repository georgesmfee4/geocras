import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  isTerminal,
  joinPayloadSchema,
  positionPayloadSchema,
  SOCKET_EVENTS,
  type PartyRole,
  type RequestEvent,
  type StatePayload,
  type TrackingPayload,
} from '@geocras/shared';
import { db } from '../db/client';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../modules/auth/tokens';
import {
  findEventsAfter,
  findGarageOwner,
  findGarageSummaryById,
  findLatestPositions,
  findOwnerOfRequestGarage,
  findRequestById,
  resolveParty,
} from '../modules/requests/requests.repo';
import { getJobsForOwner } from '../modules/requests/jobs.service';
import { computeTracking } from '../modules/requests/tracking';
import { recordPosition } from '../modules/requests/requests.service';
import { bus } from './bus';

type AuthedSocket = Socket & { userId: string };

const roomOf = (requestId: string): string => `request:${requestId}`;

/**
 * Room propre à un compte, rejointe dès la connexion.
 *
 * Les rooms par demande ne suffisent pas au garagiste : au moment où un SOS
 * lui est adressé, il ne connaît pas encore cette demande — il n'a donc rejoint
 * aucune room, et le seul canal qui puisse le prévenir est celui qui le désigne
 * lui. C'est aussi ce qui tient plusieurs appareils du même garage d'accord :
 * l'atelier accepte sur la tablette, le téléphone du dépanneur voit la file
 * changer.
 */
const userRoomOf = (userId: string): string => `user:${userId}`;

/**
 * Pousse la file de travail au propriétaire du garage retenu sur cette demande.
 *
 * Silencieux quand le garage n'appartient à personne — c'est le cas des garages
 * du seed, pas une anomalie.
 */
async function pushJobsToOwner(
  io: Server,
  requestId: string,
  /**
   * Garage désigné explicitement par l'événement, quand la demande ne le
   * porte plus — cf. le refus, qui détache `garage_id` avant de publier.
   */
  garageIdHint?: string | null,
): Promise<void> {
  const ownerUserId = garageIdHint
    ? await findGarageOwner(db, garageIdHint)
    : await findOwnerOfRequestGarage(db, requestId);
  if (!ownerUserId) return;

  const jobs = await getJobsForOwner(ownerUserId);
  if (jobs) io.to(userRoomOf(ownerUserId)).emit(SOCKET_EVENTS.jobs, jobs);
}

/**
 * Construit la charge de suivi diffusée à une room.
 *
 * L'ETA est calculé ici, côté serveur, et jamais par les clients : les deux
 * parties doivent voir le même chiffre, et cette valeur alimente la détection
 * de fraude. Deux calculs clients donneraient deux vérités non auditables.
 */
async function buildTracking(requestId: string): Promise<TrackingPayload | null> {
  const request = await findRequestById(db, requestId);
  if (!request) return null;

  const garage = request.garage_id ? await findGarageSummaryById(db, request.garage_id) : null;
  const positions = await findLatestPositions(db, requestId);

  const tracking = computeTracking(positions, {
    clientOrigin: { lat: Number(request.origin_lat), lng: Number(request.origin_lng) },
    garageLocation: garage ? { lat: Number(garage.lat), lng: Number(garage.lng) } : null,
  });

  return {
    requestId,
    toClient: tracking.toClient,
    toGarage: tracking.toGarage,
    emittedAt: new Date().toISOString(),
  };
}

async function buildState(requestId: string, afterSeq: number): Promise<StatePayload | null> {
  const request = await findRequestById(db, requestId);
  if (!request) return null;

  const events = await findEventsAfter(db, requestId, afterSeq);

  return {
    requestId,
    status: request.status,
    lastSeq: request.last_seq,
    missedEvents: events.map(
      (row): RequestEvent => ({
        seq: row.seq,
        type: row.type,
        actorUserId: row.actor_user_id,
        actorRole: row.actor_role,
        payload: row.payload,
        createdAt: new Date(row.created_at).toISOString(),
      }),
    ),
  };
}

export function attachRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // Le repli long-polling n'est pas une commodité : sur un réseau mobile
    // camerounais irrégulier, c'est souvent le seul transport qui tient.
    transports: ['websocket', 'polling'],
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  /** Authentification à la poignée de main : pas de socket anonyme. */
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as AuthedSocket).userId;

    /**
     * Abonnement d'office à sa propre room — aucun message à envoyer pour ça.
     *
     * C'est ce qui permet au garagiste de recevoir un SOS qu'il ne connaît pas
     * encore. La room ne porte que ce qui concerne ce compte : l'identité vient
     * du jeton vérifié à la poignée de main, jamais d'un paramètre client.
     */
    void socket.join(userRoomOf(userId));

    /**
     * File de travail à l'ouverture, pour qui en a une.
     *
     * Évite la fenêtre aveugle du garagiste qui rallume son téléphone : sans
     * cet envoi, il ne verrait rien jusqu'au prochain changement d'état — donc
     * pas le SOS arrivé pendant la coupure, qui est précisément celui qu'il
     * attend.
     */
    void (async () => {
      const jobs = await getJobsForOwner(userId);
      if (jobs) socket.emit(SOCKET_EVENTS.jobs, jobs);
    })();

    socket.on(SOCKET_EVENTS.join, async (raw: unknown) => {
      const parsed = joinPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.error, {
          code: 'VALIDATION_ERROR',
          message: 'Requête de connexion invalide',
        });
        return;
      }

      const { requestId, lastSeq } = parsed.data;

      /**
       * Double contrôle : le JWT prouve QUI appelle, `resolveParty` prouve que
       * cet appelant est partie à CETTE demande. Sans le second, n'importe quel
       * utilisateur authentifié écouterait la position de deux inconnus.
       */
      const role: PartyRole | null = await resolveParty(db, requestId, userId);
      if (!role) {
        socket.emit(SOCKET_EVENTS.error, {
          code: 'NOT_A_PARTY',
          message: "Vous n'êtes pas partie à cette demande",
        });
        return;
      }

      await socket.join(roomOf(requestId));

      // Rattrapage : le client annonce son dernier `seq` connu, on rejoue ce
      // qui lui manque. Une coupure de quarante secondes ne casse pas le suivi.
      const state = await buildState(requestId, lastSeq);
      if (state) socket.emit(SOCKET_EVENTS.state, state);

      const tracking = await buildTracking(requestId);
      if (tracking) socket.emit(SOCKET_EVENTS.tracking, tracking);
    });

    socket.on(SOCKET_EVENTS.leave, async (raw: unknown) => {
      const parsed = joinPayloadSchema.safeParse(raw);
      if (parsed.success) await socket.leave(roomOf(parsed.data.requestId));
    });

    socket.on(SOCKET_EVENTS.position, async (raw: unknown) => {
      const parsed = positionPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.error, {
          code: 'VALIDATION_ERROR',
          message: 'Position invalide',
        });
        return;
      }

      try {
        // Passe par le service : mêmes contrôles d'appartenance et mêmes règles
        // d'état que la route HTTP de repli. Deux chemins, une seule logique.
        await recordPosition(parsed.data.requestId, userId, parsed.data.position);
      } catch (error) {
        logger.warn({ err: error, userId }, 'Position rejetée');
        socket.emit(SOCKET_EVENTS.error, {
          code: 'REQUEST_NOT_FOUND',
          message: 'Position refusée',
        });
      }
    });

    socket.on('error', (error: unknown) => {
      logger.warn({ err: error, userId }, 'Erreur socket');
    });
  });

  /**
   * Diffusion. Le bus découple la logique métier de Socket.io : les services
   * publient un fait, on décide ici de ce qui part sur le réseau.
   */
  bus.on('request:changed', (event) => {
    void (async () => {
      /**
       * Le garagiste d'abord, et hors de la room de la demande.
       *
       * Tout changement d'état modifie sa file : un SOS qui arrive, une
       * demande annulée qui en sort, une arrivée confirmée. C'est le seul
       * destinataire qui ne peut pas être atteint par la room — il n'y est pas
       * encore quand le SOS lui est adressé, et c'est justement le message qui
       * compte le plus pour lui.
       */
      await pushJobsToOwner(io, event.requestId, event.garageId);

      const state = await buildState(event.requestId, 0);
      if (!state) return;

      io.to(roomOf(event.requestId)).emit(SOCKET_EVENTS.state, {
        ...state,
        // Sur un changement d'état, on n'envoie pas tout l'historique : le
        // rejeu complet est réservé à la reconnexion, qui le demande via `seq`.
        missedEvents: state.missedEvents.filter((e) => e.seq === event.seq),
      });

      const tracking = await buildTracking(event.requestId);
      if (tracking) io.to(roomOf(event.requestId)).emit(SOCKET_EVENTS.tracking, tracking);

      // Une demande terminée n'a plus rien à diffuser : on vide la room pour ne
      // pas garder des sockets abonnés à un flux mort.
      if (isTerminal(state.status)) {
        io.socketsLeave(roomOf(event.requestId));
      }
    })();
  });

  bus.on('request:position', (event) => {
    void (async () => {
      const tracking = await buildTracking(event.requestId);
      if (tracking) io.to(roomOf(event.requestId)).emit(SOCKET_EVENTS.tracking, tracking);
    })();
  });

  return io;
}

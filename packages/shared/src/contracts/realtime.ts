import { z } from 'zod';
import { coordinatesSchema, positionSchema, uuidSchema } from './common';
import { requestEventSchema, trackingEtaSchema, REQUEST_STATUSES } from './requests';

/**
 * Contrat Socket.io. Les noms d'événements vivent ici pour que le serveur et le
 * mobile ne puissent pas diverger sur une chaîne de caractères.
 *
 * Règle structurante : l'ETA est calculé PAR LE SERVEUR. Les clients envoient
 * des positions brutes et reçoivent des ETA. Deux raisons — les deux parties
 * doivent voir le même chiffre, et cet ETA alimente la détection de fraude.
 */

export const SOCKET_EVENTS = {
  /** client → serveur */
  join: 'request:join',
  leave: 'request:leave',
  position: 'request:position',
  /** serveur → client */
  state: 'request:state',
  tracking: 'request:tracking',
  event: 'request:event',
  error: 'request:error',
  /**
   * File de travail du garage, poussée à son propriétaire.
   *
   * Le seul événement qui ne passe pas par la room d'une demande, et il ne
   * peut pas : au moment où un SOS lui est adressé, le garagiste ne connaît
   * pas encore cette demande, donc n'a rejoint aucune room. Il est abonné à sa
   * propre room utilisateur dès la connexion du socket, et c'est là qu'arrive
   * le SOS.
   *
   * On pousse la **liste entière** plutôt qu'un signal à recharger : elle tient
   * en quelques centaines d'octets, là où un aller-retour HTTP de plus sur un
   * réseau qui met deux secondes à répondre repousse d'autant l'instant où le
   * garagiste voit la demande.
   */
  jobs: 'garage:jobs',
} as const;

export const joinPayloadSchema = z.object({
  requestId: uuidSchema,
  /** Dernier événement connu du client : le serveur rejoue ce qui manque. */
  lastSeq: z.number().int().nonnegative().default(0),
});
export type JoinPayload = z.infer<typeof joinPayloadSchema>;

export const positionPayloadSchema = z.object({
  requestId: uuidSchema,
  position: positionSchema,
});
export type PositionPayload = z.infer<typeof positionPayloadSchema>;

export const statePayloadSchema = z.object({
  requestId: uuidSchema,
  status: z.enum(REQUEST_STATUSES),
  lastSeq: z.number().int().nonnegative(),
  /** Événements rejoués après reconnexion, dans l'ordre croissant de `seq`. */
  missedEvents: z.array(requestEventSchema).default([]),
});
export type StatePayload = z.infer<typeof statePayloadSchema>;

export const trackingPayloadSchema = z.object({
  requestId: uuidSchema,
  toClient: trackingEtaSchema,
  toGarage: trackingEtaSchema,
  /** Horodatage serveur d'émission — base du compteur « MAJ 3s ». */
  emittedAt: z.string().datetime(),
});
export type TrackingPayload = z.infer<typeof trackingPayloadSchema>;

export const socketErrorPayloadSchema = z.object({
  code: z.enum(['UNAUTHORIZED', 'NOT_A_PARTY', 'REQUEST_NOT_FOUND', 'VALIDATION_ERROR']),
  message: z.string(),
});

/**
 * Cadence d'émission. Throttle temporel ET seuil de distance : on n'émet pas si
 * l'on n'a pas bougé. Un ping ≈ 120 octets ; une intervention de 20 min coûte
 * environ 36 Ko. Les forfaits data se comptent.
 */
export const EMISSION = {
  throttleMs: 4_000,
  minMoveMeters: 15,
  /** Repli quand le socket est mort. */
  pollIntervalMs: 15_000,
  /** Au-delà, la donnée affichée est signalée comme périmée. */
  staleAfterMs: 20_000,
} as const;

export const arrivalConfirmationPayloadSchema = z.object({
  requestId: uuidSchema,
  position: coordinatesSchema.nullable(),
});

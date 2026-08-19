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

/**
 * Reconnaissance mutuelle sur place.
 *
 * Le dernier mètre d'une intervention n'est pas un problème de GPS, c'est un
 * problème de regard : deux personnes qui se cherchent sur le même bout de
 * route. L'app ne peut pas décider qu'elles se sont trouvées — elle peut
 * seulement **poser la question au bon moment**, et faire en sorte que la
 * réponse tienne en un geste de chaque côté.
 *
 * Ces seuils commandent ce moment, et ils sont dans le contrat partagé pour une
 * raison précise : les deux écrans doivent basculer **ensemble**. Un garagiste
 * à qui l'on demande « vous le voyez ? » pendant que le client ne voit rien
 * venir, c'est un appel téléphonique de plus, pas un de moins.
 */
export const PROXIMITY = {
  /**
   * En dessous, on propose la reconnaissance.
   *
   * Cent vingt mètres, et non les dix mètres qu'on imagine spontanément. Trois
   * raisons, toutes mesurables :
   *
   *  - **le GPS d'un téléphone en ville tient 10 à 30 m**, et bien davantage
   *    entre deux immeubles ou sous les manguiers. Un seuil de dix mètres vit
   *    entièrement dans le bruit de la mesure : il ne se déclenche jamais, ou
   *    il clignote ;
   *  - **la position émise a de l'âge**. On n'émet qu'au-delà de quinze mètres
   *    parcourus et toutes les quatre secondes : à quarante à l'heure, le
   *    dernier point connu date déjà d'une quarantaine de mètres ;
   *  - **cent vingt mètres, c'est une portée de vue**. Sur une rue de Yaoundé,
   *    un véhicule à l'arrêt à cette distance se repère. C'est exactement le
   *    rayon dans lequel la question « vous le voyez ? » a un sens.
   *
   * Se tromper large ne coûte rien ici : la question se décline d'un geste. Se
   * tromper serré coûte l'inverse — la fenêtre ne s'ouvre pas, et les deux
   * parties reprennent la recherche manuelle qu'on voulait leur épargner.
   */
  enterMeters: 120,
  /**
   * Au-delà, la fenêtre se referme.
   *
   * Hystérésis, et non un second seuil arbitraire : sans écart entre l'entrée
   * et la sortie, un dépanneur qui tourne pour se garer verrait la feuille
   * apparaître et disparaître à chaque oscillation du GPS. Quatre-vingts mètres
   * de marge suffisent à absorber ce va-et-vient sans laisser la fenêtre
   * ouverte alors qu'on s'éloigne vraiment.
   */
  exitMeters: 200,
  /**
   * Âge maximal du dernier point pour que la distance prouve quelque chose.
   *
   * Repris de `EMISSION.staleAfterMs` plutôt que redéclaré : c'est déjà le
   * seuil au-delà duquel l'app signale une donnée périmée à l'écran, et
   * proposer une reconnaissance sur une position que l'on affiche par ailleurs
   * comme douteuse serait se contredire d'un bandeau à l'autre.
   */
  freshWithinMs: EMISSION.staleAfterMs,
} as const;

/**
 * Les deux parties sont-elles assez proches pour se chercher du regard ?
 *
 * `wasNear` porte l'hystérésis : on entre à `enterMeters`, on ne ressort qu'à
 * `exitMeters`. Le paramètre est explicite plutôt que caché dans un état
 * interne, pour que la fonction reste pure — c'est ce qui la rend vérifiable
 * sans monter d'écran, et identique des deux côtés.
 */
export function isNear(distanceM: number | null, wasNear: boolean): boolean {
  if (distanceM === null || !Number.isFinite(distanceM)) return false;
  return distanceM <= (wasNear ? PROXIMITY.exitMeters : PROXIMITY.enterMeters);
}

/**
 * La mesure est-elle assez fraîche pour qu'on s'y fie ?
 *
 * Un horodatage **postérieur** à `now` est traité comme frais, et ce n'est pas
 * une négligence : les horodatages viennent du serveur, l'instant courant peut
 * venir d'un téléphone dont l'horloge dérive. Compter un âge négatif comme
 * périmé ferait disparaître la fenêtre de reconnaissance sur tout appareil en
 * avance de quelques secondes — le contraire de ce que le seuil protège.
 */
export function isPositionFresh(updatedAt: string | null, now: number): boolean {
  if (updatedAt === null) return false;

  const emittedAt = Date.parse(updatedAt);
  if (Number.isNaN(emittedAt)) return false;

  return now - emittedAt <= PROXIMITY.freshWithinMs;
}

export const arrivalConfirmationPayloadSchema = z.object({
  requestId: uuidSchema,
  position: coordinatesSchema.nullable(),
});

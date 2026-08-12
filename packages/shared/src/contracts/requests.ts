import { z } from 'zod';
import { coordinatesSchema, paginatedSchema, positionSchema, uuidSchema } from './common';
import {
  PROBLEM_TYPES,
  REQUEST_VEHICLE_TYPES,
  URGENCY_LEVELS,
  VEHICLE_LABEL_MAX,
} from '../taxonomy';
import { garageSummarySchema } from './garages';

/**
 * Cycle de vie d'une demande d'assistance.
 *
 *   pending ──select──▶ selected ──accept──▶ accepted ──en_route──▶ en_route
 *                                                                      │
 *                                              une seule confirmation ─┤
 *                                                                      ▼
 *                                                        awaiting_confirmation
 *                                                                      │
 *                                             seconde confirmation ────┤
 *                                                                      ▼
 *                                                                   closed
 *
 * `cancelled` est atteignable depuis tout état non terminal.
 * Seul `closed` déclenche l'évaluation de fidélité.
 */
export const REQUEST_STATUSES = [
  'pending',
  'selected',
  'accepted',
  'en_route',
  'awaiting_confirmation',
  'closed',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Libellés d'état, du point de vue du **client**.
 *
 * Ici et non dans les traductions du mobile, comme les autres libellés
 * métier : le serveur en a besoin pour les notifications, et deux listes
 * séparées finiraient par se contredire — une demande annoncée « Terminée »
 * dans l'app et « Closed » dans un message.
 *
 * Ils décrivent une situation, pas une transition de machine à états :
 * `awaiting_confirmation` se dit « Arrivée à confirmer », parce que c'est ce
 * qu'il reste à faire, et non « en attente de confirmation », qui laisserait
 * croire qu'on attend quelqu'un d'autre.
 */
export const REQUEST_STATUS_LABELS: Readonly<
  Record<RequestStatus, { fr: string; en: string }>
> = {
  pending: { fr: 'Garage à choisir', en: 'Garage to pick' },
  selected: { fr: 'En attente du garage', en: 'Waiting for garage' },
  accepted: { fr: 'Acceptée', en: 'Accepted' },
  en_route: { fr: 'Garagiste en route', en: 'Mechanic on the way' },
  awaiting_confirmation: { fr: 'Arrivée à confirmer', en: 'Arrival to confirm' },
  closed: { fr: 'Terminée', en: 'Completed' },
  cancelled: { fr: 'Annulée', en: 'Cancelled' },
};

export const TERMINAL_STATUSES: readonly RequestStatus[] = ['closed', 'cancelled'];

/** Une demande vit encore : elle a sa place en haut de l'historique. */
export function isRequestOngoing(status: RequestStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export const REQUEST_EVENT_TYPES = [
  'created',
  'garage_selected',
  'accepted',
  'en_route',
  'position',
  'arrival_confirmed',
  'closed',
  'cancelled',
] as const;
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];

export const PARTY_ROLES = ['client', 'garage'] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

const createRequestFields = z.object({
  vehicleType: z.enum(REQUEST_VEHICLE_TYPES),
  problemType: z.enum(PROBLEM_TYPES),
  vehicleId: uuidSchema.nullable().default(null),
  /**
   * Libellé libre du véhicule. Renseigné uniquement quand `vehicleType` vaut
   * `other` — voir le refinement plus bas, qui l'y rend obligatoire.
   */
  vehicleLabel: z.string().trim().max(VEHICLE_LABEL_MAX).nullable().default(null),
  description: z.string().trim().max(500).default(''),
  urgency: z.enum(URGENCY_LEVELS).default('blocking'),
  immobilized: z.boolean().default(true),
  vulnerablePassengers: z.boolean().default(false),
  photoUrl: z.string().url().nullable().default(null),
  origin: coordinatesSchema,
  accuracyM: z.number().nonnegative().nullable().default(null),
  /** Le client peut demander un tri d'emblée ; défaut « plus proche ». */
  sort: z.enum(['distance', 'rating', 'certified']).default('distance'),
});

/**
 * Deux champs libres deviennent obligatoires selon ce qui a été choisi.
 *
 * Ce sont des règles **de contenu**, pas de forme, et elles vivent donc dans le
 * contrat partagé plutôt que dans l'écran : le mobile bloque le bouton
 * « Continuer », le serveur refuse la demande, et les deux appliquent la même
 * règle sans qu'on ait à l'écrire deux fois.
 *
 * La justification est la même dans les deux cas — c'est le garagiste qui lit
 * ces champs pour décider s'il peut intervenir et avec quoi. « Autre » tout
 * seul ne lui apprend rien, et une demande qu'il ne peut pas évaluer est une
 * demande qu'il n'accepte pas.
 */
export const createRequestBodySchema = createRequestFields.superRefine((value, ctx) => {
  if (value.vehicleType === 'other' && (value.vehicleLabel ?? '').length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vehicleLabel'],
      message: 'Précisez le type de véhicule',
    });
  }

  if (value.problemType === 'other' && value.description.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'Décrivez la panne en quelques mots',
    });
  }
});
export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;

export const requestPartySchema = z.object({
  userId: uuidSchema,
  fullName: z.string(),
  initials: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  vehicleLabel: z.string().nullable(),
  plate: z.string().nullable(),
});
export type RequestParty = z.infer<typeof requestPartySchema>;

export const assistanceRequestSchema = z.object({
  id: uuidSchema,
  status: z.enum(REQUEST_STATUSES),
  clientId: uuidSchema,
  garageId: uuidSchema.nullable(),
  vehicleType: z.enum(REQUEST_VEHICLE_TYPES),
  vehicleLabel: z.string().nullable(),
  problemType: z.enum(PROBLEM_TYPES),
  description: z.string(),
  urgency: z.enum(URGENCY_LEVELS),
  immobilized: z.boolean(),
  vulnerablePassengers: z.boolean(),
  photoUrl: z.string().url().nullable(),
  origin: coordinatesSchema,

  createdAt: z.string().datetime(),
  /**
   * Instant où le client a retenu ce garage.
   *
   * Distinct de `createdAt`, qui date l'ouverture de la demande : entre les
   * deux, le client compare les garages proposés, ce qui peut prendre
   * plusieurs minutes. C'est **celui-ci** que l'écran d'attente décompte — un
   * garage n'est comptable que du temps écoulé depuis qu'il a été prévenu.
   *
   * `null` tant que la demande est `pending`, et sur les demandes créées avant
   * la migration `0004`.
   */
  selectedAt: z.string().datetime().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  enRouteAt: z.string().datetime().nullable(),
  garageArrivedAt: z.string().datetime().nullable(),
  clientArrivedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  cancelReason: z.string().nullable(),

  /** Numéro du dernier événement connu — sert au rattrapage après reconnexion. */
  lastSeq: z.number().int().nonnegative(),
});
export type AssistanceRequest = z.infer<typeof assistanceRequestSchema>;

export const createRequestResponseSchema = z.object({
  request: assistanceRequestSchema,
  /** Garages classés, renvoyés dans le même aller-retour : un seul appel réseau. */
  garages: z.array(garageSummarySchema),
  fallback: garageSummarySchema.nullable(),
});
export type CreateRequestResponse = z.infer<typeof createRequestResponseSchema>;

export const selectGarageBodySchema = z.object({ garageId: uuidSchema });
export const cancelRequestBodySchema = z.object({
  reason: z.string().trim().max(200).default(''),
});

/** Confirmation d'arrivée — idempotente : un double appui ne compte qu'une fois. */
export const confirmArrivalBodySchema = z.object({
  position: coordinatesSchema.nullable().default(null),
});

export const pushPositionBodySchema = z.object({ position: positionSchema });

/** Vue de suivi : les deux ETA de la maquette 04. */
export const trackingEtaSchema = z.object({
  role: z.enum(PARTY_ROLES),
  etaMin: z.number().int().positive().nullable(),
  distanceM: z.number().nonnegative().nullable(),
  speedKmh: z.number().nonnegative().nullable(),
  mode: z.enum(['driving', 'walking']),
  position: coordinatesSchema.nullable(),
  /** Horodatage du dernier point reçu — alimente l'indicateur « MAJ 3s ». */
  updatedAt: z.string().datetime().nullable(),
});
export type TrackingEta = z.infer<typeof trackingEtaSchema>;

export const requestDetailSchema = assistanceRequestSchema.extend({
  garage: garageSummarySchema.omit({ rank: true }).nullable(),
  client: requestPartySchema,
  mechanic: requestPartySchema.nullable(),
  tracking: z.object({
    /** Garagiste → client. */
    toClient: trackingEtaSchema,
    /** Client → garage. */
    toGarage: trackingEtaSchema,
  }),
});
export type RequestDetail = z.infer<typeof requestDetailSchema>;

/**
 * Réponse de `GET /requests/active`.
 *
 * Enveloppée dans un objet plutôt que renvoyée nue : un `null` au premier
 * niveau de la réponse se distingue mal d'une erreur de désérialisation, et
 * l'enveloppe laisse la place à d'autres champs plus tard sans casser le
 * contrat.
 */
export const activeRequestResponseSchema = z.object({
  request: requestDetailSchema.nullable(),
});
export type ActiveRequestResponse = z.infer<typeof activeRequestResponseSchema>;

export const requestEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  type: z.enum(REQUEST_EVENT_TYPES),
  actorUserId: uuidSchema.nullable(),
  actorRole: z.enum(PARTY_ROLES).nullable(),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});
export type RequestEvent = z.infer<typeof requestEventSchema>;

/**
 * Transitions autorisées. Exportées parce que le mobile s'en sert pour savoir
 * quelles actions afficher — plutôt que de recoder la machine à états dans
 * chaque écran, avec le risque de la faire diverger du serveur.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  pending: ['selected', 'cancelled'],
  selected: ['accepted', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['awaiting_confirmation', 'cancelled'],
  awaiting_confirmation: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const requestHistoryResponseSchema = paginatedSchema(
  assistanceRequestSchema.extend({
    garageName: z.string().nullable(),
    garageCertified: z.boolean().nullable(),
    reviewed: z.boolean(),
  }),
);
export type RequestHistoryResponse = z.infer<typeof requestHistoryResponseSchema>;

import { z } from 'zod';
import { coordinatesSchema, paginatedSchema, positionSchema, uuidSchema } from './common';
import {
  isServiceModeAllowed,
  PARTY_ROLES,
  PROBLEM_TYPES,
  REQUEST_VEHICLE_TYPES,
  SERVICE_MODES,
  URGENCY_LEVELS,
  VEHICLE_LABEL_MAX,
  type ServiceMode,
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

/**
 * Ce que les mêmes états deviennent quand **c'est le client qui se déplace**.
 *
 * Une table de remplacement partielle, et non une seconde table complète : cinq
 * des sept libellés ne dépendent pas du mode — une demande annulée est annulée
 * dans les deux sens. Dupliquer les cinq pour en changer deux, c'est se
 * condamner à corriger un mot à deux endroits et à en oublier un.
 *
 * `accepted` change parce qu'il ne dit pas la même chose de part et d'autre :
 * en `on_site`, l'acceptation annonce au client que quelqu'un va venir, et il
 * n'a rien à faire ; en `at_garage`, elle est le feu vert **pour lui**. Un
 * simple « Acceptée » laisserait attendre au bord de la route quelqu'un dont
 * c'est le tour de démarrer.
 */
const AT_GARAGE_STATUS_LABELS: Readonly<
  Partial<Record<RequestStatus, { fr: string; en: string }>>
> = {
  accepted: { fr: 'Vous pouvez y aller', en: 'You can head over' },
  en_route: { fr: 'En route vers le garage', en: 'On your way to the garage' },
};

/**
 * Le libellé d'un état, pour un mode donné.
 *
 * **À préférer systématiquement à `REQUEST_STATUS_LABELS` lu directement.**
 * Celui-ci reste exporté parce que la table brute sert aux écrans qui listent
 * les états sans demande sous la main, mais tout affichage rattaché à une
 * demande réelle passe par ici — sinon un client parti conduire vers l'atelier
 * lit « Garagiste en route » pendant tout son trajet.
 */
export function requestStatusLabel(
  status: RequestStatus,
  mode: ServiceMode,
): { fr: string; en: string } {
  if (mode === 'at_garage') {
    return AT_GARAGE_STATUS_LABELS[status] ?? REQUEST_STATUS_LABELS[status];
  }
  return REQUEST_STATUS_LABELS[status];
}

export const TERMINAL_STATUSES: readonly RequestStatus[] = ['closed', 'cancelled'];

/** Une demande vit encore : elle a sa place en haut de l'historique. */
export function isRequestOngoing(status: RequestStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export const REQUEST_EVENT_TYPES = [
  'created',
  'garage_selected',
  /**
   * Le garage a refusé la demande, qui repart en recherche.
   *
   * Distinct de `cancelled` : la demande n'est pas morte, elle a seulement
   * perdu son garage. Les confondre effacerait du journal la seule trace qui
   * permette de mesurer le taux de refus d'un garage — et de le compter dans
   * son classement, le jour où on le décidera.
   */
  'declined',
  'accepted',
  'en_route',
  'position',
  'arrival_confirmed',
  'closed',
  'cancelled',
] as const;
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];

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
  /**
   * Comment la rencontre doit avoir lieu — cf. `SERVICE_MODES`.
   *
   * Le défaut est `on_site`, et ce n'est pas un choix esthétique : c'était le
   * seul comportement possible avant la migration 0009, et c'est ce que doit
   * comprendre une version de l'app antérieure à ce champ. Un défaut
   * `at_garage` aurait fait envoyer des clients immobilisés chez un garagiste
   * qui ne serait jamais parti.
   */
  serviceMode: z.enum(SERVICE_MODES).default('on_site'),
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

  /*
    Un véhicule immobilisé ne conduit personne jusqu'à un atelier.

    Troisième barrière sur la même règle, et les trois sont utiles : le
    formulaire grise l'option, ce contrat refuse la demande, la contrainte SQL
    `at_garage_requires_rolling_vehicle` interdit la ligne. La première évite
    une erreur, la deuxième protège des clients trafiqués, la troisième protège
    de nous-mêmes — d'un futur script d'import ou d'une reprise de données qui
    ne passerait par aucune des deux autres.
  */
  if (!isServiceModeAllowed(value.serviceMode, value.immobilized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceMode'],
      message: 'Un véhicule immobilisé ne peut pas se rendre au garage',
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
  /**
   * Qui se déplace vers qui. Fixé à la création, jamais modifié ensuite.
   *
   * Présent sur **toutes** les vues de la demande et non seulement sur le
   * détail : l'historique, la file du garage et l'écran de suivi en dépendent
   * tous pour choisir leurs mots et leurs boutons.
   */
  serviceMode: z.enum(SERVICE_MODES),

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

/**
 * Refus du garage.
 *
 * Le motif est **libre et facultatif**. L'imposer aurait produit ce que
 * produisent tous les motifs obligatoires : le premier choix de la liste,
 * coché sans le lire, par quelqu'un qui a une dépanneuse à sortir. Un champ
 * vide est une information plus honnête qu'un motif faux.
 */
export const declineRequestBodySchema = z.object({
  reason: z.string().trim().max(200).default(''),
});
export type DeclineRequestBody = z.infer<typeof declineRequestBodySchema>;

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
  /**
   * Type du dernier événement du journal, ou `null` sur une demande sans
   * historique.
   *
   * Il est ici parce que **le statut ne suffit pas à expliquer une situation**,
   * et `pending` en est la démonstration : un refus remet `garageId` et
   * `selectedAt` à `null`, ce qui rend une demande refusée strictement
   * indiscernable d'une demande à laquelle aucun garage n'a encore été soumis.
   * L'app qui devait choisir entre les deux devinait — et annonçait un refus à
   * des clients dont le SOS venait de partir.
   *
   * Le socket transportait déjà le journal (`missedEvents`), mais lui seul :
   * en repli HTTP, l'information disparaissait et le même écran redevenait
   * aveugle. Un fait dont dépend un message affiché doit voyager par les deux
   * chemins, sinon le message dépend du transport.
   */
  lastEvent: z.enum(REQUEST_EVENT_TYPES).nullable(),
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
  /**
   * `selected → pending` est le **refus du garage**, et la seule marche
   * arrière de toute la machine.
   *
   * Elle existe parce que l'alternative était pire : sans elle, un garage qui
   * ne peut pas intervenir n'avait que l'annulation, c'est-à-dire tuer la
   * demande de quelqu'un qui est en panne au bord d'une route. Le refus lui
   * rend seulement sa liberté de choisir ailleurs — la demande garde son
   * identifiant, son journal et son ancienneté, elle perd son garage.
   *
   * Rien d'autre ne recule : voir le test « ne revient jamais en arrière ».
   */
  selected: ['accepted', 'pending', 'cancelled'],
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
    /**
     * De quel côté se trouvait **le compte qui lit** cette ligne.
     *
     * L'historique mélange volontairement les deux : un garagiste y retrouve
     * ses interventions, un client ses dépannages, et le même compte peut avoir
     * les deux — un garagiste tombe aussi en panne.
     *
     * Sans ce champ, l'écran n'avait aucun moyen de le savoir et traitait tout
     * le monde en client : il affichait au garagiste le nom de son propre
     * garage comme s'il l'avait appelé, lui proposait de se noter lui-même, et
     * l'envoyait sur l'écran de suivi du demandeur. C'est le serveur qui
     * connaît la réponse — il l'a déjà calculée pour filtrer la requête — donc
     * c'est lui qui la donne, plutôt que de laisser chaque écran la déduire à
     * sa façon.
     */
    role: z.enum(PARTY_ROLES),
    garageName: z.string().nullable(),
    garageCertified: z.boolean().nullable(),
    /**
     * Nom du demandeur.
     *
     * C'est **l'autre partie** quand on lit en tant que garage : la ligne doit
     * nommer qui on est allé dépanner, pas répéter l'enseigne de l'atelier.
     * Côté client, c'est son propre nom — sans intérêt, mais sans fuite non
     * plus.
     */
    clientName: z.string(),
    reviewed: z.boolean(),
  }),
);
export type RequestHistoryResponse = z.infer<typeof requestHistoryResponseSchema>;

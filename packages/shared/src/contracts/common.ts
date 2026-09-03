import { z } from 'zod';
import { CAMEROON_BOUNDS } from '../geo';

/** Codes d'erreur. L'app mobile traduit sur le code, jamais sur le message. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'PHONE_TAKEN',
  'INVALID_CREDENTIALS',
  'RATE_LIMITED',
  'GARAGE_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'REQUEST_NOT_CLOSED',
  'REQUEST_ALREADY_ACTIVE',
  'ALREADY_REVIEWED',
  'INVALID_STATE_TRANSITION',
  'NOT_A_PARTY',
  'REFERRAL_INVALID',
  'VEHICLE_NOT_FOUND',
  'UPLOADS_NOT_CONFIGURED',
  /** Suppression de compte refusée : une intervention est encore en cours. */
  'ACCOUNT_HAS_ACTIVE_REQUEST',
  /** Inscription garage refusée : ce compte en gère déjà un. */
  'GARAGE_ALREADY_OWNED',
  /** Détection impossible : le dossier du garage n'est pas encore vérifié. */
  'GARAGE_NOT_VERIFIED',
  /**
   * Modification ou retrait refusés : le dossier est déjà vérifié.
   *
   * Une fois le garage contrôlé, ses coordonnées et sa position engagent
   * GeoCras auprès des clients qui le voient : elles ne se réécrivent plus
   * depuis le téléphone, et le garage ne s'efface plus tout seul — il se ferme
   * à la détection, ce qui préserve ses avis et son historique.
   */
  'GARAGE_ALREADY_VERIFIED',
  /**
   * Demande refusée : ce garage appartient au compte qui la passe.
   *
   * **C'est une règle anti-fraude, pas une règle d'usage.** Une intervention
   * dont les deux parties sont la même personne fabriquerait à volonté des
   * points de fidélité, une ligne au registre des commissions et un avis — le
   * tout sans qu'aucun client n'ait été apporté à qui que ce soit.
   *
   * Elle produisait par ailleurs une demande **définitivement bloquée** :
   * `resolveParty` teste `client_id` en premier, donc le propriétaire s'y
   * voyait rendre le rôle `client` et ne pouvait plus accepter sa propre
   * demande. Elle restait en `selected`, et l'index d'unicité interdisait d'en
   * ouvrir une autre : le compte était gelé.
   */
  'OWN_GARAGE',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    /** Détail par champ, uniquement pour VALIDATION_ERROR. */
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const latitudeSchema = z.coerce
  .number()
  .min(CAMEROON_BOUNDS.minLat, 'latitude hors du Cameroun')
  .max(CAMEROON_BOUNDS.maxLat, 'latitude hors du Cameroun');

export const longitudeSchema = z.coerce
  .number()
  .min(CAMEROON_BOUNDS.minLng, 'longitude hors du Cameroun')
  .max(CAMEROON_BOUNDS.maxLng, 'longitude hors du Cameroun');

export const coordinatesSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** Position émise par un appareil, avec ses métadonnées de qualité. */
export const positionSchema = coordinatesSchema.extend({
  accuracyM: z.number().nonnegative().max(10_000).nullable().default(null),
  speedMps: z.number().min(0).max(120).nullable().default(null),
  headingDeg: z.number().min(0).max(360).nullable().default(null),
  recordedAt: z.string().datetime(),
});
export type Position = z.infer<typeof positionSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    results: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export const uuidSchema = z.string().uuid();

/** Numéro camerounais au format E.164 : +237 puis 9 chiffres. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+237[2368]\d{8}$/, 'Numéro camerounais attendu, ex. +237670123456');

export const localeSchema = z.enum(['fr', 'en']).default('fr');
export type Locale = z.infer<typeof localeSchema>;

import { z } from 'zod';
import {
  latitudeSchema,
  longitudeSchema,
  paginatedSchema,
  phoneSchema,
  uuidSchema,
} from './common';
import { SERVICES } from '../taxonomy';

export const GARAGE_SORTS = ['distance', 'rating', 'certified'] as const;
export type GarageSort = (typeof GARAGE_SORTS)[number];

/**
 * Un `services` fourni filtre sur les garages qui offrent **tous** ces services.
 * Séparateur virgule côté query string : `?services=towing,battery`.
 *
 * Voir `matchAny` pour la sémantique inverse, utilisée par la recherche SOS.
 */
const servicesQuerySchema = z
  .union([z.string(), z.array(z.enum(SERVICES))])
  .transform((value) =>
    typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : value,
  )
  .pipe(z.array(z.enum(SERVICES)).max(SERVICES.length))
  .optional();

export const nearbyQuerySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  radiusKm: z.coerce.number().min(0.5).max(100).default(15),
  sort: z.enum(GARAGE_SORTS).default('distance'),
  services: servicesQuerySchema,
  /**
   * Bascule le filtre `services` du ET au OU.
   *
   * Les deux usages n'ont pas le même besoin, et les confondre a produit un
   * vrai bug : la puce « Remorquage » de la carte n'envoie qu'un service, où
   * ET et OU reviennent au même ; la recherche SOS, elle, envoie la liste des
   * **compétences alternatives** capables de traiter la panne, et le ET la
   * transformait en exigence cumulative.
   *
   * Concrètement, une boîte de vitesse sur un véhicule immobilisé demandait
   * `transmission` ET `towing` — soit un garage qui répare les boîtes **et**
   * remorque. À Ebolowa, l'un répare et l'autre remorque : la recherche ne
   * rendait rien alors que deux garages pouvaient aider.
   *
   * Défaut `false` : la sémantique historique est inchangée.
   */
  matchAny: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  openNow: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  /**
   * Filtre, à ne pas confondre avec `sort: 'certified'`.
   *
   * La puce « Certifiés » de l'écran Carte **retire** les garages non
   * certifiés ; le tri « Certifié » de l'écran Résultats les garde et les
   * relègue. Filtrer côté client casserait la numérotation, qui doit rester
   * contiguë et calculée par le serveur.
   */
  certifiedOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

/** Forme renvoyée dans une liste de résultats. */
export const garageSummarySchema = z.object({
  /**
   * Rang de pertinence selon le tri actif. Calculé par le serveur, affiché tel
   * quel sur le marqueur. Le client ne le recalcule JAMAIS — un classement
   * recalculé localement diverge du serveur dès que les données bougent.
   */
  rank: z.number().int().positive(),
  id: uuidSchema,
  name: z.string(),
  certified: z.boolean(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  distanceM: z.number().nonnegative(),
  etaMin: z.number().int().positive(),
  lat: z.number(),
  lng: z.number(),
  addressLabel: z.string().nullable(),
  quarter: z.string().nullable(),
  phone: z.string().nullable(),
  services: z.array(z.enum(SERVICES)),
  photos: z.array(z.string()),
  openNow: z.boolean(),
});
export type GarageSummary = z.infer<typeof garageSummarySchema>;

export const nearbyResponseSchema = z.object({
  results: z.array(garageSummarySchema),
  /**
   * Renseigné uniquement si `results` est vide : le garage le plus proche quel
   * que soit le rayon. Un écran vide au bord de la route est inacceptable.
   */
  fallback: garageSummarySchema.nullable(),
  meta: z.object({
    sort: z.enum(GARAGE_SORTS),
    radiusKm: z.number(),
    count: z.number().int(),
    /** `true` quand le rayon demandé n'a rien donné et que `fallback` est servi. */
    widened: z.boolean(),
  }),
});
export type NearbyResponse = z.infer<typeof nearbyResponseSchema>;

export const openingHoursSchema = z.record(
  z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  z.string().regex(/^(\d{2}:\d{2}-\d{2}:\d{2}|closed|24h)$/),
);
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const garageDetailSchema = garageSummarySchema.omit({ rank: true }).extend({
  description: z.string().nullable(),
  openingHours: openingHoursSchema.nullable(),
  yearsInBusiness: z.number().int().nonnegative().nullable(),
  recentReviews: z.array(
    z.object({
      id: uuidSchema,
      rating: z.number().int().min(1).max(5),
      comment: z.string().nullable(),
      authorName: z.string(),
      authorInitials: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
});
export type GarageDetail = z.infer<typeof garageDetailSchema>;

/**
 * Le garage vu **par son propriétaire**.
 *
 * Distinct de `garageDetail`, qui est la fiche publique : celle-ci est vue
 * depuis une position et porte un classement, une distance, un ETA. Ici il n'y
 * a pas d'observateur — le garagiste regarde son propre garage — et en
 * revanche `isActive`, que le public ne voit jamais puisqu'un garage inactif
 * n'apparaît nulle part.
 */
export const myGarageSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  /** Adresse de contact pour la vérification. Jamais exposée au public. */
  email: z.string().nullable(),
  description: z.string().nullable(),
  addressLabel: z.string().nullable(),
  quarter: z.string().nullable(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  services: z.array(z.enum(SERVICES)),
  photos: z.array(z.string()),
  openingHours: openingHoursSchema.nullable(),
  yearsInBusiness: z.number().int().nonnegative().nullable(),
  certified: z.boolean(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  /**
   * Date de vérification par GeoCras, ou `null` tant que le dossier est en
   * cours d'examen.
   *
   * Distinct de `certified`, qui est un label de qualité : la vérification dit
   * seulement « ce garage existe, à cette adresse, et ce numéro répond ». Un
   * garage vérifié mais non certifié est parfaitement normal — c'est même
   * l'état de la plupart d'entre eux.
   */
  verifiedAt: z.string().datetime().nullable(),
  /**
   * Détection ouverte.
   *
   * `false` retire le garage de **toutes** les recherches SOS, sans rien
   * supprimer : c'est le garage fermé pour la journée, pas le garage qui
   * ferme boutique. Reste `false` tant que la vérification n'a pas eu lieu —
   * une contrainte SQL l'impose, cf. `active_requires_verification`.
   */
  isActive: z.boolean(),
});
export type MyGarage = z.infer<typeof myGarageSchema>;

/**
 * Enveloppe volontaire plutôt que `MyGarage | null` nu.
 *
 * « Ce compte n'a pas de garage » est une réponse normale, pas une erreur :
 * un 404 obligerait chaque appelant à distinguer l'absence de garage d'un
 * problème de route, et TanStack Query traiterait le premier cas comme un
 * échec à réessayer.
 */
export const myGarageResponseSchema = z.object({ garage: myGarageSchema.nullable() });
export type MyGarageResponse = z.infer<typeof myGarageResponseSchema>;

/**
 * Inscription d'un garage par son propriétaire.
 *
 * `certified` n'y figure pas, et n'y figurera jamais : la certification est
 * accordée après vérification, jamais déclarée par le garage lui-même. Un
 * garage créé ici est visible immédiatement, en écusson blanc.
 */
export const createMyGarageBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** Le numéro que le client compose. Vérifié par appel avant validation. */
  phone: phoneSchema,
  /**
   * Obligatoire, contrairement à l'e-mail d'un compte client : c'est par là
   * que la réponse à la demande de vérification arrive. Un dossier sans
   * adresse joignable est un dossier qu'on ne peut pas conclure.
   */
  email: z.string().trim().email().max(160),
  quarter: z.string().trim().max(80).nullable().default(null),
  addressLabel: z.string().trim().max(160).nullable().default(null),
  city: z.string().trim().max(80).default('Yaoundé'),
  lat: latitudeSchema,
  lng: longitudeSchema,
  /**
   * Au moins une compétence : un garage sans service déclaré ne remonterait
   * dans aucune recherche SOS, donc n'existerait pas pour le produit.
   */
  services: z.array(z.enum(SERVICES)).min(1).max(SERVICES.length),
  description: z.string().trim().max(400).nullable().default(null),
  openingHours: openingHoursSchema.nullable().default(null),
  /** Plafond volontaire : six photos suffisent à montrer un atelier. */
  photos: z.array(z.string().url()).max(6).default([]),
  yearsInBusiness: z.number().int().min(0).max(100).nullable().default(null),
});
export type CreateMyGarageBody = z.infer<typeof createMyGarageBodySchema>;

export const updateMyGarageBodySchema = z.object({
  isActive: z.boolean(),
});
export type UpdateMyGarageBody = z.infer<typeof updateMyGarageBodySchema>;

/**
 * Correction du dossier **tant qu'il est à l'étude**.
 *
 * Exactement le corps de l'inscription, et volontairement : un dossier se
 * corrige en entier, parce que ce qu'on corrige le plus souvent — un numéro
 * saisi de travers, une position relevée depuis le salon — est justement ce
 * qui décide de la vérification. Un envoi partiel obligerait à deviner ce qui
 * a changé ; ici le formulaire renvoie ce qu'il affiche.
 *
 * Le serveur refuse après vérification (`GARAGE_ALREADY_VERIFIED`). Passé ce
 * cap, l'adresse et le numéro ont été contrôlés un par un et sont montrés à
 * des clients : les réécrire depuis le téléphone reviendrait à vider la
 * vérification de son sens.
 */
export const editMyGarageBodySchema = createMyGarageBodySchema;
export type EditMyGarageBody = CreateMyGarageBody;

export const garageReviewsResponseSchema = paginatedSchema(
  z.object({
    id: uuidSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    authorName: z.string(),
    authorInitials: z.string(),
    createdAt: z.string().datetime(),
  }),
);
export type GarageReviewsResponse = z.infer<typeof garageReviewsResponseSchema>;

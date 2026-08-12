import { z } from 'zod';
import { localeSchema, phoneSchema, uuidSchema } from './common';
import { VEHICLE_TYPES } from '../taxonomy';

export const USER_ROLES = ['client', 'garage_owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Le mot de passe est volontairement peu contraint : l'utilisateur type saisit
 * ce formulaire au bord de la route. On impose une longueur, pas un charabia de
 * symboles qui pousse à écrire le mot de passe sur un papier.
 */
export const passwordSchema = z.string().min(8, 'Au moins 8 caractères').max(128);

export const vehicleInputSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  brand: z.string().trim().max(60).nullable().default(null),
  model: z.string().trim().max(60).nullable().default(null),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1).nullable().default(null),
  plate: z.string().trim().max(20).nullable().default(null),
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const vehicleSchema = vehicleInputSchema.extend({
  id: uuidSchema,
  isDefault: z.boolean(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const publicUserSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  phone: phoneSchema,
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(USER_ROLES),
  city: z.string().nullable(),
  locale: localeSchema,
  loyaltyPoints: z.number().int().nonnegative(),
  referralCode: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const signupBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().email().nullable().default(null),
  password: passwordSchema,
  city: z.string().trim().max(80).default('Yaoundé'),
  locale: localeSchema,
  vehicle: vehicleInputSchema.nullable().default(null),
  /** Code de parrainage saisi à l'inscription. */
  referredByCode: z.string().trim().max(16).nullable().default(null),
});
export type SignupBody = z.infer<typeof signupBodySchema>;

export const loginBodySchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshBodySchema = z.object({ refreshToken: z.string().min(1) });
export const refreshResponseSchema = z.object({ accessToken: z.string() });

export const updateMeBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  /**
   * Changement de numéro.
   *
   * Le numéro est l'identifiant de connexion : le modifier renomme la clé avec
   * laquelle on entre dans son propre compte. D'où l'unicité, qui remonte en
   * `PHONE_TAKEN` plutôt qu'en erreur de base.
   */
  phone: phoneSchema.optional(),
  email: z.string().email().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  city: z.string().trim().max(80).optional(),
  locale: localeSchema.optional(),
});
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;

/**
 * Changement de mot de passe.
 *
 * L'ancien est exigé même si l'appelant est déjà authentifié : un téléphone
 * déverrouillé posé sur une table ne doit pas suffire à verrouiller le compte
 * de son propriétaire. C'est la seule barrière qui protège d'une prise de
 * contrôle par quelqu'un qui a l'appareil en main.
 *
 * `refreshToken` désigne la **session à conserver**. Toutes les autres sont
 * révoquées : changer son mot de passe parce qu'on soupçonne un accès étranger
 * n'aurait aucun effet si la session de l'intrus survivait au changement.
 */
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  refreshToken: z.string().min(1).nullable().default(null),
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

/**
 * Une session ouverte, c'est-à-dire un appareil qui peut renouveler son accès
 * au compte sans ressaisir le mot de passe.
 *
 * Aucune métadonnée d'appareil : la table ne stocke que des empreintes de
 * jetons, et inventer un « Samsung à Yaoundé » à partir de rien serait pire que
 * de n'afficher qu'une date. Ce que l'utilisateur vient vérifier ici, c'est
 * **combien** d'appareils ont accès à son compte.
 */
export const authSessionSchema = z.object({
  id: uuidSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authSessionsResponseSchema = z.object({ sessions: z.array(authSessionSchema) });
export type AuthSessionsResponse = z.infer<typeof authSessionsResponseSchema>;

export const revokeOtherSessionsBodySchema = z.object({
  /** Session à épargner — celle de l'appareil qui demande. */
  refreshToken: z.string().min(1),
});
export type RevokeOtherSessionsBody = z.infer<typeof revokeOtherSessionsBodySchema>;

export const revokeOtherSessionsResponseSchema = z.object({
  revoked: z.number().int().nonnegative(),
});
export type RevokeOtherSessionsResponse = z.infer<typeof revokeOtherSessionsResponseSchema>;

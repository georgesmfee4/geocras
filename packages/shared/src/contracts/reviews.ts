import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Longueur maximale d'un commentaire.
 *
 * Exportée parce que le mobile en a besoin **au caractère près** : le champ
 * borne la saisie et affiche le compteur restant. Une constante recopiée dans
 * l'écran finirait par diverger de la validation serveur, et le client
 * découvrirait la vraie limite en se faisant refuser son avis après l'avoir
 * écrit.
 *
 * 500 et non 1000 : un avis de dépannage tient en quelques phrases, et un
 * champ qui promet mille caractères invite à en écrire mille — que personne ne
 * lira sur la fiche d'un garage.
 */
export const REVIEW_COMMENT_MAX = 500;

/**
 * L'avis est attaché à la DEMANDE, pas au couple (garage, utilisateur).
 * Conséquences voulues :
 *  - un avis exige une intervention réellement clôturée (règle anti-fraude
 *    devenue contrainte de base, pas vérification applicative oubliable) ;
 *  - un client fidèle qui revient trois fois peut noter trois fois.
 */
export const createReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(REVIEW_COMMENT_MAX).nullable().default(null),
});
export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;

export const reviewSchema = z.object({
  id: uuidSchema,
  requestId: uuidSchema,
  garageId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  authorName: z.string(),
  authorInitials: z.string(),
  createdAt: z.string().datetime(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Le mobile s'en sert pour désactiver le bouton étoile avec une explication. */
export const reviewEligibilitySchema = z.object({
  canReview: z.boolean(),
  reason: z
    .enum(['ok', 'no_closed_request', 'already_reviewed'])
    .describe('Motif du refus, traduit côté mobile'),
  requestId: uuidSchema.nullable(),
});
export type ReviewEligibility = z.infer<typeof reviewEligibilitySchema>;

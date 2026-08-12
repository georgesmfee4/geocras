import { z } from 'zod';
import { paginatedSchema, uuidSchema } from './common';
import { LEDGER_STATES, LOYALTY_REASONS, TIERS } from '../loyalty';

export const badgeSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** `false` → affiché grisé, comme le badge « Parrain » de la maquette 08. */
  unlocked: z.boolean(),
  unlockedAt: z.string().datetime().nullable(),
  tone: z.enum(['primary', 'warning', 'muted']),
});
export type Badge = z.infer<typeof badgeSchema>;

export const loyaltySummarySchema = z.object({
  /** Solde utilisable : somme des lignes `confirmed`. */
  balance: z.number().int().nonnegative(),
  /** Points acquis mais encore en fenêtre d'annulation. */
  pending: z.number().int().nonnegative(),
  /**
   * Réparations terminées — le compteur qui décide du grade.
   *
   * Distinct du solde de points : celui-ci se dépense, celui-là non. Le libellé
   * du grade n'est volontairement pas renvoyé, il se lit dans
   * `TIER_DEFINITIONS` avec la langue de l'appareil — un libellé figé côté
   * serveur serait français pour tout le monde.
   */
  completedRepairs: z.number().int().nonnegative(),
  tier: z.enum(TIERS),
  discountPct: z.number().int().nonnegative(),
  nextTier: z.enum(TIERS).nullable(),
  /** Réparations restantes avant le grade suivant. */
  repairsToNext: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
  badges: z.array(badgeSchema),
  referralCode: z.string(),
});
export type LoyaltySummary = z.infer<typeof loyaltySummarySchema>;

export const loyaltyEntrySchema = z.object({
  id: uuidSchema,
  deltaPoints: z.number().int(),
  reason: z.enum(LOYALTY_REASONS),
  state: z.enum(LEDGER_STATES),
  requestId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type LoyaltyEntry = z.infer<typeof loyaltyEntrySchema>;

export const loyaltyHistoryResponseSchema = paginatedSchema(loyaltyEntrySchema);
export type LoyaltyHistoryResponse = z.infer<typeof loyaltyHistoryResponseSchema>;

export const claimReferralBodySchema = z.object({
  code: z.string().trim().min(4).max(16),
});
export type ClaimReferralBody = z.infer<typeof claimReferralBodySchema>;

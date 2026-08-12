/**
 * Barème de fidélité.
 *
 * Les points deviennent des remises puis du Mobile Money : ce sont des espèces.
 * Ce fichier est la seule source du barème — le serveur crédite avec, le mobile
 * affiche avec. Toute divergence entre les deux serait une divergence comptable.
 *
 * Voir aussi `antiFraud` plus bas : les points ne sont JAMAIS crédités sur la
 * seule double confirmation, qui ne prouve pas qu'une intervention a eu lieu
 * (deux comptes complices se confirment mutuellement).
 *
 * Les **points** et les **grades** sont deux choses distinctes : les premiers
 * sont une monnaie, les seconds une ancienneté de client. Voir
 * `TIER_DEFINITIONS`.
 */

export const LOYALTY_REASONS = [
  'assistance_completed',
  'review_published',
  'referral_completed',
  'referred_signup',
  'manual_adjustment',
  'reversal',
] as const;
export type LoyaltyReason = (typeof LOYALTY_REASONS)[number];

/** Points crédités par action vérifiée. */
export const POINTS: Readonly<Record<Exclude<LoyaltyReason, 'manual_adjustment' | 'reversal'>, number>> = {
  assistance_completed: 50,
  review_published: 20,
  /** Crédité au parrain quand le filleul termine sa première intervention. */
  referral_completed: 100,
  /** Crédité au filleul à la même occasion. */
  referred_signup: 30,
};

/**
 * Libellés des mouvements de points.
 *
 * Ici et non dans les traductions du mobile : le serveur les emploiera dans les
 * notifications, et deux listes séparées finiraient par se contredire.
 */
export const LOYALTY_REASON_LABELS: Readonly<Record<LoyaltyReason, { fr: string; en: string }>> = {
  assistance_completed: { fr: 'Intervention terminée', en: 'Job completed' },
  review_published: { fr: 'Avis publié', en: 'Review published' },
  referral_completed: { fr: 'Parrainage abouti', en: 'Referral completed' },
  referred_signup: { fr: 'Inscription parrainée', en: 'Referred sign-up' },
  manual_adjustment: { fr: 'Ajustement', en: 'Adjustment' },
  reversal: { fr: 'Annulation', en: 'Reversal' },
};

export const LEDGER_STATES = ['pending', 'confirmed', 'reversed'] as const;
export type LedgerState = (typeof LEDGER_STATES)[number];

export const TIERS = [
  'standard',
  'bronze',
  'gold',
  'vip',
  'vip_platinum',
  'vip_diamond',
] as const;
export type Tier = (typeof TIERS)[number];

export type TierDefinition = {
  readonly id: Tier;
  /** Nombre de réparations terminées à partir duquel le grade est acquis. */
  readonly threshold: number;
  /** Remise chez les garages certifiés, en pourcentage. */
  readonly discountPct: number;
  readonly label: { readonly fr: string; readonly en: string };
  /** `true` pour les grades de la famille VIP, qui se présentent ensemble. */
  readonly vip: boolean;
};

/**
 * Grades de fidélité.
 *
 * ⚠️ Ils se gagnent en **réparations terminées**, pas en points. Les deux
 * mesures existent et ne disent pas la même chose :
 *
 *  - les **points** sont une monnaie — ils s'accumulent, se dépensent, et
 *    peuvent venir d'un avis ou d'un parrainage sans qu'aucun véhicule n'ait
 *    été réparé ;
 *  - le **grade** est une ancienneté de client — il ne se dépense pas, et il
 *    ne récompense que ce qui est arrivé au bord de la route.
 *
 * Les faire dépendre l'un de l'autre reviendrait à rétrograder quelqu'un qui
 * convertit ses points en Mobile Money, ce qui serait absurde.
 *
 * Le seuil est un **compte de demandes clôturées**, donc de doubles
 * confirmations d'arrivée : la contrainte SQL `closed_requires_both_arrivals`
 * est ce qui empêche de monter en grade sans intervention réelle.
 */
export const TIER_DEFINITIONS: readonly TierDefinition[] = [
  {
    id: 'standard',
    threshold: 0,
    discountPct: 0,
    label: { fr: 'Membre', en: 'Member' },
    vip: false,
  },
  {
    id: 'bronze',
    threshold: 1,
    discountPct: 3,
    label: { fr: 'Membre Bronze', en: 'Bronze member' },
    vip: false,
  },
  {
    id: 'gold',
    threshold: 10,
    discountPct: 6,
    label: { fr: 'Membre Or', en: 'Gold member' },
    vip: false,
  },
  {
    id: 'vip',
    threshold: 20,
    discountPct: 9,
    label: { fr: 'Membre VIP', en: 'VIP member' },
    vip: true,
  },
  {
    id: 'vip_platinum',
    threshold: 35,
    discountPct: 12,
    label: { fr: 'VIP Platine', en: 'VIP Platinum' },
    vip: true,
  },
  {
    id: 'vip_diamond',
    threshold: 60,
    discountPct: 15,
    label: { fr: 'VIP Diamant', en: 'VIP Diamond' },
    vip: true,
  },
];

export type TierProgress = {
  readonly current: TierDefinition;
  /** `null` quand le grade maximum est atteint. */
  readonly next: TierDefinition | null;
  /** Réparations restantes avant le grade suivant. */
  readonly repairsToNext: number;
  /** Progression vers le grade suivant, 0 → 1. Vaut 1 au grade maximum. */
  readonly ratio: number;
};

/** Grade atteint avec ce nombre de réparations terminées. */
export function tierForRepairs(repairs: number): TierDefinition {
  let current = TIER_DEFINITIONS[0] as TierDefinition;
  for (const tier of TIER_DEFINITIONS) {
    if (repairs >= tier.threshold) current = tier;
  }
  return current;
}

export function tierProgress(repairs: number): TierProgress {
  const current = tierForRepairs(repairs);
  const index = TIER_DEFINITIONS.findIndex((t) => t.id === current.id);
  const next = TIER_DEFINITIONS[index + 1] ?? null;

  if (!next) return { current, next: null, repairsToNext: 0, ratio: 1 };

  const span = next.threshold - current.threshold;
  const done = repairs - current.threshold;
  return {
    current,
    next,
    repairsToNext: Math.max(0, next.threshold - repairs),
    ratio: span > 0 ? Math.min(1, Math.max(0, done / span)) : 1,
  };
}

/**
 * Garde-fous anti-fraude. La double confirmation d'arrivée prouve que deux
 * personnes se sont mises d'accord — pas qu'une intervention a eu lieu.
 * Ces seuils sont ce qui casse la collusion statique entre deux comptes.
 */
export const ANTI_FRAUD = {
  /** En dessous, l'intervention est trop courte pour être plausible. */
  minInterventionSeconds: 180,
  /**
   * Les deux parties devaient être à cette distance minimale à la création :
   * une « intervention » entre deux téléphones posés côte à côte ne compte pas.
   */
  minInitialSeparationMeters: 300,
  /** Le garagiste doit avoir réellement parcouru cette distance cumulée. */
  minGarageTravelMeters: 200,
  /** Délai avant passage de `pending` à `confirmed` — fenêtre d'annulation. */
  pendingPeriodHours: 24,
  /** Plafond de crédits pour une même paire (client, garage) sur 30 jours. */
  maxCreditsPerPairPer30Days: 3,
  /** Au-delà, la conversion Mobile Money passe en revue manuelle. */
  manualReviewAbovePoints: 2000,
} as const;

/**
 * Clé d'idempotence du journal de points. Contrainte UNIQUE en base : une
 * requête rejouée ne peut pas créditer deux fois.
 */
export function ledgerIdempotencyKey(
  userId: string,
  reason: LoyaltyReason,
  requestId: string | null,
): string {
  return `${userId}:${reason}:${requestId ?? 'none'}`;
}

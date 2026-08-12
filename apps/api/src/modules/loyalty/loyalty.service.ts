import { sql, type Kysely, type Transaction } from 'kysely';
import {
  ANTI_FRAUD,
  ledgerIdempotencyKey,
  POINTS,
  tierProgress,
  type Badge,
  type LoyaltyEntry,
  type LoyaltyReason,
  type LoyaltySummary,
} from '@geocras/shared';
import { db } from '../../db/client';
import type { Database } from '../../db/types';
import { conflict, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  closedPairCount,
  garageTravelMeters,
  initialSeparationMeters,
} from '../requests/requests.repo';

type Db = Kysely<Database> | Transaction<Database>;

/**
 * Crédite des points — le SEUL chemin d'écriture du solde.
 *
 * Jamais de `UPDATE users SET loyalty_points = loyalty_points + n` : les points
 * deviennent du Mobile Money, donc de la comptabilité. Tout passe par une ligne
 * de journal portant sa clé d'idempotence, et `ON CONFLICT DO NOTHING` rend un
 * rejeu inoffensif.
 *
 * Les points naissent en `pending` : la fenêtre d'annulation permet d'annuler
 * un crédit frauduleux avant qu'il ne devienne dépensable.
 */
export async function credit(
  trx: Db,
  params: {
    userId: string;
    reason: LoyaltyReason;
    points: number;
    requestId: string | null;
  },
): Promise<boolean> {
  const result = await trx
    .insertInto('loyalty_ledger')
    .values({
      user_id: params.userId,
      delta_points: params.points,
      reason: params.reason,
      state: 'pending',
      request_id: params.requestId,
      idempotency_key: ledgerIdempotencyKey(params.userId, params.reason, params.requestId),
    })
    .onConflict((oc) => oc.column('idempotency_key').doNothing())
    .executeTakeFirst();

  return Number(result.numInsertedOrUpdatedRows ?? 0n) > 0;
}

/** Recalcule le cache de solde à partir du journal, qui fait foi. */
export async function refreshBalance(trx: Db, userId: string): Promise<number> {
  const row = await trx
    .selectFrom('loyalty_ledger')
    .select(({ fn }) => fn.sum<string>('delta_points').as('total'))
    .where('user_id', '=', userId)
    .where('state', '=', 'confirmed')
    .executeTakeFirst();

  const balance = Math.max(0, Number(row?.total ?? 0));
  await trx.updateTable('users').set({ loyalty_points: balance }).where('id', '=', userId).execute();
  return balance;
}

export type AwardOutcome =
  | { credited: true }
  | { credited: false; reason: 'duplicate' | 'too_short' | 'no_movement' | 'too_close' | 'pair_capped' };

/**
 * Évalue et crédite l'intervention d'une demande clôturée.
 *
 * La double confirmation d'arrivée prouve que deux personnes se sont mises
 * d'accord — pas qu'une intervention a eu lieu. Deux comptes complices se
 * confirment mutuellement toute la journée. Les quatre vérifications qui
 * suivent sont ce qui casse cette collusion ; la plus importante est la preuve
 * de mouvement.
 *
 * Ne lève jamais : un refus de crédit ne doit pas empêcher la clôture, qui est
 * un fait. Le motif est journalisé et renvoyé.
 */
export async function awardForClosedRequest(
  trx: Transaction<Database>,
  params: { requestId: string; clientId: string; garageId: string },
): Promise<AwardOutcome> {
  const request = await trx
    .selectFrom('assistance_requests')
    .select(['created_at', 'en_route_at', 'closed_at'])
    .where('id', '=', params.requestId)
    .executeTakeFirstOrThrow();

  const start = request.en_route_at ?? request.created_at;
  const end = request.closed_at ?? new Date();
  const durationSeconds = (new Date(end).getTime() - new Date(start).getTime()) / 1000;

  if (durationSeconds < ANTI_FRAUD.minInterventionSeconds) {
    logger.warn({ requestId: params.requestId, durationSeconds }, 'Crédit refusé : trop court');
    return { credited: false, reason: 'too_short' };
  }

  const separation = await initialSeparationMeters(trx, params.requestId);
  if (separation !== null && separation < ANTI_FRAUD.minInitialSeparationMeters) {
    logger.warn({ requestId: params.requestId, separation }, 'Crédit refusé : parties trop proches');
    return { credited: false, reason: 'too_close' };
  }

  const travelled = await garageTravelMeters(trx, params.requestId);
  if (travelled < ANTI_FRAUD.minGarageTravelMeters) {
    logger.warn({ requestId: params.requestId, travelled }, 'Crédit refusé : aucun déplacement');
    return { credited: false, reason: 'no_movement' };
  }

  // `closedPairCount` inclut la demande courante, déjà passée en `closed`.
  const pairCount = await closedPairCount(trx, params.clientId, params.garageId);
  if (pairCount > ANTI_FRAUD.maxCreditsPerPairPer30Days) {
    logger.warn({ requestId: params.requestId, pairCount }, 'Crédit refusé : plafond de paire');
    return { credited: false, reason: 'pair_capped' };
  }

  const inserted = await credit(trx, {
    userId: params.clientId,
    reason: 'assistance_completed',
    points: POINTS.assistance_completed,
    requestId: params.requestId,
  });

  if (!inserted) return { credited: false, reason: 'duplicate' };

  await awardBadges(trx, params.clientId);
  await settleReferralIfFirstRescue(trx, params.clientId, params.requestId);

  return { credited: true };
}

/**
 * Le parrainage n'est acquis qu'à la PREMIÈRE intervention réelle du filleul.
 * Créditer à l'inscription reviendrait à payer pour des comptes jetables.
 */
async function settleReferralIfFirstRescue(
  trx: Transaction<Database>,
  userId: string,
  requestId: string,
): Promise<void> {
  const user = await trx
    .selectFrom('users')
    .select(['referred_by'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!user?.referred_by) return;

  const previous = await trx
    .selectFrom('loyalty_ledger')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .where('reason', '=', 'assistance_completed')
    .executeTakeFirstOrThrow();

  if (Number(previous.count) !== 1) return;

  await credit(trx, {
    userId: user.referred_by,
    reason: 'referral_completed',
    points: POINTS.referral_completed,
    requestId,
  });
  await credit(trx, {
    userId,
    reason: 'referred_signup',
    points: POINTS.referred_signup,
    requestId,
  });
  await awardBadges(trx, user.referred_by);
}

async function unlockBadge(trx: Db, userId: string, badgeId: string): Promise<void> {
  await trx
    .insertInto('user_badges')
    .values({ user_id: userId, badge_id: badgeId })
    .onConflict((oc) => oc.columns(['user_id', 'badge_id']).doNothing())
    .execute();
}

export async function awardBadges(trx: Db, userId: string): Promise<void> {
  const counts = await trx
    .selectFrom('loyalty_ledger')
    .select([
      sql<string>`count(*) FILTER (WHERE reason = 'assistance_completed')`.as('rescues'),
      sql<string>`count(*) FILTER (WHERE reason = 'review_published')`.as('reviews'),
      sql<string>`count(*) FILTER (WHERE reason = 'referral_completed')`.as('referrals'),
      sql<string>`COALESCE(sum(delta_points) FILTER (WHERE state = 'confirmed'), 0)`.as('balance'),
    ])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();

  const rescues = Number(counts.rescues);
  if (rescues >= 1) await unlockBadge(trx, userId, 'first_rescue');
  if (rescues >= 10) await unlockBadge(trx, userId, 'ten_rescues');
  if (Number(counts.reviews) >= 1) await unlockBadge(trx, userId, 'reviewer');
  if (Number(counts.referrals) >= 1) await unlockBadge(trx, userId, 'referrer');
  if (Number(counts.balance) >= 1000) await unlockBadge(trx, userId, 'tier_gold');
}

/**
 * Fait passer en `confirmed` les crédits sortis de la fenêtre d'annulation.
 * Appelé par une tâche planifiée ; idempotent, donc rejouable sans risque.
 */
export async function confirmMaturedCredits(): Promise<number> {
  const matured = await db
    .updateTable('loyalty_ledger')
    .set({ state: 'confirmed', confirmed_at: new Date() })
    .where('state', '=', 'pending')
    .where(
      'created_at',
      '<',
      sql<Date>`now() - make_interval(hours => ${ANTI_FRAUD.pendingPeriodHours})`,
    )
    .returning('user_id')
    .execute();

  const userIds = [...new Set(matured.map((row) => row.user_id))];
  for (const userId of userIds) await refreshBalance(db, userId);

  return matured.length;
}

export async function getSummary(userId: string): Promise<LoyaltySummary> {
  const user = await db
    .selectFrom('users')
    .select(['referral_code'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!user) throw notFound('NOT_FOUND', 'Utilisateur introuvable');

  const totals = await db
    .selectFrom('loyalty_ledger')
    .select([
      sql<string>`COALESCE(sum(delta_points) FILTER (WHERE state = 'confirmed'), 0)`.as('balance'),
      sql<string>`COALESCE(sum(delta_points) FILTER (WHERE state = 'pending'), 0)`.as('pending'),
    ])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();

  const balance = Math.max(0, Number(totals.balance));

  /**
   * Le grade se compte en interventions **clôturées**, pas en points.
   *
   * Et pas non plus en lignes `assistance_completed` du journal : l'anti-fraude
   * peut refuser le crédit d'une intervention pourtant réelle — trop courte,
   * garagiste qui n'a pas bougé assez. Le dépannage a quand même eu lieu, et
   * le client n'a pas à en être puni sur son ancienneté. La clôture, elle, est
   * garantie par `closed_requires_both_arrivals`.
   */
  const repairs = await db
    .selectFrom('assistance_requests')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('client_id', '=', userId)
    .where('status', '=', 'closed')
    .executeTakeFirstOrThrow();

  const completedRepairs = Number(repairs.count);
  const progress = tierProgress(completedRepairs);

  const badges = await db
    .selectFrom('badges as b')
    .leftJoin('user_badges as ub', (join) =>
      join.onRef('ub.badge_id', '=', 'b.id').on('ub.user_id', '=', userId),
    )
    .select(['b.id', 'b.label_fr', 'b.tone', 'ub.unlocked_at'])
    .orderBy('b.sort_order', 'asc')
    .execute();

  return {
    balance,
    pending: Math.max(0, Number(totals.pending)),
    completedRepairs,
    tier: progress.current.id,
    discountPct: progress.current.discountPct,
    nextTier: progress.next?.id ?? null,
    repairsToNext: progress.repairsToNext,
    ratio: progress.ratio,
    referralCode: user.referral_code,
    badges: badges.map(
      (row): Badge => ({
        id: row.id,
        label: row.label_fr,
        unlocked: row.unlocked_at !== null,
        unlockedAt: row.unlocked_at ? new Date(row.unlocked_at).toISOString() : null,
        tone: row.tone,
      }),
    ),
  };
}

export async function getHistory(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ results: LoyaltyEntry[]; page: number; pageSize: number; total: number }> {
  const total = await db
    .selectFrom('loyalty_ledger')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom('loyalty_ledger')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return {
    results: rows.map((row) => ({
      id: row.id,
      deltaPoints: row.delta_points,
      reason: row.reason,
      state: row.state,
      requestId: row.request_id,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    page,
    pageSize,
    total: Number(total.count),
  };
}

/**
 * Rattachement d'un parrain après coup, pour un utilisateur qui n'avait pas de
 * code à l'inscription. Refusé s'il a déjà un parrain — sinon on pourrait
 * changer de parrain à chaque palier.
 */
export async function claimReferral(userId: string, code: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const user = await trx
      .selectFrom('users')
      .select(['id', 'referred_by'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) throw notFound('NOT_FOUND', 'Utilisateur introuvable');
    if (user.referred_by) throw conflict('REFERRAL_INVALID', 'Vous avez déjà un parrain');

    const sponsor = await trx
      .selectFrom('users')
      .select(['id'])
      .where('referral_code', '=', code.toUpperCase())
      .executeTakeFirst();

    if (!sponsor) throw notFound('REFERRAL_INVALID', 'Code de parrainage inconnu');
    if (sponsor.id === userId) {
      throw conflict('REFERRAL_INVALID', 'On ne peut pas se parrainer soi-même');
    }

    await trx
      .updateTable('users')
      .set({ referred_by: sponsor.id })
      .where('id', '=', userId)
      .execute();
  });
}

import {
  POINTS,
  type CreateReviewBody,
  type Review,
  type ReviewEligibility,
} from '@geocras/shared';
import { db } from '../../db/client';
import { conflict, forbidden, notFound } from '../../lib/errors';
import { awardBadges, credit } from '../loyalty/loyalty.service';

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Publie un avis.
 *
 * La règle « seul un utilisateur ayant une demande clôturée avec ce garage peut
 * publier un avis » n'est pas seulement vérifiée ici : l'avis est **clé sur la
 * demande** (`reviews.request_id UNIQUE`), donc la base refuse structurellement
 * un avis sans intervention, et refuse un second avis sur la même intervention.
 *
 * L'ancien schéma verrouillait sur (garage, utilisateur), ce qui empêchait un
 * client fidèle revenu trois fois de noter trois fois.
 */
export async function createReview(
  requestId: string,
  userId: string,
  body: CreateReviewBody,
): Promise<Review> {
  return db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom('assistance_requests')
      .select(['id', 'client_id', 'garage_id', 'status'])
      .where('id', '=', requestId)
      .executeTakeFirst();

    if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable');
    if (request.client_id !== userId) throw forbidden('Seul le client peut noter le garage');
    if (request.status !== 'closed') {
      throw conflict(
        'REQUEST_NOT_CLOSED',
        "L'intervention doit être terminée et confirmée par les deux parties",
      );
    }
    if (!request.garage_id) {
      throw conflict('REQUEST_NOT_CLOSED', 'Aucun garage associé à cette demande');
    }

    const existing = await trx
      .selectFrom('reviews')
      .select('id')
      .where('request_id', '=', requestId)
      .executeTakeFirst();

    if (existing) throw conflict('ALREADY_REVIEWED', 'Vous avez déjà noté cette intervention');

    const inserted = await trx
      .insertInto('reviews')
      .values({
        request_id: requestId,
        garage_id: request.garage_id,
        user_id: userId,
        rating: body.rating,
        comment: body.comment,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Le trigger `trg_refresh_garage_rating` a déjà remis à jour la note
    // agrégée du garage — inutile de la recalculer ici.
    await credit(trx, {
      userId,
      reason: 'review_published',
      points: POINTS.review_published,
      requestId,
    });
    await awardBadges(trx, userId);

    const author = await trx
      .selectFrom('users')
      .select('full_name')
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      requestId,
      garageId: request.garage_id,
      rating: inserted.rating,
      comment: inserted.comment,
      authorName: author.full_name,
      authorInitials: initialsOf(author.full_name),
      createdAt: new Date(inserted.created_at).toISOString(),
    };
  });
}

/**
 * Dit au mobile s'il peut proposer le bouton étoile, et sinon pourquoi.
 * Le cahier des charges impose un bouton désactivé **avec explication** plutôt
 * qu'un bouton qui échoue à l'appui.
 */
export async function getEligibility(
  garageId: string,
  userId: string,
): Promise<ReviewEligibility> {
  const candidate = await db
    .selectFrom('assistance_requests as r')
    .leftJoin('reviews as rev', 'rev.request_id', 'r.id')
    .select(['r.id', 'rev.id as review_id'])
    .where('r.client_id', '=', userId)
    .where('r.garage_id', '=', garageId)
    .where('r.status', '=', 'closed')
    .orderBy('r.closed_at', 'desc')
    .executeTakeFirst();

  if (!candidate) return { canReview: false, reason: 'no_closed_request', requestId: null };
  if (candidate.review_id !== null) {
    return { canReview: false, reason: 'already_reviewed', requestId: candidate.id };
  }
  return { canReview: true, reason: 'ok', requestId: candidate.id };
}

export async function listGarageReviews(garageId: string, page: number, pageSize: number) {
  const total = await db
    .selectFrom('reviews')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('garage_id', '=', garageId)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom('reviews as rev')
    .innerJoin('users as u', 'u.id', 'rev.user_id')
    .select(['rev.id', 'rev.rating', 'rev.comment', 'rev.created_at', 'u.full_name'])
    .where('rev.garage_id', '=', garageId)
    .orderBy('rev.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return {
    results: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: row.full_name,
      authorInitials: initialsOf(row.full_name),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    page,
    pageSize,
    total: Number(total.count),
  };
}

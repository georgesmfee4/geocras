import { Router } from 'express';
import { z } from 'zod';
import {
  latitudeSchema,
  longitudeSchema,
  nearbyQuerySchema,
  paginationQuerySchema,
  type NearbyQuery,
  type PaginationQuery,
} from '@geocras/shared';
import { uuidParam, validateQuery, validated } from '../../middleware/validate';
import { auth, requireAuth } from '../../middleware/auth';
import { getGarageDetail, searchNearby } from './garages.service';
import { getEligibility, listGarageReviews } from '../reviews/reviews.service';

export const garagesRouter: Router = Router();

/**
 * Routes PUBLIQUES, volontairement.
 *
 * Un visiteur non connecté doit voir la carte : imposer un compte pour
 * consulter les garages autour de soi transforme le premier lancement en
 * formulaire, alors que l'utilisateur type ouvre l'app parce qu'il est en
 * panne. L'authentification n'arrive qu'au moment d'engager une demande.
 */
garagesRouter.get('/nearby', validateQuery(nearbyQuerySchema), async (req, res) => {
  res.json(await searchNearby(validated<NearbyQuery>(req)));
});

const detailQuerySchema = z.object({
  lat: latitudeSchema.optional(),
  lng: longitudeSchema.optional(),
});

garagesRouter.get('/:id', validateQuery(detailQuerySchema), async (req, res) => {
  const { lat, lng } = validated<z.infer<typeof detailQuerySchema>>(req);
  const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  res.json(await getGarageDetail(uuidParam(req, 'id'), origin));
});

garagesRouter.get('/:id/reviews', validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, pageSize } = validated<PaginationQuery>(req);
  res.json(await listGarageReviews(uuidParam(req, 'id'), page, pageSize));
});

/**
 * Éligibilité à publier un avis. Nécessite une identité, mais `optionalAuth`
 * plus haut ne suffirait pas : sans compte, la réponse serait toujours « non »,
 * ce qui n'est pas une information utile.
 */
garagesRouter.get('/:id/review-eligibility', requireAuth, async (req, res) => {
  res.json(await getEligibility(uuidParam(req, 'id'), auth(req).userId));
});

import { Router } from 'express';
import {
  paginationQuerySchema,
  submitDrivingSessionBodySchema,
  type PaginationQuery,
  type SubmitDrivingSessionBody,
} from '@geocras/shared';
import { auth, requireAuth } from '../../middleware/auth';
import { validateBody, validateQuery, validated } from '../../middleware/validate';
import { getSessions, submitSession } from './driving.service';

export const drivingRouter: Router = Router();

drivingRouter.use(requireAuth);

/**
 * Renvoie 200 et non 201 : l'appel est idempotent, un renvoi après coupure
 * réseau rend la session déjà enregistrée plutôt que d'en créer une seconde.
 */
drivingRouter.post('/sessions', validateBody(submitDrivingSessionBodySchema), async (req, res) => {
  res.json(await submitSession(auth(req).userId, req.body as SubmitDrivingSessionBody));
});

drivingRouter.get('/sessions', validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, pageSize } = validated<PaginationQuery>(req);
  res.json(await getSessions(auth(req).userId, page, pageSize));
});

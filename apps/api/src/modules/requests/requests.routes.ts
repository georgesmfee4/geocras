import { Router } from 'express';
import {
  cancelRequestBodySchema,
  confirmArrivalBodySchema,
  createRequestBodySchema,
  createReviewBodySchema,
  paginationQuerySchema,
  pushPositionBodySchema,
  selectGarageBodySchema,
  type CreateRequestBody,
  type CreateReviewBody,
  type PaginationQuery,
} from '@geocras/shared';
import { createReview } from '../reviews/reviews.service';
import { auth, requireAuth } from '../../middleware/auth';
import { uuidParam, validateBody, validateQuery, validated } from '../../middleware/validate';
import {
  acceptRequest,
  cancelRequest,
  confirmArrival,
  createRequest,
  declareEnRoute,
  getActiveRequest,
  getHistory,
  getRequestDetail,
  recordPosition,
  selectGarage,
} from './requests.service';

export const requestsRouter: Router = Router();

// Tout le module exige une identité : une demande engage deux personnes et
// débouche sur des points convertibles en argent.
requestsRouter.use(requireAuth);

requestsRouter.post('/', validateBody(createRequestBodySchema), async (req, res) => {
  res.status(201).json(await createRequest(auth(req).userId, req.body as CreateRequestBody));
});

/**
 * Déclarée AVANT `/:id` : sans cela Express filerait « active » comme
 * identifiant à la route paramétrée, qui répondrait 400 sur un UUID invalide.
 */
requestsRouter.get('/active', async (req, res) => {
  res.json({ request: await getActiveRequest(auth(req).userId) });
});

requestsRouter.get('/mine', validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, pageSize } = validated<PaginationQuery>(req);
  res.json(await getHistory(auth(req).userId, page, pageSize));
});

requestsRouter.get('/:id', async (req, res) => {
  res.json(await getRequestDetail(uuidParam(req, 'id'), auth(req).userId));
});

requestsRouter.post('/:id/select', validateBody(selectGarageBodySchema), async (req, res) => {
  const { garageId } = req.body as { garageId: string };
  res.json(await selectGarage(uuidParam(req, 'id'), auth(req).userId, garageId));
});

requestsRouter.post('/:id/accept', async (req, res) => {
  res.json(await acceptRequest(uuidParam(req, 'id'), auth(req).userId));
});

requestsRouter.post('/:id/en-route', async (req, res) => {
  res.json(await declareEnRoute(uuidParam(req, 'id'), auth(req).userId));
});

/** Idempotent : un double appui, ou un renvoi après coupure, ne compte qu'une fois. */
requestsRouter.post('/:id/arrive', validateBody(confirmArrivalBodySchema), async (req, res) => {
  const { position } = req.body as { position: { lat: number; lng: number } | null };
  res.json(await confirmArrival(uuidParam(req, 'id'), auth(req).userId, position));
});

requestsRouter.post('/:id/cancel', validateBody(cancelRequestBodySchema), async (req, res) => {
  const { reason } = req.body as { reason: string };
  res.json(await cancelRequest(uuidParam(req, 'id'), auth(req).userId, reason));
});

/** Chemin de repli quand le socket est tombé mais que HTTP passe encore. */
requestsRouter.post('/:id/position', validateBody(pushPositionBodySchema), async (req, res) => {
  const { position } = req.body as { position: Parameters<typeof recordPosition>[2] };
  await recordPosition(uuidParam(req, 'id'), auth(req).userId, position);
  res.status(204).end();
});

/**
 * L'avis est attaché à la DEMANDE, pas au garage — d'où cette route ici plutôt
 * que sous `/garages`. C'est ce qui rend la règle anti-fraude structurelle :
 * pas d'intervention clôturée, pas d'avis possible.
 */
requestsRouter.post('/:id/review', validateBody(createReviewBodySchema), async (req, res) => {
  res
    .status(201)
    .json(await createReview(uuidParam(req, 'id'), auth(req).userId, req.body as CreateReviewBody));
});

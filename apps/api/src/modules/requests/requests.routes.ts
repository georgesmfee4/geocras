import { Router } from 'express';
import {
  cancelRequestBodySchema,
  declineRequestBodySchema,
  routeQuerySchema,
  type DeclineRequestBody,
  type RouteQuery,
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
import { notFound } from '../../lib/errors';
import { uuidParam, validateBody, validateQuery, validated } from '../../middleware/validate';
import { getJobRoute, getJobsForOwner } from './jobs.service';
import {
  acceptRequest,
  cancelRequest,
  confirmArrival,
  createRequest,
  declareEnRoute,
  declineRequest,
  getActiveRequest,
  getApproachRoute,
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

/**
 * File de travail du garage détenu par le compte connecté.
 *
 * Déclarée avant `/:id`, comme `/active` : « garage » n'est pas un UUID.
 *
 * Sous `/requests` et non sous `/me/garage/jobs` : ce que la route rend, ce
 * sont des demandes d'assistance, avec les mêmes états et les mêmes
 * transitions que celles servies juste au-dessus. Les ranger ailleurs
 * laisserait croire à un second cycle de vie.
 *
 * Pas de `requireRole('garage_owner')` : le rôle voyage dans le jeton d'accès,
 * qui date de la connexion. L'autorité, c'est `owner_user_id` en base — même
 * raison que pour `GET /me/garage`.
 */
requestsRouter.get('/garage', async (req, res) => {
  const jobs = await getJobsForOwner(auth(req).userId);
  if (!jobs) throw notFound('GARAGE_NOT_FOUND', 'Aucun garage rattaché à ce compte');
  res.json(jobs);
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

/**
 * Refus du garage. La demande retourne en recherche, elle n'est pas annulée.
 *
 * Verbe et chemin distincts de `/cancel` alors que les deux « rejettent » la
 * demande : ce sont deux effets sans rapport pour le client — l'un lui rend la
 * main sur le choix du garage, l'autre ferme son SOS. Une route unique avec un
 * drapeau aurait rendu la différence invisible dans les journaux d'accès, là où
 * on la cherchera précisément le jour d'une réclamation.
 */
requestsRouter.post('/:id/decline', validateBody(declineRequestBodySchema), async (req, res) => {
  const { reason } = req.body as DeclineRequestBody;
  res.json(await declineRequest(uuidParam(req, 'id'), auth(req).userId, reason));
});

/**
 * Itinéraire vers le lieu de la panne, depuis la position **réelle** du
 * garagiste — qui n'est pas forcément son atelier.
 *
 * En GET avec le départ en requête plutôt qu'en POST : c'est une lecture sans
 * effet de bord, rejouable, et le serveur la met en cache. L'arrivée, elle,
 * n'est pas un paramètre : elle est lue sur la demande. Voir `getJobRoute`.
 */
requestsRouter.get('/:id/route', validateQuery(routeQuerySchema), async (req, res) => {
  const { fromLat, fromLng } = validated<RouteQuery>(req);
  res.json(
    await getJobRoute(uuidParam(req, 'id'), auth(req).userId, { lat: fromLat, lng: fromLng }),
  );
});

/**
 * Trajet d'approche, pour **les deux parties**.
 *
 * Distincte de `/:id/route`, qui appartient au garagiste et prend son départ en
 * paramètre. Ici le départ n'est pas fourni : c'est le dernier point émis par le
 * garage, que le serveur connaît déjà. Fusionner les deux aurait obligé le
 * client à envoyer une position qui n'est pas la sienne.
 */
requestsRouter.get('/:id/approach', async (req, res) => {
  res.json(await getApproachRoute(uuidParam(req, 'id'), auth(req).userId));
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

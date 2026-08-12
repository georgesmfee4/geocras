import { Router } from 'express';
import {
  changePasswordBodySchema,
  claimReferralBodySchema,
  createMyGarageBodySchema,
  editMyGarageBodySchema,
  paginationQuerySchema,
  revokeOtherSessionsBodySchema,
  updateMeBodySchema,
  updateMyGarageBodySchema,
  vehicleInputSchema,
  type ChangePasswordBody,
  type ClaimReferralBody,
  type CreateMyGarageBody,
  type EditMyGarageBody,
  type PaginationQuery,
  type RevokeOtherSessionsBody,
  type UpdateMeBody,
  type UpdateMyGarageBody,
  type VehicleInput,
} from '@geocras/shared';
import { auth, requireAuth } from '../../middleware/auth';
import { uuidParam, validateBody, validateQuery, validated } from '../../middleware/validate';
import {
  addVehicle,
  deleteMe,
  deleteVehicle,
  getMe,
  listVehicles,
  setDefaultVehicle,
  updateMe,
  updateVehicle,
} from './me.service';
import { claimReferral, getHistory, getSummary } from '../loyalty/loyalty.service';
import {
  changePassword,
  listSessions,
  revokeOtherSessions,
} from '../auth/auth.service';
import {
  createOwnedGarage,
  deleteOwnedGarage,
  getOwnedGarage,
  setOwnedGarageActive,
  updateOwnedGarage,
} from '../garages/garages.service';

export const meRouter: Router = Router();

meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  res.json(await getMe(auth(req).userId));
});

meRouter.patch('/', validateBody(updateMeBodySchema), async (req, res) => {
  res.json(await updateMe(auth(req).userId, req.body as UpdateMeBody));
});

meRouter.delete('/', async (req, res) => {
  await deleteMe(auth(req).userId);
  res.status(204).end();
});

/**
 * Le garage du compte connecté.
 *
 * Sous `/me` et non sous `/garages/:id` : l'identifiant du garage n'est pas
 * une donnée que le mobile a sous la main, et le seul garage qu'un compte peut
 * modifier est le sien. Aucun `:id` à forger, donc aucun contrôle
 * d'appartenance à oublier — la propriété est dans le `WHERE`.
 *
 * Pas de `requireRole('garage_owner')` : le rôle voyage dans le jeton d'accès,
 * qui date d'avant l'inscription du garage. Un garagiste tout juste inscrit
 * serait refusé sur son propre garage jusqu'au prochain rafraîchissement.
 * L'autorité, c'est `owner_user_id` en base.
 */
meRouter.get('/garage', async (req, res) => {
  res.json({ garage: await getOwnedGarage(auth(req).userId) });
});

meRouter.post('/garage', validateBody(createMyGarageBodySchema), async (req, res) => {
  res.status(201).json(await createOwnedGarage(auth(req).userId, req.body as CreateMyGarageBody));
});

meRouter.patch('/garage', validateBody(updateMyGarageBodySchema), async (req, res) => {
  const { isActive } = req.body as UpdateMyGarageBody;
  res.json(await setOwnedGarageActive(auth(req).userId, isActive));
});

/**
 * Correction et retrait du dossier, tant qu'il est à l'étude.
 *
 * `PUT` et non `PATCH` : le verbe partiel sert déjà à la détection, et surtout
 * le dossier se corrige en entier — le formulaire renvoie tous ses champs.
 *
 * La fenêtre est fermée par le service dès que `verified_at` est posé ; la
 * route ne la contrôle pas elle-même, parce que la lecture et l'écriture
 * doivent tenir dans la même transaction pour qu'une vérification survenant
 * entre les deux ne passe pas au travers.
 */
meRouter.put('/garage', validateBody(editMyGarageBodySchema), async (req, res) => {
  res.json(await updateOwnedGarage(auth(req).userId, req.body as EditMyGarageBody));
});

meRouter.delete('/garage', async (req, res) => {
  await deleteOwnedGarage(auth(req).userId);
  res.status(204).end();
});

/**
 * Sécurité du compte.
 *
 * Sous `/me` et non sous `/auth` : ces trois routes exigent une session et ne
 * concernent que son propriétaire, là où `/auth` sert justement à qui n'en a
 * pas encore.
 */
meRouter.get('/sessions', async (req, res) => {
  res.json({ sessions: await listSessions(auth(req).userId) });
});

meRouter.post(
  '/sessions/revoke-others',
  validateBody(revokeOtherSessionsBodySchema),
  async (req, res) => {
    const { refreshToken } = req.body as RevokeOtherSessionsBody;
    res.json({ revoked: await revokeOtherSessions(auth(req).userId, refreshToken) });
  },
);

meRouter.patch('/password', validateBody(changePasswordBodySchema), async (req, res) => {
  res.json(await changePassword(auth(req).userId, req.body as ChangePasswordBody));
});

meRouter.get('/vehicles', async (req, res) => {
  res.json(await listVehicles(auth(req).userId));
});

meRouter.post('/vehicles', validateBody(vehicleInputSchema), async (req, res) => {
  res.status(201).json(await addVehicle(auth(req).userId, req.body as VehicleInput));
});

meRouter.patch('/vehicles/:id', validateBody(vehicleInputSchema), async (req, res) => {
  res.json(
    await updateVehicle(auth(req).userId, uuidParam(req, 'id'), req.body as VehicleInput),
  );
});

meRouter.post('/vehicles/:id/default', async (req, res) => {
  res.json(await setDefaultVehicle(auth(req).userId, uuidParam(req, 'id')));
});

meRouter.delete('/vehicles/:id', async (req, res) => {
  await deleteVehicle(auth(req).userId, uuidParam(req, 'id'));
  res.status(204).end();
});

meRouter.get('/loyalty', async (req, res) => {
  res.json(await getSummary(auth(req).userId));
});

meRouter.get('/loyalty/history', validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, pageSize } = validated<PaginationQuery>(req);
  res.json(await getHistory(auth(req).userId, page, pageSize));
});

meRouter.post('/referral/claim', validateBody(claimReferralBodySchema), async (req, res) => {
  await claimReferral(auth(req).userId, (req.body as ClaimReferralBody).code);
  res.status(204).end();
});

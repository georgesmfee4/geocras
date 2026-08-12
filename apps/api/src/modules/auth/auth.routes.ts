import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  loginBodySchema,
  refreshBodySchema,
  signupBodySchema,
  type LoginBody,
  type SignupBody,
} from '@geocras/shared';
import { validateBody } from '../../middleware/validate';
import { login, logout, refresh, signup } from './auth.service';
import { isTest } from '../../config/env';

/**
 * Limitation stricte sur la connexion : sans elle, un numéro camerounais tient
 * sur 9 chiffres dont le préfixe est connu, et un mot de passe faible tombe en
 * quelques heures de force brute.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessayez dans 15 minutes' },
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Trop de comptes créés depuis cette connexion' },
  },
});

export const authRouter: Router = Router();

authRouter.post('/signup', signupLimiter, validateBody(signupBodySchema), async (req, res) => {
  res.status(201).json(await signup(req.body as SignupBody));
});

authRouter.post('/login', loginLimiter, validateBody(loginBodySchema), async (req, res) => {
  res.json(await login(req.body as LoginBody));
});

authRouter.post('/refresh', validateBody(refreshBodySchema), async (req, res) => {
  res.json(await refresh((req.body as { refreshToken: string }).refreshToken));
});

authRouter.post('/logout', validateBody(refreshBodySchema), async (req, res) => {
  await logout((req.body as { refreshToken: string }).refreshToken);
  res.status(204).end();
});

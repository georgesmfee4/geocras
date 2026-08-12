import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signUploadBodySchema, type SignUploadBody } from '@geocras/shared';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { signUpload } from './uploads.service';
import { isTest } from '../../config/env';

/**
 * Limité même authentifié : une signature est une autorisation d'écrire chez un
 * prestataire facturé à l'usage. Un compte compromis ne doit pas pouvoir en
 * générer des milliers.
 */
const signLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMITED', message: "Trop d'envois, réessayez plus tard" } },
});

export const uploadsRouter: Router = Router();

uploadsRouter.post(
  '/sign',
  requireAuth,
  signLimiter,
  validateBody(signUploadBodySchema),
  (req, res) => {
    res.json(signUpload((req.body as SignUploadBody).folder));
  },
);

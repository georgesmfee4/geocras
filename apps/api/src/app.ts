import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isTest } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { garagesRouter } from './modules/garages/garages.routes';
import { requestsRouter } from './modules/requests/requests.routes';
import { meRouter } from './modules/me/me.routes';
import { drivingRouter } from './modules/driving/driving.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';

export function createApp(): Express {
  const app = express();

  // Derrière Render/Railway, l'IP réelle est dans X-Forwarded-For. Sans ce
  // réglage, le rate limiting voit une seule IP — celle du proxy — et
  // bloquerait tous les utilisateurs d'un coup.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      // Une app mobile n'envoie pas d'Origin : la liste ne sert qu'au futur
      // back-office web. Vide = aucune origine navigateur autorisée.
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  if (!isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  app.use('/auth', authRouter);
  app.use('/garages', garagesRouter);
  app.use('/requests', requestsRouter);
  app.use('/me', meRouter);
  app.use('/driving', drivingRouter);
  app.use('/uploads', uploadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

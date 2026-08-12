import pino from 'pino';
import { env, isProduction, isTest } from '../config/env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }),
  redact: {
    // Ces champs ne doivent jamais atteindre un fichier de log, même en dev :
    // les journaux se copient, se collent et finissent dans des tickets.
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.refreshToken',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'accessToken',
      'refreshToken',
    ],
    censor: '[masqué]',
  },
});

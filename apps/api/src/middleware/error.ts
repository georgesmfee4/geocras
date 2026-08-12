import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from '@geocras/shared';
import { AppError } from '../lib/errors';
import { isProduction } from '../config/env';
import { logger } from '../lib/logger';

/** Route inconnue — traitée comme une erreur, pas comme un HTML 404 d'Express. */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ErrorResponse = {
    error: { code: 'NOT_FOUND', message: 'Ressource introuvable' },
  };
  res.status(404).json(body);
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  // Tout ce qui arrive ici est un bug, pas un cas métier.
  logger.error({ err: error }, 'Erreur non gérée');

  const body: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      // En production le message interne ne sort jamais : il peut contenir un
      // fragment de requête SQL ou un nom de colonne.
      message: isProduction
        ? 'Une erreur interne est survenue'
        : ((error as Error)?.message ?? 'Erreur inconnue'),
    },
  };
  res.status(500).json(body);
}

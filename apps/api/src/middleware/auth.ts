import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@geocras/shared';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../modules/auth/tokens';

export type AuthenticatedRequest = Request & {
  auth: { userId: string; role: UserRole };
};

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    next(unauthorized());
    return;
  }
  const payload = verifyAccessToken(token);
  (req as AuthenticatedRequest).auth = { userId: payload.sub, role: payload.role };
  next();
}

/** Attache l'identité si un jeton valide est présent, sans jamais rejeter. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      (req as AuthenticatedRequest).auth = { userId: payload.sub, role: payload.role };
    } catch {
      // Jeton expiré sur une route publique : on sert la version anonyme
      // plutôt que de renvoyer un 401 sur une carte consultable sans compte.
    }
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(auth.role)) {
      next(forbidden("Votre compte n'a pas accès à cette action"));
      return;
    }
    next();
  };
}

export function auth(req: Request): AuthenticatedRequest['auth'] {
  const value = (req as AuthenticatedRequest).auth;
  if (!value) throw unauthorized();
  return value;
}
